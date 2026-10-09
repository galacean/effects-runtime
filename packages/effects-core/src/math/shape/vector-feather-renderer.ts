import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Engine } from '../../engine';
import type { MaterialProps } from '../../material';
import { Material } from '../../material';
import type { Renderer } from '../../render';
import { Geometry, GLSLVersion } from '../../render';
import { FilterMode, RenderTextureFormat } from '../../render/framebuffer';
import { Texture, TextureLoadAction } from '../../texture';
import { glContext } from '../../gl';
import indicatorVert from './shaders/feather-indicator.vert.glsl';
import indicatorFrag from './shaders/feather-indicator.frag.glsl';
import indicatorSoSVert from './shaders/feather-indicator-sos.vert.glsl';
import indicatorSoSFrag from './shaders/feather-indicator-sos.frag.glsl';
import scatterVert from './shaders/feather-scatter.vert.glsl';
import scatterFrag from './shaders/feather-scatter.frag.glsl';
import upsampleVert from './shaders/feather-upsample.vert.glsl';
import upsampleFrag from './shaders/feather-upsample.frag.glsl';

/**
 * 羽化渲染参数（用于批处理提交）
 */
export type FeatherRenderParams = {
  fboW: number,
  fboH: number,
  orthoProjection: Matrix4,
  featherRadiusScreen: number, // 这个用于在片段着色器里做抗亮斑
  /**
   * FBO 覆盖的局部空间矩形 [minX, minY, width, height]。
   * scatter 用它把 gl_FragCoord 反算回局部坐标。
   */
  localRect: [number, number, number, number],
};

/**
 * @internal
 * 由 FeatherOffscreenPass 每帧设置，供 render() 执行 upsample
 */
export type FeatherAtlasInfo = {
  atlasTexture: Texture,
  atlasSize: Vector2,
  textureOffset: Vector2,
  textureSize: Vector2,
  featherRadiusScreen: number,
  expandedRect: [number, number, number, number],
};

export type FeatherSide = 'fill' | 'stroke';

export type FeatherAtlasLayers = {
  fill: FeatherAtlasInfo | null,
  stroke: FeatherAtlasInfo | null,
};

export type FeatherRect = [number, number, number, number];

type InstanceAttributeLayout = {
  name: string,
  baseOffset: number,
};

const SCATTER_STRIDE_BYTES = 4 * 4;
const TRIANGLE_STRIDE_BYTES = 6 * 4;
const SCATTER_ATTRIBUTES: InstanceAttributeLayout[] = [
  { name: 'aStart', baseOffset: 0 },
  { name: 'aEnd', baseOffset: 2 * 4 },
];
const TRIANGLE_ATTRIBUTES: InstanceAttributeLayout[] = [
  { name: 'aP0', baseOffset: 0 },
  { name: 'aP1', baseOffset: 2 * 4 },
  { name: 'aP2', baseOffset: 4 * 4 },
];

export type FeatherRadiusPrep = {
  featherRadiusScreen: number,
  expandRadius: number,
};

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

  private scatterGeometry: Geometry;
  private indicatorSoSGeometry: Geometry;
  private upsampleGeometry: Geometry;

  private indicatorMaterial: Material;
  private indicatorSoSMaterial: Material;
  private scatterMaterial: Material;

  /**
   * Upsample 材质。绘制前由调用方写入纯色或渐变 uniform。
   */
  upsampleMaterial: Material;

  private gradientBBox: FeatherRect = [0, 0, 0, 0];
  private fillBBox: FeatherRect = [0, 0, 0, 0];
  private strokeBBox: FeatherRect = [0, 0, 0, 0];
  private expandedRect: FeatherRect = [0, 0, 0, 0];
  private fillScatterCount = 0;
  private strokeScatterCount = 0;
  private fillTriangleCount = 0;
  private strokeTriangleCount = 0;

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
    this.upsampleMaterial = this.createFeatherMaterial(upsampleVert, upsampleFrag);
    this.upsampleMaterial.blending = true;
    this.upsampleMaterial.blendFunction = [
      glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
      glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
    ];
    this.upsampleMaterial.depthTest = false;
    this.upsampleMaterial.culling = false;
    this.upsampleMaterial.shader.shaderData.properties = 'uAtlasTex("uAtlasTex",2D) = "white" {}';

    this.scatterGeometry = Geometry.create(engine, {
      attributes: {
        aTemplate: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        },
        aStart: {
          type: glContext.FLOAT,
          size: 2,
          stride: 4 * 4,
          offset: 0,
          dataSource: 'aEdgeData',
          instanceDivisor: 1,
        },
        aEnd: {
          type: glContext.FLOAT,
          size: 2,
          stride: 4 * 4,
          offset: 2 * 4,
          dataSource: 'aEdgeData',
          instanceDivisor: 1,
        },
        aEdgeData: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array(0),
        },
      },
      mode: glContext.TRIANGLE_STRIP,
      drawCount: 4,
    });

    this.indicatorSoSGeometry = Geometry.create(engine, {
      attributes: {
        aTemplate: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        },
        aP0: {
          type: glContext.FLOAT,
          size: 2,
          stride: 6 * 4,
          offset: 0,
          dataSource: 'aTriangleData',
          instanceDivisor: 1,
        },
        aP1: {
          type: glContext.FLOAT,
          size: 2,
          stride: 6 * 4,
          offset: 2 * 4,
          dataSource: 'aTriangleData',
          instanceDivisor: 1,
        },
        aP2: {
          type: glContext.FLOAT,
          size: 2,
          stride: 6 * 4,
          offset: 4 * 4,
          dataSource: 'aTriangleData',
          instanceDivisor: 1,
        },
        aTriangleData: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array(0),
        },
      },
      mode: glContext.TRIANGLE_STRIP,
      drawCount: 4,
    });

    this.upsampleGeometry = Geometry.create(engine, {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array(12),
        },
        aUV: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array(8),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
      mode: glContext.TRIANGLES,
      drawCount: 6,
    });
  }

  /**
   * 更新羽化网格数据
   */
  updateMeshData (
    fillScatterEdges: number[],
    fillScatterCount: number,
    fillBBox: FeatherRect,
    strokeScatterEdges: number[],
    strokeScatterCount: number,
    strokeBBox: FeatherRect,
    fillTriangles: number[],
    fillTriangleCount: number,
    strokeTriangles: number[],
    strokeTriangleCount: number,
  ): void {
    this.fillBBox = fillBBox;
    this.strokeBBox = strokeBBox;
    this.gradientBBox = unionFeatherRect(fillBBox, strokeBBox);
    this.fillScatterCount = fillScatterCount;
    this.strokeScatterCount = strokeScatterCount;
    this.fillTriangleCount = fillTriangleCount;
    this.strokeTriangleCount = strokeTriangleCount;

    const scatterEdges = fillScatterEdges.concat(strokeScatterEdges);
    const triangles = fillTriangles.concat(strokeTriangles);

    this.scatterGeometry.setAttributeData('aEdgeData', new Float32Array(scatterEdges));
    this.indicatorSoSGeometry.setAttributeData('aTriangleData', new Float32Array(triangles));
  }

  layerInstanceRange (side: FeatherSide): { start: number, count: number } {
    if (side === 'fill') {
      return { start: 0, count: this.fillScatterCount };
    }

    return { start: this.fillScatterCount, count: this.strokeScatterCount };
  }

  layerTriangleRange (side: FeatherSide): { start: number, count: number } {
    if (side === 'fill') {
      return { start: 0, count: this.fillTriangleCount };
    }

    return { start: this.fillTriangleCount, count: this.strokeTriangleCount };
  }

  layerBBox (side: FeatherSide): FeatherRect {
    return side === 'fill' ? this.fillBBox : this.strokeBBox;
  }

  /**
   * 同一帧只调用一次。填充和描边再各自用这次得到的半径生成投影。
   */
  prepareFeatherRadius (
    renderer: Renderer,
    worldMatrix: Matrix4,
    setFeatherRadius: number,
  ): FeatherRadiusPrep {
    const featherRadiusScreen = this.computeScreenRadius(
      renderer, worldMatrix, setFeatherRadius,
    );
    // 羽化半径至少要有1px，否则只会导致一些奇奇怪怪的锯齿（当使用1px羽化时，表现为抗锯齿效果）
    const refinedScreenRadius = Math.max(featherRadiusScreen, 1.0);

    this.featherRadius = setFeatherRadius * refinedScreenRadius / Math.max(featherRadiusScreen, 0.0001);

    return {
      featherRadiusScreen: refinedScreenRadius,
      expandRadius: getExpandedRadius(this.featherRadius, refinedScreenRadius),
    };
  }

  createLayerParams (
    renderer: Renderer,
    worldMatrix: Matrix4,
    bbox: FeatherRect,
    prepared: FeatherRadiusPrep,
  ): FeatherRenderParams | null {
    if (bbox[2] <= 0 || bbox[3] <= 0) {
      return null;
    }

    const [bx, by, bw, bh] = bbox;
    const expandedW = bw + prepared.expandRadius * 2;
    const expandedH = bh + prepared.expandRadius * 2;
    const expandedMinX = bx - prepared.expandRadius;
    const expandedMinY = by - prepared.expandRadius;
    const screenExtent = this.computeScreenExtent(
      renderer, worldMatrix,
      expandedMinX, expandedMinY, expandedW, expandedH,
    );
    const downsample = Math.min(Math.max(prepared.featherRadiusScreen / 10.0, 1.0), 9999);
    const maxFboSize = 2048;
    const fboW = Math.min(Math.max(Math.ceil(screenExtent[0] / downsample), 1), maxFboSize);
    const fboH = Math.min(Math.max(Math.ceil(screenExtent[1] / downsample), 1), maxFboSize);

    return {
      fboW,
      fboH,
      orthoProjection: createOrthoMatrix(
        expandedMinX, expandedMinX + expandedW,
        expandedMinY, expandedMinY + expandedH,
      ),
      featherRadiusScreen: prepared.featherRadiusScreen,
      localRect: [expandedMinX, expandedMinY, expandedW, expandedH],
    };
  }

  updateUpsampleQuad (expandedRect: FeatherRect): void {
    const [minX, minY, width, height] = expandedRect;
    const posData = new Float32Array([
      minX, minY + height, 0,
      minX, minY, 0,
      minX + width, minY + height, 0,
      minX + width, minY, 0,
    ]);
    const uvData = new Float32Array([
      0, 1,
      0, 0,
      1, 1,
      1, 0,
    ]);

    this.expandedRect = expandedRect;
    this.upsampleGeometry.setAttributeData('aPos', posData);
    this.upsampleGeometry.setAttributeData('aUV', uvData);
  }

  /**
   * 绘制 Indicator Pass（调用者需已设置好 FBO 和 viewport）
   */
  drawIndicatorPass (
    renderer: Renderer,
    orthoProjection: Matrix4,
    geometry: Geometry,
    subMeshIndex: number,
  ): void {
    this.indicatorMaterial.setMatrix('uProjection', orthoProjection);
    renderer.drawGeometry(
      geometry, Matrix4.IDENTITY, this.indicatorMaterial, subMeshIndex,
    );
  }

  /**
   * 绘制 Indicator 的浮点 SoS 版本（调用者需已设置好 FBO 和 viewport）。
   * 每个扇形三角形画外扩 1px 的轴对齐包围盒，片元用与 scatter 相同的像素中心和侧向。
   * @param viewportOffset - 当前 viewport 在 atlas 中的起点（整数像素）
   * @param instanceStart - 这一侧（fill / stroke）三角形在实例缓冲中的起点
   * @param instanceCount - 这一侧的三角形数量
   */
  drawIndicatorSoSPass (
    renderer: Renderer,
    params: FeatherRenderParams,
    viewportOffset: Vector2,
    instanceStart: number,
    instanceCount: number,
  ): void {
    if (instanceCount <= 0) {
      return;
    }

    const [minX, minY, localW, localH] = params.localRect;
    const localPerPixelX = localW / params.fboW;
    const localPerPixelY = localH / params.fboH;

    this.shiftInstanceAttributes(this.indicatorSoSGeometry, TRIANGLE_ATTRIBUTES, instanceStart, TRIANGLE_STRIDE_BYTES);
    this.indicatorSoSMaterial.setMatrix('uProjection', params.orthoProjection);
    this.indicatorSoSMaterial.setVector2('uViewportOffset', viewportOffset);
    this.indicatorSoSMaterial.setVector2('uPixelOrigin', new Vector2(minX, minY));
    this.indicatorSoSMaterial.setVector2('uSpacePerPixel', new Vector2(localPerPixelX, localPerPixelY));
    renderer.drawGeometryInstanced(
      this.indicatorSoSGeometry, this.indicatorSoSMaterial, instanceCount,
    );
  }

  /**
   * 绘制 Scatter Pass（调用者需已设置好 FBO 和 viewport）。
   * 片元用 gl_FragCoord 反算局部空间像素中心，再用端点直接积分。
   * @param viewportOffset - 当前 viewport 在 atlas 中的起点（整数像素）
   * @param instanceStart - 这一侧边在实例缓冲中的起点
   * @param instanceCount - 这一侧的边数量
   */
  drawScatterPass (
    renderer: Renderer,
    params: FeatherRenderParams,
    featherRadius: number,
    viewportOffset: Vector2,
    instanceStart: number,
    instanceCount: number,
  ): void {
    if (instanceCount <= 0) {
      return;
    }

    const [minX, minY, localW, localH] = params.localRect;
    const localPerPixelX = localW / params.fboW;
    const localPerPixelY = localH / params.fboH;

    this.shiftInstanceAttributes(this.scatterGeometry, SCATTER_ATTRIBUTES, instanceStart, SCATTER_STRIDE_BYTES);
    this.scatterMaterial.setMatrix('uProjection', params.orthoProjection);
    this.scatterMaterial.setFloat('uCoverRadius', featherRadius + Math.max(localPerPixelX, localPerPixelY));
    this.scatterMaterial.setVector2('uViewportOffset', viewportOffset);
    this.scatterMaterial.setVector2('uPixelOrigin', new Vector2(minX, minY));
    this.scatterMaterial.setVector2('uSpacePerPixel', new Vector2(localPerPixelX, localPerPixelY));
    this.scatterMaterial.setFloat('uRadius', featherRadius);
    renderer.drawGeometryInstanced(this.scatterGeometry, this.scatterMaterial, instanceCount);
  }

  /**
   * 绘制一侧的 Upsample。渐变坐标用填充与描边合并后的包围盒。
   */
  drawLayerUpsample (
    renderer: Renderer,
    worldMatrix: Matrix4,
    layer: FeatherAtlasInfo,
  ): void {
    this.updateUpsampleQuad(layer.expandedRect);
    this.drawUpsamplePass(
      renderer, worldMatrix,
      layer.atlasTexture, layer.textureSize, layer.atlasSize, layer.textureOffset,
      layer.featherRadiusScreen,
    );
  }

  /**
   * 绘制 Upsample Pass（用于批处理模式，指定 atlas 纹理参数）
   */
  drawUpsamplePass (
    renderer: Renderer,
    worldMatrix: Matrix4,
    atlasTexture: Texture,
    textureSize: Vector2,
    atlasSize: Vector2,
    textureOffset: Vector2,
    featherRadiusScreen: number,
  ): void {
    const [gradientMinX, gradientMinY, gradientWidth, gradientHeight] = this.gradientBBox;
    const [expandedMinX, expandedMinY, expandedWidth, expandedHeight] = this.expandedRect;

    this.upsampleMaterial.setFloat('uScreenRadius', featherRadiusScreen);
    this.upsampleMaterial.setFloat('uIndicatorSoS', VectorFeatherRenderer.indicatorSoS ? 1 : 0);
    this.upsampleMaterial.setTexture('uAtlasTex', atlasTexture);
    this.upsampleMaterial.setVector2('uTextureSize', textureSize);
    this.upsampleMaterial.setVector2('uAtlasSize', atlasSize);
    this.upsampleMaterial.setVector2('uTextureOffset', textureOffset);
    this.upsampleMaterial.setVector2('uGradientMin', new Vector2(gradientMinX, gradientMinY));
    this.upsampleMaterial.setVector2('uGradientSize', new Vector2(gradientWidth, gradientHeight));
    this.upsampleMaterial.setVector2('uExpandedMin', new Vector2(expandedMinX, expandedMinY));
    this.upsampleMaterial.setVector2('uExpandedSize', new Vector2(expandedWidth, expandedHeight));
    renderer.drawGeometry(
      this.upsampleGeometry, worldMatrix, this.upsampleMaterial,
    );
  }

  /**
   * 执行 3-pass 羽化渲染（单 shape 独立渲染，未走批处理时使用）
   * 先画填充，再画描边。这条非atlas羽化路径应该是废弃的，只做了纯色。
   */
  render (
    renderer: Renderer,
    worldMatrix: Matrix4,
    featherRadius: number,
    color: Color,
    indicatorGeometry?: Geometry,
  ): void {
    const prepared = this.prepareFeatherRadius(renderer, worldMatrix, featherRadius);

    this.upsampleMaterial.setFloat('_FillType', 0);
    this.upsampleMaterial.color = color;
    this.renderSolidLayer(renderer, worldMatrix, 'fill', prepared, indicatorGeometry, 2);
    this.renderSolidLayer(renderer, worldMatrix, 'stroke', prepared, indicatorGeometry, 3);
  }

  private renderSolidLayer (
    renderer: Renderer,
    worldMatrix: Matrix4,
    side: FeatherSide,
    prepared: FeatherRadiusPrep,
    indicatorGeometry: Geometry | undefined,
    subMeshIndex: number,
  ): void {
    const scatter = side === 'fill'
      ? { start: 0, count: this.fillScatterCount }
      : { start: this.fillScatterCount, count: this.strokeScatterCount };
    const triangles = side === 'fill'
      ? { start: 0, count: this.fillTriangleCount }
      : { start: this.fillTriangleCount, count: this.strokeTriangleCount };

    if (scatter.count <= 0 && triangles.count <= 0) {
      return;
    }

    const params = this.createLayerParams(renderer, worldMatrix, this.layerBBox(side), prepared);

    if (!params) {
      return;
    }
    if (!VectorFeatherRenderer.indicatorSoS && !indicatorGeometry) {
      return;
    }

    const { fboW, fboH, orthoProjection } = params;

    // 获取临时渲染目标
    const atlas = renderer.getTemporaryRT(
      '_FeatherAtlas', fboW, fboH, 0,
      FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
    );

    // 保存当前帧缓冲
    const prevFramebuffer = renderer.getFramebuffer();

    // === Pass 1 & 2: Indicator + Scatter → Atlas FBO ===
    renderer.setFramebuffer(atlas);
    renderer.setViewport(0, 0, fboW, fboH);
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    });

    if (VectorFeatherRenderer.indicatorSoS) {
      this.drawIndicatorSoSPass(renderer, params, new Vector2(0, 0), triangles.start, triangles.count);
    } else if (indicatorGeometry) {
      this.drawIndicatorPass(renderer, orthoProjection, indicatorGeometry, subMeshIndex);
    }
    this.drawScatterPass(renderer, params, this.featherRadius, new Vector2(0, 0), scatter.start, scatter.count);

    renderer.setFramebuffer(prevFramebuffer);
    renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());

    const atlasTexture = atlas.getColorTextures()[0];
    const layer: FeatherAtlasInfo = {
      atlasTexture,
      atlasSize: new Vector2(fboW, fboH),
      textureOffset: new Vector2(0, 0),
      textureSize: new Vector2(fboW, fboH),
      featherRadiusScreen: params.featherRadiusScreen,
      expandedRect: params.localRect,
    };

    this.drawLayerUpsample(renderer, worldMatrix, layer);
    renderer.releaseTemporaryRT(atlas);
  }

  private shiftInstanceAttributes (
    geometry: Geometry,
    layout: InstanceAttributeLayout[],
    instanceStart: number,
    strideBytes: number,
  ): void {
    const attributes = (geometry as Geometry & {
      attributes?: Record<string, { offset?: number }>,
      vaos?: Record<string, { ready: boolean } | undefined>,
    }).attributes;

    if (!attributes) {
      return;
    }

    const shift = instanceStart * strideBytes;

    for (const item of layout) {
      const attribute = attributes[item.name];

      if (attribute) {
        attribute.offset = item.baseOffset + shift;
      }
    }

    const vaos = (geometry as Geometry & {
      vaos?: Record<string, { ready: boolean } | undefined>,
    }).vaos;

    if (!vaos) {
      return;
    }

    for (const key of Object.keys(vaos)) {
      const vao = vaos[key];

      if (vao) {
        vao.ready = false;
      }
    }
  }

  /**
   * 将局部坐标 bbox 投影到屏幕像素空间，返回 [宽, 高]。
   * 用于确定 FBO 的合理分辨率，避免局部坐标远小于屏幕像素时出现马赛克。
   */
  private computeScreenExtent (
    renderer: Renderer,
    worldMatrix: Matrix4,
    minX: number, minY: number, w: number, h: number,
  ): [number, number] {
    const vpMatrix = renderer.renderingData.currentCamera.getViewProjectionMatrix();
    const mvp = new Matrix4().multiplyMatrices(vpMatrix, worldMatrix);
    const e = mvp.elements;

    const corners = [
      [minX, minY],
      [minX + w, minY],
      [minX, minY + h],
      [minX + w, minY + h],
    ];

    const screenW = renderer.getWidth();
    const screenH = renderer.getHeight();

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
   * 简化版的computeScreenExtent，用于计算屏幕空间羽化尺寸
   * 实际上计算了一个[0,0,r,r]的矩形变换后的最短边
   * @param renderer 
   * @param worldMatrix 
   * @param featherRadius 
   */
  private computeScreenRadius(
    renderer: Renderer,
    worldMatrix: Matrix4,
    featherRadius: number,
  ){
    const vpMatrix = renderer.renderingData.currentCamera.getViewProjectionMatrix();
    const mvp = new Matrix4().multiplyMatrices(vpMatrix, worldMatrix);
    const e = mvp.elements;
    const screenW = renderer.getWidth();
    const screenH = renderer.getHeight();
    // [0, 0, 0, 1]
    const ox = e[12];
    const oy = e[13];
    const ow = e[15];
    // [r, r, 0, 1]
    const rx = (e[0] + e[4]) * featherRadius + e[12];
    const ry = (e[1] + e[5]) * featherRadius + e[13];
    const rw = (e[3] + e[7]) * featherRadius + e[15];

    const osx = (ox / ow * 0.5 + 0.5) * screenW;
    const osy = (oy / ow * 0.5 + 0.5) * screenH;
    const rsx = (rx / rw * 0.5 + 0.5) * screenW;
    const rsy = (ry / rw * 0.5 + 0.5) * screenH;

    return Math.min(Math.abs(rsx - osx), Math.abs(rsy - osy));
  }

  dispose (): void {
    this.scatterGeometry?.dispose();
    this.indicatorSoSGeometry?.dispose();
    this.upsampleGeometry?.dispose();
    this.indicatorMaterial?.dispose();
    this.indicatorSoSMaterial?.dispose();
    this.scatterMaterial?.dispose();
    this.upsampleMaterial?.dispose();
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
export function getExpandedRadius(
  featherRadius: number, 
  featherRadiusScreen: number
):number {
  return featherRadius + featherRadius / featherRadiusScreen;
}