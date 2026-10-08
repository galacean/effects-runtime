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

  private currentBbox: [number, number, number, number] = [0, 0, 0, 0];
  private expandedRect: [number, number, number, number] = [0, 0, 0, 0];
  private scatterInstanceCount = 0;
  private indicatorTriangleCount = 0;

  /**
   * 羽化半径（局部坐标空间），0 表示不启用羽化
   */
  featherRadius = 0;

  /**
   * 羽化颜色，默认使用第一个 fill 的颜色
   */
  featherColor: Color = new Color(1, 1, 1, 1);

  /**
   * @internal
   * 由 FeatherOffscreenPass 每帧设置，render() 中用于绘制 upsample
   */
  atlasInfo: FeatherAtlasInfo | null = null;

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
    scatterEdgeVertices: number[],
    scatterEdgeCount: number,
    bbox: [number, number, number, number],
    indicatorTriangles: number[],
    indicatorTriangleCount: number,
  ): void {
    this.currentBbox = bbox;

    // 更新 scatter geometry (实例化边数据)
    this.scatterGeometry.setAttributeData('aEdgeData', new Float32Array(scatterEdgeVertices));
    this.scatterInstanceCount = scatterEdgeCount;
    this.indicatorSoSGeometry.setAttributeData('aTriangleData', new Float32Array(indicatorTriangles));
    this.indicatorTriangleCount = indicatorTriangleCount;
  }

  /**
   * 更新 upsample 四边形，覆盖 bbox + feather 区域
   */
  updateUpsampleQuad (featherRadius: number): void {
    const [bx, by, bw, bh] = this.currentBbox;
    const minX = bx - featherRadius;
    const minY = by - featherRadius;
    const maxX = bx + bw + featherRadius;
    const maxY = by + bh + featherRadius;

    const posData = new Float32Array([
      minX, maxY, 0,   // 左上
      minX, minY, 0,   // 左下
      maxX, maxY, 0,   // 右上
      maxX, minY, 0,   // 右下
    ]);
    const uvData = new Float32Array([
      0, 1,   // 左上
      0, 0,   // 左下
      1, 1,   // 右上
      1, 0,   // 右下
    ]);

    this.expandedRect = [minX, minY, maxX - minX, maxY - minY];
    this.upsampleGeometry.setAttributeData('aPos', posData);
    this.upsampleGeometry.setAttributeData('aUV', uvData);
  }

  /**
   * 计算渲染参数（FBO 尺寸、正交投影），不执行渲染
   */
  computeRenderParams (
    renderer: Renderer,
    worldMatrix: Matrix4,
    setFeatherRadius: number,
  ): FeatherRenderParams | null {
    if (this.currentBbox[2] <= 0 || this.currentBbox[3] <= 0) {
      return null;
    }
    // 这里计算屏幕radius。
    const featherRadiusScreen = this.computeScreenRadius(
      renderer, worldMatrix, setFeatherRadius
    );  
    // 羽化半径至少要有1px，否则只会导致一些奇奇怪怪的锯齿（当使用1px羽化时，表现为抗锯齿效果）。
    const refinedScreenRadius = Math.max(featherRadiusScreen, 1.0);
    // 这里传递回去修改原始羽化
    this.featherRadius = setFeatherRadius * refinedScreenRadius / Math.max(featherRadiusScreen, 0.0001);

    // 包围盒向外扩展一个像素，避免半径太小的时候由于光栅化误差缺像素。
    const expandRadius = getExpandedRadius(this.featherRadius, refinedScreenRadius);  
    const [bx, by, bw, bh] = this.currentBbox;
    const expandedW = bw + expandRadius * 2;
    const expandedH = bh + expandRadius * 2;
    const expandedMinX = bx - expandRadius;
    const expandedMinY = by - expandRadius;

    const screenExtent = this.computeScreenExtent(
      renderer, worldMatrix,
      expandedMinX, expandedMinY, expandedW, expandedH,
    );

    const downsample = Math.min(Math.max(refinedScreenRadius / 10.0, 1.0), 9999);  // rive似乎限制它们的降采样最大为32

    const maxFboSize = 2048;
    const fboW = Math.min(Math.max(Math.ceil(screenExtent[0] / downsample), 1), maxFboSize);   // 这里表明实际降采样未必是计算的downsample...
    const fboH = Math.min(Math.max(Math.ceil(screenExtent[1] / downsample), 1), maxFboSize);

    const orthoProjection = createOrthoMatrix(
      expandedMinX, expandedMinX + expandedW,
      expandedMinY, expandedMinY + expandedH,
    );

    return { 
      fboW:fboW, 
      fboH:fboH, 
      orthoProjection:orthoProjection,
      featherRadiusScreen:refinedScreenRadius, // 注意这里传修改后的
      localRect: [expandedMinX, expandedMinY, expandedW, expandedH] };
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
   */
  drawIndicatorSoSPass (
    renderer: Renderer,
    params: FeatherRenderParams,
    viewportOffset: Vector2,
  ): void {
    const [minX, minY, localW, localH] = params.localRect;
    const localPerPixelX = localW / params.fboW;
    const localPerPixelY = localH / params.fboH;

    this.indicatorSoSMaterial.setMatrix('uProjection', params.orthoProjection);
    this.indicatorSoSMaterial.setVector2('uViewportOffset', viewportOffset);
    this.indicatorSoSMaterial.setVector2('uPixelOrigin', new Vector2(minX, minY));
    this.indicatorSoSMaterial.setVector2('uSpacePerPixel', new Vector2(localPerPixelX, localPerPixelY));
    renderer.drawGeometryInstanced(
      this.indicatorSoSGeometry, this.indicatorSoSMaterial, this.indicatorTriangleCount,
    );
  }

  /**
   * 绘制 Scatter Pass（调用者需已设置好 FBO 和 viewport）。
   * 片元用 gl_FragCoord 反算局部空间像素中心，再用端点直接积分。
   * @param viewportOffset - 当前 viewport 在 atlas 中的起点（整数像素）
   */
  drawScatterPass (
    renderer: Renderer,
    params: FeatherRenderParams,
    featherRadius: number,
    viewportOffset: Vector2,
  ): void {
    const [minX, minY, localW, localH] = params.localRect;
    const localPerPixelX = localW / params.fboW;
    const localPerPixelY = localH / params.fboH;

    this.scatterMaterial.setMatrix('uProjection', params.orthoProjection);
    this.scatterMaterial.setFloat('uCoverRadius', featherRadius + Math.max(localPerPixelX, localPerPixelY));
    this.scatterMaterial.setVector2('uViewportOffset', viewportOffset);
    this.scatterMaterial.setVector2('uPixelOrigin', new Vector2(minX, minY));
    this.scatterMaterial.setVector2('uSpacePerPixel', new Vector2(localPerPixelX, localPerPixelY));
    this.scatterMaterial.setFloat('uRadius', featherRadius);
    renderer.drawGeometryInstanced(this.scatterGeometry, this.scatterMaterial, this.scatterInstanceCount);
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
    const [gradientMinX, gradientMinY, gradientWidth, gradientHeight] = this.currentBbox;
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
   * @param renderer - 渲染器
   * @param worldMatrix - 世界变换矩阵
   * @param featherRadius - 羽化半径（局部坐标空间）
   * @param color - 羽化颜色
   */
  render (
    renderer: Renderer,
    worldMatrix: Matrix4,
    featherRadius: number,
    color: Color,
    indicatorGeometry?: Geometry,
    indicatorSubMeshIndex = 0,
  ): void {
    const params = this.computeRenderParams(renderer, worldMatrix, featherRadius);

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
      this.drawIndicatorSoSPass(renderer, params, new Vector2(0, 0));
    } else if (indicatorGeometry) {
      this.drawIndicatorPass(renderer, orthoProjection, indicatorGeometry, indicatorSubMeshIndex);
    }
    this.drawScatterPass(renderer, params, this.featherRadius, new Vector2(0, 0));
    // === Pass 3: Upsample → 屏幕 ===
    renderer.setFramebuffer(prevFramebuffer);
    renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());

    // 更新 upsample 四边形覆盖区域
    this.updateUpsampleQuad(getExpandedRadius(this.featherRadius, params.featherRadiusScreen));

    // 绘制 upsample。这条路径只有纯色，渐变由 ShapeComponent 在绘制前写入。
    const atlasTexture = atlas.getColorTextures()[0];

    this.upsampleMaterial.setFloat('_FillType', 0);
    this.upsampleMaterial.color = color;
    this.drawUpsamplePass(
      renderer, worldMatrix, atlasTexture,
      new Vector2(fboW, fboH), new Vector2(fboW, fboH), new Vector2(0, 0),
      params.featherRadiusScreen,
    );

    // 释放临时渲染目标
    renderer.releaseTemporaryRT(atlas);
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