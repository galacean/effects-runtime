import { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Engine } from '../../engine';
import type { MaterialProps } from '../../material';
import { Material } from '../../material';
import type { Renderer } from '../../render';
import { Geometry, GLSLVersion } from '../../render';
import { FilterMode, RenderTextureFormat } from '../../render/framebuffer';
import type { Texture } from '../../texture';
import { TextureLoadAction } from '../../texture';
import { glContext } from '../../gl';
import type { FeatherMeshData } from './feather-mesh-builder';
import indicatorVert from './shaders/feather-indicator.vert.glsl';
import indicatorFrag from './shaders/feather-indicator.frag.glsl';
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
};

/**
 * 矢量羽化渲染器
 * 实现基于下采样的 3-pass 羽化管线:
 * 1. Indicator Pass - 绘制形状指示图到离屏纹理
 * 2. Scatter (Integration) Pass - 计算边界羽化值
 * 3. Upsample Pass - 从离屏纹理采样到屏幕
 */
export class VectorFeatherRenderer {
  private engine: Engine;

  private indicatorGeometry: Geometry;
  private scatterGeometry: Geometry;
  private upsampleGeometry: Geometry;

  private indicatorMaterial: Material;
  private scatterMaterial: Material;
  private upsampleMaterial: Material;

  private meshDataDirty = true;
  private currentBbox: [number, number, number, number] = [0, 0, 0, 0];
  private scatterInstanceCount = 0;

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

    // --- 初始化空 Geometry ---
    this.indicatorGeometry = Geometry.create(engine, {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array(0),
        },
      },
      indices: { data: new Uint16Array(0) },
      mode: glContext.TRIANGLES,
      drawCount: 0,
    });

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
          stride: 2 * 4,
          offset: 0,
          dataSource: 'aEdgeData',
          instanceDivisor: 1,
        },
        aEnd: {
          type: glContext.FLOAT,
          size: 2,
          stride: 2 * 4,
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
  updateMeshData (meshData: FeatherMeshData): void {
    this.currentBbox = meshData.bbox;

    // 更新 indicator geometry
    this.indicatorGeometry.setAttributeData('aPos', meshData.indicatorVertices);
    this.indicatorGeometry.setIndexData(meshData.indicatorIndices);
    this.indicatorGeometry.setDrawCount(meshData.indicatorIndices.length);

    // 更新 scatter geometry (实例化边数据)
    this.scatterGeometry.setAttributeData('aEdgeData', meshData.scatterEdgeVertices);
    this.scatterInstanceCount = meshData.scatterEdgeCount;

    this.meshDataDirty = false;
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

    this.upsampleGeometry.setAttributeData('aPos', posData);
    this.upsampleGeometry.setAttributeData('aUV', uvData);
  }

  /**
   * 计算渲染参数（FBO 尺寸、正交投影），不执行渲染
   */
  computeRenderParams (
    renderer: Renderer,
    worldMatrix: Matrix4,
    featherRadius: number,
  ): FeatherRenderParams | null {
    if (!this.indicatorGeometry || this.currentBbox[2] <= 0 || this.currentBbox[3] <= 0) {
      return null;
    }

    const [bx, by, bw, bh] = this.currentBbox;
    const expandedW = bw + featherRadius * 2;
    const expandedH = bh + featherRadius * 2;
    const expandedMinX = bx - featherRadius;
    const expandedMinY = by - featherRadius;

    const screenExtent = this.computeScreenExtent(
      renderer, worldMatrix,
      expandedMinX, expandedMinY, expandedW, expandedH,
    );

    const featherRadiusScreen = Math.min(screenExtent[0] / expandedW, screenExtent[1] / expandedH) * featherRadius;
    const downsample = Math.max(featherRadiusScreen / 10.0, 1.0);

    const maxFboSize = 2048;
    const fboW = Math.min(Math.max(Math.ceil(screenExtent[0] / downsample), 1), maxFboSize);
    const fboH = Math.min(Math.max(Math.ceil(screenExtent[1] / downsample), 1), maxFboSize);

    const orthoProjection = createOrthoMatrix(
      expandedMinX, expandedMinX + expandedW,
      expandedMinY, expandedMinY + expandedH,
    );

    return { fboW, fboH, orthoProjection };
  }

  /**
   * 绘制 Indicator Pass（调用者需已设置好 FBO 和 viewport）
   */
  drawIndicatorPass (renderer: Renderer, orthoProjection: Matrix4): void {
    this.indicatorMaterial.setMatrix('uProjection', orthoProjection);
    renderer.drawGeometry(
      this.indicatorGeometry, Matrix4.IDENTITY, this.indicatorMaterial,
    );
  }

  /**
   * 绘制 Scatter Pass（调用者需已设置好 FBO 和 viewport）
   */
  drawScatterPass (renderer: Renderer, orthoProjection: Matrix4, featherRadius: number): void {
    this.scatterMaterial.setMatrix('uProjection', orthoProjection);
    this.scatterMaterial.setFloat('uRadius', featherRadius);
    renderer.drawGeometryInstanced(
      this.scatterGeometry, this.scatterMaterial, this.scatterInstanceCount,
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
    color: Color,
  ): void {
    this.upsampleMaterial.setTexture('uAtlasTex', atlasTexture);
    this.upsampleMaterial.setVector2('uTextureSize', textureSize);
    this.upsampleMaterial.setVector2('uAtlasSize', atlasSize);
    this.upsampleMaterial.setVector2('uTextureOffset', textureOffset);
    this.upsampleMaterial.setVector4('uColor', new Vector4(color.r, color.g, color.b, color.a));
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
  ): void {
    const params = this.computeRenderParams(renderer, worldMatrix, featherRadius);

    if (!params) {
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

    this.drawIndicatorPass(renderer, orthoProjection);
    this.drawScatterPass(renderer, orthoProjection, featherRadius);

    // === Pass 3: Upsample → 屏幕 ===
    renderer.setFramebuffer(prevFramebuffer);
    renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());

    // 更新 upsample 四边形覆盖区域
    this.updateUpsampleQuad(featherRadius);

    // 绘制 upsample
    const atlasTexture = atlas.getColorTextures()[0];

    this.drawUpsamplePass(
      renderer, worldMatrix, atlasTexture,
      new Vector2(fboW, fboH), new Vector2(fboW, fboH), new Vector2(0, 0),
      color,
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

  dispose (): void {
    this.indicatorGeometry?.dispose();
    this.scatterGeometry?.dispose();
    this.upsampleGeometry?.dispose();
    this.indicatorMaterial?.dispose();
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
