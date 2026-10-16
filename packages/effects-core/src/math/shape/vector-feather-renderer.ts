import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import * as spec from '@galacean/effects-specification';
import type { Engine } from '../../engine';
import type { MaterialProps } from '../../material';
import { Material } from '../../material';
import type { Attribute, GPUFramebuffer, Renderer } from '../../render';
import { BufferUsage, Geometry, GLSLVersion } from '../../render';
import type { Texture } from '../../texture';
import { glContext } from '../../gl';
import type { ItemRenderer } from '../../components';
import type { ShapeContour } from '../../plugins/shape/shape-path';
import type { Paint } from '../../plugins/shape/shape-material';
import { applyShapeRendererOptions, isSolidOrGradient, updateShapePaintMaterial } from '../../plugins/shape/shape-material';
import type { StrokeAttributes } from './build-line';
import { buildLineContour } from './build-line';
import type { FeatherBBox, FeatherMeshData } from './feather-mesh-builder';
import { buildContoursFeatherMeshData, buildFeatherMeshData } from './feather-mesh-builder';
import type { AtlasRect } from './atlas-allocator';
import indicatorVert from '../../plugins/shape/shaders/feather-indicator.vert.glsl';
import indicatorFrag from '../../plugins/shape/shaders/feather-indicator.frag.glsl';
import indicatorSoSVert from '../../plugins/shape/shaders/feather-indicator-sos.vert.glsl';
import indicatorSoSFrag from '../../plugins/shape/shaders/feather-indicator-sos.frag.glsl';
import scatterVert from '../../plugins/shape/shaders/feather-scatter.vert.glsl';
import scatterFrag from '../../plugins/shape/shaders/feather-scatter.frag.glsl';
import upsampleVert from '../../plugins/shape/shaders/feather-upsample.vert.glsl';
import upsampleFrag from '../../plugins/shape/shaders/feather-upsample.frag.glsl';

export type FeatherRect = [number, number, number, number];

/**
 * 羽化渲染参数（用于批处理提交）
 */
export type FeatherRenderParams = {
  side: FeatherSide,
  fboW: number,
  fboH: number,
  orthoProjection: Matrix4,
  featherRadius: number, // 本次绘制使用的局部空间半径，不改写配置值
  /**
   * FBO 覆盖的局部空间矩形 [minX, minY, width, height]。
   * scatter 用它把 gl_FragCoord 反算回局部坐标。
   */
  localRect: FeatherRect,
};

/**
 * @internal
 * 由 renderOffscreen() 每帧设置，供 render() 执行 upsample
 */
export type FeatherAtlasInfo = {
  atlasTexture: Texture,
  atlasSize: Vector2,
  textureOffset: Vector2,
  textureSize: Vector2,
  expandedRect: FeatherRect,
};

export type FeatherSide = 'fill' | 'stroke';

const FEATHER_SIDES: readonly FeatherSide[] = ['fill', 'stroke'];

export type FeatherAtlasLayers = Record<FeatherSide, FeatherAtlasInfo | null>;

type FeatherShapeData = {
  fillContours: readonly ShapeContour[],
  strokeContours: readonly ShapeContour[],
  strokeAttributes: StrokeAttributes,
  fills: readonly Paint[],
  strokes: readonly Paint[],
  rendererOptions: ItemRenderer,
  isMask: boolean,
};

type InstanceAttributeLayout = {
  name: string,
  offset: number,
};

type SideMeshInfo = {
  bbox: FeatherRect,
  scatterCount: number,
  triangleCount: number,
};

type UpsampleVectors = {
  expandedMin: Vector2,
  expandedSize: Vector2,
};

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const POINT_COMPONENTS = 2;
const SCATTER_STRIDE_BYTES = 4 * FLOAT_BYTES;
const TRIANGLE_STRIDE_BYTES = 6 * FLOAT_BYTES;
const SCATTER_ATTRIBUTES: InstanceAttributeLayout[] = [
  { name: 'aStart', offset: 0 },
  { name: 'aEnd', offset: 2 * FLOAT_BYTES },
];
const TRIANGLE_ATTRIBUTES: InstanceAttributeLayout[] = [
  { name: 'aP0', offset: 0 },
  { name: 'aP1', offset: 2 * FLOAT_BYTES },
  { name: 'aP2', offset: 4 * FLOAT_BYTES },
];
const SCATTER_DATA_SOURCE = 'aEdgeData';
const TRIANGLE_DATA_SOURCE = 'aTriangleData';
const INDICATOR_SUBMESH: Record<FeatherSide, number> = { fill: 0, stroke: 1 };
const FLOATS_PER_TRIANGLE = 6;

/**
 * 矢量羽化渲染器
 * 实现基于下采样的 3-pass 羽化管线:
 * 1. Indicator Pass - 绘制形状指示图到离屏纹理
 * 2. Scatter (Integration) Pass - 计算边界羽化值
 * 3. Upsample Pass - 从离屏纹理采样到屏幕
 */
export class VectorFeatherRenderer {
  /**
   * 打开时 indicator 用包围盒覆盖，并按与 scatter 相同的浮点 SoS 判断内外。
   * 关闭时仍光栅化扇形三角形，用 gl_FrontFacing 写 ±1。
   */
  static indicatorSoS = true;

  private engine: Engine;

  /**
   * 填充和描边各用一份实例缓冲。WebGL 没有 baseInstance，共用缓冲只能改 attribute 偏移，会使 VAO 失效。
   */
  private scatterGeometries: Record<FeatherSide, Geometry>;
  private indicatorSoSGeometries: Record<FeatherSide, Geometry>;
  private indicatorGeometry: Geometry;
  private upsampleGeometry: Geometry;

  private indicatorMaterial: Material;
  private indicatorSoSMaterial: Material;
  private scatterMaterial: Material;

  /**
   * 填充和描边各自的 Upsample 材质。
   */
  private _upsampleMaterials: Record<FeatherSide, Material>;
  private resourcesInitialized = false;
  private _enabled = false;

  get enabled (): boolean {
    return this._enabled && this.featherRadius > 0;
  }

  get materials (): Material[] {
    return this.enabled ? [this.upsampleMaterials.fill, this.upsampleMaterials.stroke] : [];
  }

  private get upsampleMaterials (): Record<FeatherSide, Material> {
    this.initializeResources();

    return this._upsampleMaterials;
  }

  private sideMeshes: Record<FeatherSide, SideMeshInfo> = {
    fill: { bbox: [0, 0, 0, 0], scatterCount: 0, triangleCount: 0 },
    stroke: { bbox: [0, 0, 0, 0], scatterCount: 0, triangleCount: 0 },
  };
  private upsampleVectors: Record<FeatherSide, UpsampleVectors> = {
    fill: { expandedMin: new Vector2(), expandedSize: new Vector2() },
    stroke: { expandedMin: new Vector2(), expandedSize: new Vector2() },
  };
  private pixelOrigin = new Vector2();
  private spacePerPixel = new Vector2();

  /**
   * 羽化半径（局部坐标空间），0 表示不启用羽化
   */
  featherRadius = 0;

  /**
   * 羽化颜色，默认使用第一个 fill 的颜色
   */
  featherColor: Color = new Color(1, 1, 1, 1);

  /**
   * 填充和描边各自的 atlas 区域。两侧遮罩互不叠加。
   */
  atlasLayers: FeatherAtlasLayers | null = null;

  constructor (engine: Engine) {
    this.engine = engine;
  }

  private initializeResources (): void {
    if (this.resourcesInitialized) {
      return;
    }

    // --- Indicator Pass 材质 ---
    this.indicatorMaterial = this.createFeatherMaterial(indicatorVert, indicatorFrag);
    this.indicatorMaterial.blending = true;
    this.indicatorMaterial.blendFunction = [glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE];
    this.indicatorMaterial.depthTest = false;
    this.indicatorMaterial.culling = false;

    // --- Indicator SoS 材质 ---
    this.indicatorSoSMaterial = this.createFeatherMaterial(indicatorSoSVert, indicatorSoSFrag);
    this.indicatorSoSMaterial.blending = true;
    this.indicatorSoSMaterial.blendFunction = [glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE];
    this.indicatorSoSMaterial.depthTest = false;
    this.indicatorSoSMaterial.culling = false;

    // --- Scatter Pass 材质 ---
    this.scatterMaterial = this.createFeatherMaterial(scatterVert, scatterFrag);
    this.scatterMaterial.blending = true;
    this.scatterMaterial.blendFunction = [glContext.ONE, glContext.ONE, glContext.ONE, glContext.ONE];
    this.scatterMaterial.depthTest = false;
    this.scatterMaterial.culling = false;

    // --- Upsample Pass 材质 ---
    this._upsampleMaterials = {
      fill: this.createUpsampleMaterial(),
      stroke: this.createUpsampleMaterial(),
    };

    this.scatterGeometries = {
      fill: this.createInstancedGeometry(SCATTER_DATA_SOURCE, SCATTER_STRIDE_BYTES, SCATTER_ATTRIBUTES),
      stroke: this.createInstancedGeometry(SCATTER_DATA_SOURCE, SCATTER_STRIDE_BYTES, SCATTER_ATTRIBUTES),
    };
    this.indicatorSoSGeometries = {
      fill: this.createInstancedGeometry(TRIANGLE_DATA_SOURCE, TRIANGLE_STRIDE_BYTES, TRIANGLE_ATTRIBUTES),
      stroke: this.createInstancedGeometry(TRIANGLE_DATA_SOURCE, TRIANGLE_STRIDE_BYTES, TRIANGLE_ATTRIBUTES),
    };

    this.indicatorGeometry = Geometry.create(this.engine, {
      attributes: {
        aPos: { type: glContext.FLOAT, size: 2, data: new Float32Array(0) },
      },
      mode: glContext.TRIANGLES,
      drawCount: 0,
      bufferUsage: BufferUsage.Dynamic,
    });
    for (const side of FEATHER_SIDES) {
      this.indicatorGeometry.subMeshes[INDICATOR_SUBMESH[side]] = { offset: 0, vertexCount: 0 };
    }

    // 单位四边形，局部坐标由顶点着色器用 uExpandedMin / uExpandedSize 计算
    this.upsampleGeometry = Geometry.create(this.engine, {
      attributes: {
        aUV: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array([
            0, 1,   // 左上
            0, 0,   // 左下
            1, 1,   // 右上
            1, 0,   // 右下
          ]),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
      mode: glContext.TRIANGLES,
      drawCount: 6,
    });
    this.resourcesInitialized = true;
  }

  /**
   * 读取配置；具体的 paint 支持条件在 update 中判断。
   */
  fromData (data: spec.ShapeComponentData): void {
    const extData = data as spec.ShapeComponentData & {
      featherRadius?: number,
      featherColor?: { r: number, g: number, b: number, a: number },
    };

    this.featherRadius = extData.featherRadius ?? 0;
    if (extData.featherColor) {
      this.featherColor = new Color().copyFrom(extData.featherColor);
    }
    this.atlasLayers = null;
    this._enabled = false;
  }

  update (data: FeatherShapeData): void {
    this._enabled = this.featherRadius > 0 && !data.isMask
      && data.fills.length <= 1 && data.strokes.length <= 1
      && data.fills.every(isSolidOrGradient) && data.strokes.every(isSolidOrGradient);

    if (!this.enabled) {
      this.atlasLayers = null;

      return;
    }
    this.updateGeometry(data);
    this.updateMaterials(data);
  }

  private updateGeometry (data: FeatherShapeData): void {
    const meshes = {
      fill: createEmptyFeatherMeshData(),
      stroke: createEmptyFeatherMeshData(),
    };

    for (const contour of data.fillContours) {
      buildFeatherMeshData(contour.points, meshes.fill);
    }

    for (const contour of data.strokeContours) {
      const contours = buildLineContour(contour.points, data.strokeAttributes, false, contour.closed);

      buildContoursFeatherMeshData(contours, meshes.stroke);
    }

    this.updateMeshData(meshes);
  }

  private updateMaterials (data: FeatherShapeData): void {
    const firstFill = data.fills[0];
    const firstStroke = data.strokes[0];

    if (firstFill?.type === spec.FillType.Solid) {
      this.featherColor = firstFill.color;
    } else if (firstStroke?.type === spec.FillType.Solid) {
      this.featherColor = firstStroke.color;
    }

    for (const side of FEATHER_SIDES) {
      const material = this.upsampleMaterials[side];
      const paint = (side === 'fill' ? data.fills : data.strokes)[0];

      applyShapeRendererOptions(material, data.rendererOptions);
      if (paint) {
        updateShapePaintMaterial(material, paint);
      } else {
        material.setFloat('_FillType', spec.FillType.Solid);
        material.color = this.featherColor;
      }
    }
  }

  private updateMeshData (meshes: Record<FeatherSide, FeatherMeshData>): void {
    this.initializeResources();

    for (const side of FEATHER_SIDES) {
      const { triangles, edges, bbox } = meshes[side];

      this.sideMeshes[side] = {
        bbox: toFeatherRect(bbox),
        scatterCount: edges.length / 4,
        triangleCount: triangles.length / FLOATS_PER_TRIANGLE,
      };
      this.scatterGeometries[side] = this.updateInstancedGeometry(
        this.scatterGeometries[side], SCATTER_DATA_SOURCE, SCATTER_STRIDE_BYTES, SCATTER_ATTRIBUTES, edges,
      );
      this.indicatorSoSGeometries[side] = this.updateInstancedGeometry(
        this.indicatorSoSGeometries[side], TRIANGLE_DATA_SOURCE, TRIANGLE_STRIDE_BYTES, TRIANGLE_ATTRIBUTES, triangles,
      );
    }

    const fillTriangles = meshes.fill.triangles;
    const strokeTriangles = meshes.stroke.triangles;

    const positions = new Float32Array([...fillTriangles, ...strokeTriangles]);
    const buffer = this.indicatorGeometry.getAttributeBuffer('aPos');

    if (!buffer || positions.byteLength > buffer.capacity) {
      this.indicatorGeometry.setAttribute('aPos', { data: positions, size: 2 }, BufferUsage.Dynamic);
    } else {
      this.indicatorGeometry.setAttributeData('aPos', positions);
    }
    this.indicatorGeometry.setDrawCount(positions.length / 2);
    this.indicatorGeometry.subMeshes[INDICATOR_SUBMESH.fill].vertexCount = fillTriangles.length / 2;
    this.indicatorGeometry.subMeshes[INDICATOR_SUBMESH.stroke].offset = fillTriangles.length / 2;
    this.indicatorGeometry.subMeshes[INDICATOR_SUBMESH.stroke].vertexCount = strokeTriangles.length / 2;

    const [gradientMinX, gradientMinY, gradientWidth, gradientHeight] = unionFeatherRect(
      this.sideMeshes.fill.bbox, this.sideMeshes.stroke.bbox,
    );

    for (const side of FEATHER_SIDES) {
      const material = this.upsampleMaterials[side];

      material.setVector2('uGradientMin', new Vector2(gradientMinX, gradientMinY));
      material.setVector2('uGradientSize', new Vector2(gradientWidth, gradientHeight));
    }
  }

  /**
   * 一次准备填充和描边的离屏参数，共用 MVP、屏幕尺寸和修正后的半径。
   */
  prepareLayers (renderer: Renderer, worldMatrix: Matrix4): FeatherRenderParams[] {
    this.atlasLayers = null;
    const layers: FeatherRenderParams[] = [];

    if (!this.enabled) {
      return layers;
    }

    const vpMatrix = renderer.renderingData.options!.camera.getViewProjectionMatrix();
    const mvp = new Matrix4().multiplyMatrices(vpMatrix, worldMatrix);
    const [, , screenW, screenH] = renderer.getViewport();
    const featherRadiusScreen = this.computeScreenRadius(
      mvp, screenW, screenH, this.featherRadius,
    );
    // 羽化半径至少要有1px，否则只会导致一些奇奇怪怪的锯齿（当使用1px羽化时，表现为抗锯齿效果）
    const refinedScreenRadius = Math.max(featherRadiusScreen, 1.0);

    const featherRadius = this.featherRadius * refinedScreenRadius / Math.max(featherRadiusScreen, 0.0001);
    const expandRadius = getExpandedRadius(featherRadius, refinedScreenRadius);
    const downsample = Math.min(Math.max(refinedScreenRadius / 10.0, 1.0), 9999);
    const maxFboSize = Math.min(2048, this.engine.displayServer.renderingDevice.gpuCapability.detail.maxTextureSize);

    for (const side of FEATHER_SIDES) {
      const { bbox, scatterCount, triangleCount } = this.sideMeshes[side];

      if ((scatterCount <= 0 && triangleCount <= 0) || bbox[2] <= 0 || bbox[3] <= 0) {
        continue;
      }

      const [bx, by, bw, bh] = bbox;
      const expandedW = bw + expandRadius * 2;
      const expandedH = bh + expandRadius * 2;
      const expandedMinX = bx - expandRadius;
      const expandedMinY = by - expandRadius;
      const screenExtent = this.computeScreenExtent(
        mvp, screenW, screenH,
        expandedMinX, expandedMinY, expandedW, expandedH,
      );

      layers.push({
        side,
        fboW: Math.min(Math.max(Math.ceil(screenExtent[0] / downsample), 1), maxFboSize),
        fboH: Math.min(Math.max(Math.ceil(screenExtent[1] / downsample), 1), maxFboSize),
        orthoProjection: createOrthoMatrix(
          expandedMinX, expandedMinX + expandedW,
          expandedMinY, expandedMinY + expandedH,
        ),
        featherRadius,
        localRect: [expandedMinX, expandedMinY, expandedW, expandedH],
      });
    }

    return layers;
  }

  /**
   * 向已分配的 atlas 区域绘制 Indicator 和 Scatter，并记录合成参数。
   * 调用者需已设置好 FBO 和 viewport。
   */
  renderOffscreen (
    renderer: Renderer,
    params: FeatherRenderParams,
    atlas: GPUFramebuffer,
    rect: AtlasRect,
  ): void {
    const { side, featherRadius, orthoProjection } = params;
    const { triangleCount, scatterCount } = this.sideMeshes[side];
    const useSoS = VectorFeatherRenderer.indicatorSoS;
    const indicatorMaterial = useSoS ? this.indicatorSoSMaterial : this.indicatorMaterial;
    const viewportOffset = new Vector2(rect.x, rect.y);
    const [minX, minY, localW, localH] = params.localRect;

    this.pixelOrigin.set(minX, minY);
    this.spacePerPixel.set(localW / params.fboW, localH / params.fboH);
    indicatorMaterial.setMatrix('uProjection', orthoProjection);
    this.scatterMaterial.setMatrix('uProjection', orthoProjection);

    for (const material of useSoS ? [indicatorMaterial, this.scatterMaterial] : [this.scatterMaterial]) {
      material.setVector2('uViewportOffset', viewportOffset);
      material.setVector2('uPixelOrigin', this.pixelOrigin);
      material.setVector2('uSpacePerPixel', this.spacePerPixel);
    }

    if (useSoS) {
      if (triangleCount > 0) {
        renderer.drawGeometryInstanced(this.indicatorSoSGeometries[side], indicatorMaterial, triangleCount);
      }
    } else {
      renderer.drawGeometry(this.indicatorGeometry, Matrix4.IDENTITY, indicatorMaterial, INDICATOR_SUBMESH[side]);
    }

    if (scatterCount > 0) {
      this.scatterMaterial.setFloat('uCoverRadius', featherRadius + Math.max(this.spacePerPixel.x, this.spacePerPixel.y));
      this.scatterMaterial.setFloat('uRadius', featherRadius);
      renderer.drawGeometryInstanced(this.scatterGeometries[side], this.scatterMaterial, scatterCount);
    }

    const layers = this.atlasLayers ?? { fill: null, stroke: null };

    layers[side] = {
      atlasTexture: atlas.getColorTextures()[0],
      atlasSize: new Vector2(atlas.viewport[2], atlas.viewport[3]),
      textureOffset: viewportOffset,
      textureSize: new Vector2(rect.w, rect.h),
      expandedRect: params.localRect,
    };
    this.atlasLayers = layers;
  }

  /**
   * 绘制一侧的 Upsample。只写入随 atlas 和相机变化的 uniform。
   */
  private drawUpsamplePass (
    renderer: Renderer,
    worldMatrix: Matrix4,
    side: FeatherSide,
    layer: FeatherAtlasInfo,
  ): void {
    const material = this.upsampleMaterials[side];
    const vectors = this.upsampleVectors[side];
    const [expandedMinX, expandedMinY, expandedWidth, expandedHeight] = layer.expandedRect;

    vectors.expandedMin.set(expandedMinX, expandedMinY);
    vectors.expandedSize.set(expandedWidth, expandedHeight);
    material.setFloat('uIndicatorSoS', VectorFeatherRenderer.indicatorSoS ? 1 : 0);
    material.setTexture('uAtlasTex', layer.atlasTexture);
    material.setVector2('uTextureSize', layer.textureSize);
    material.setVector2('uAtlasSize', layer.atlasSize);
    material.setVector2('uTextureOffset', layer.textureOffset);
    material.setVector2('uExpandedMin', vectors.expandedMin);
    material.setVector2('uExpandedSize', vectors.expandedSize);
    renderer.drawGeometry(this.upsampleGeometry, worldMatrix, material);
  }

  /** atlas 已准备好时完成合成，否则由组件继续普通绘制。 */
  render (renderer: Renderer, worldMatrix: Matrix4): boolean {
    const layers = this.atlasLayers;

    if (!this.enabled || !layers || !(layers.fill || layers.stroke)) {
      return false;
    }
    for (const side of FEATHER_SIDES) {
      const layer = layers[side];

      if (layer) {
        this.drawUpsamplePass(renderer, worldMatrix, side, layer);
      }
    }

    return true;
  }

  private updateInstancedGeometry (
    geometry: Geometry,
    dataSource: string,
    strideBytes: number,
    layout: InstanceAttributeLayout[],
    values: number[],
  ): Geometry {
    const data = new Float32Array(values);
    const buffer = geometry.getAttributeBuffer(dataSource);

    if (!buffer || data.byteLength > buffer.capacity) {
      geometry.dispose();

      return this.createInstancedGeometry(dataSource, strideBytes, layout, data);
    }
    geometry.setAttributeData(dataSource, data);

    return geometry;
  }

  private createInstancedGeometry (
    dataSource: string,
    strideBytes: number,
    layout: InstanceAttributeLayout[],
    data = new Float32Array(0),
  ): Geometry {
    const attributes: Record<string, Attribute> = {
      aTemplate: {
        type: glContext.FLOAT,
        size: POINT_COMPONENTS,
        data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      },
      [dataSource]: {
        type: glContext.FLOAT,
        size: POINT_COMPONENTS,
        stride: strideBytes,
        instanceDivisor: 1,
        data,
      },
    };

    for (const { name, offset } of layout) {
      attributes[name] = {
        type: glContext.FLOAT,
        size: POINT_COMPONENTS,
        stride: strideBytes,
        offset,
        dataSource,
        instanceDivisor: 1,
      };
    }

    return Geometry.create(this.engine, {
      attributes,
      mode: glContext.TRIANGLE_STRIP,
      drawCount: 4,
      bufferUsage: BufferUsage.Dynamic,
    });
  }

  private createUpsampleMaterial (): Material {
    const material = this.createFeatherMaterial(upsampleVert, upsampleFrag);

    material.blending = true;
    material.blendFunction = [
      glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
      glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
    ];
    material.depthTest = false;
    material.culling = false;
    material.shader.shaderData.properties = 'uAtlasTex("uAtlasTex",2D) = "white" {}';

    return material;
  }

  /**
   * 将局部坐标 bbox 投影到屏幕像素空间，返回 [宽, 高]。
   * 用于确定 FBO 的合理分辨率，避免局部坐标远小于屏幕像素时出现马赛克。
   */
  private computeScreenExtent (
    mvp: Matrix4,
    screenW: number, screenH: number,
    minX: number, minY: number, w: number, h: number,
  ): [number, number] {
    const e = mvp.elements;

    const corners = [
      [minX, minY],
      [minX + w, minY],
      [minX, minY + h],
      [minX + w, minY + h],
    ];

    let sxMin = Infinity, syMin = Infinity;
    let sxMax = -Infinity, syMax = -Infinity;

    for (const [x, y] of corners) {
      // MVP * vec4(x, y, 0, 1)
      const cx = e[0] * x + e[4] * y + e[12];
      const cy = e[1] * x + e[5] * y + e[13];
      const cw = e[3] * x + e[7] * y + e[15];

      if (cw <= 0) {
        // 在相机后方，回退到渲染器尺寸
        return [screenW, screenH];
      }
      const sx = (cx / cw * 0.5 + 0.5) * screenW;
      const sy = (cy / cw * 0.5 + 0.5) * screenH;

      sxMin = Math.min(sxMin, sx);
      syMin = Math.min(syMin, sy);
      sxMax = Math.max(sxMax, sx);
      syMax = Math.max(syMax, sy);
    }

    return [
      Math.max(sxMax - sxMin, 1),
      Math.max(syMax - syMin, 1),
    ];
  }

  /**
   * 分别投影局部 X/Y 轴上的半径，取较短的屏幕长度。
   * 使用向量长度，避免旋转后对角线的 X/Y 分量抵消。
   */
  private computeScreenRadius (
    mvp: Matrix4,
    screenW: number, screenH: number,
    featherRadius: number,
  ) {
    const e = mvp.elements;
    // [0, 0, 0, 1]
    const ox = e[12];
    const oy = e[13];
    const ow = e[15];
    const projectAxis = (column: number): number => {
      const rw = e[column + 3] * featherRadius + ow;

      if (ow <= 0 || rw <= 0) {
        return 0;
      }
      const dx = ((e[column] * featherRadius + ox) / rw - ox / ow) * screenW * 0.5;
      const dy = ((e[column + 1] * featherRadius + oy) / rw - oy / ow) * screenH * 0.5;

      return Math.hypot(dx, dy);
    };

    return Math.min(projectAxis(0), projectAxis(4));
  }

  dispose (): void {
    this.atlasLayers = null;
    this._enabled = false;
    if (!this.resourcesInitialized) {
      return;
    }
    for (const side of FEATHER_SIDES) {
      this.scatterGeometries[side].dispose();
      this.indicatorSoSGeometries[side].dispose();
      this._upsampleMaterials[side].dispose();
    }
    this.upsampleGeometry?.dispose();
    this.indicatorGeometry.dispose();
    this.indicatorMaterial?.dispose();
    this.indicatorSoSMaterial?.dispose();
    this.scatterMaterial?.dispose();
    this.resourcesInitialized = false;
  }

  private createFeatherMaterial (vertexShader: string, fragmentShader: string): Material {
    const materialProps: MaterialProps = {
      shader: {
        vertex: vertexShader,
        fragment: fragmentShader,
        glslVersion: GLSLVersion.GLSL1,
        shared: true,
      },
    };

    return Material.create(this.engine, materialProps);
  }
}

function createEmptyFeatherMeshData (): FeatherMeshData {
  return {
    triangles: [],
    edges: [],
    bbox: { minX: Number.MAX_VALUE, minY: Number.MAX_VALUE, maxX: -Number.MAX_VALUE, maxY: -Number.MAX_VALUE },
  };
}

function toFeatherRect (bbox: FeatherBBox): FeatherRect {
  if (!(bbox.minX < Number.MAX_VALUE)) {
    return [0, 0, 0, 0];
  }

  return [bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY];
}

function unionFeatherRect (fill: FeatherRect, stroke: FeatherRect): FeatherRect {
  const fillEmpty = fill[2] <= 0 || fill[3] <= 0;
  const strokeEmpty = stroke[2] <= 0 || stroke[3] <= 0;

  if (fillEmpty) {
    return stroke;
  }
  if (strokeEmpty) {
    return fill;
  }

  const minX = Math.min(fill[0], stroke[0]);
  const minY = Math.min(fill[1], stroke[1]);
  const maxX = Math.max(fill[0] + fill[2], stroke[0] + stroke[2]);
  const maxY = Math.max(fill[1] + fill[3], stroke[1] + stroke[3]);

  return [minX, minY, maxX - minX, maxY - minY];
}

/**
 * 创建正交投影矩阵
 */
function createOrthoMatrix (
  left: number, right: number,
  bottom: number, top: number,
  near = -1, far = 1,
): Matrix4 {
  const mat = new Matrix4();
  const data = mat.elements;

  data[0] = 2 / (right - left);
  data[1] = 0;
  data[2] = 0;
  data[3] = 0;

  data[4] = 0;
  data[5] = 2 / (top - bottom);
  data[6] = 0;
  data[7] = 0;

  data[8] = 0;
  data[9] = 0;
  data[10] = -2 / (far - near);
  data[11] = 0;

  data[12] = -(right + left) / (right - left);
  data[13] = -(top + bottom) / (top - bottom);
  data[14] = -(far + near) / (far - near);
  data[15] = 1;

  return mat;
}

/**
 * 基于它在屏幕的尺寸，将featherRadius扩展1px宽度
 */
export function getExpandedRadius (
  featherRadius: number,
  featherRadiusScreen: number
): number {
  return featherRadius + featherRadius / featherRadiusScreen;
}
