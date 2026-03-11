import type { Color } from '@galacean/effects-math/es/core/color';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Engine } from '../../engine';
import type { MaterialProps } from '../../material';
import { Material } from '../../material';
import type { Renderer } from '../../render';
import { Geometry, GLSLVersion } from '../../render';
import { FilterMode, RenderTextureFormat } from '../../render/framebuffer';
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
 * 矢量羽化渲染器
 * 实现基于下采样的 3-pass 羽化管线:
 * 1. Indicator Pass - 绘制形状指示图到离屏纹理
 * 2. Scatter (Integration) Pass - 计算边界羽化值
 * 3. Upsample Pass - 从离屏纹理采样到屏幕
 * @since 2.1.0
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
          size: 2,
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
  private updateUpsampleQuad (featherRadius: number): void {
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
   * 执行 3-pass 羽化渲染
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
    if (!this.indicatorGeometry || this.currentBbox[2] <= 0 || this.currentBbox[3] <= 0) {
      return;
    }

    const [bx, by, bw, bh] = this.currentBbox;
    const expandedW = bw + featherRadius * 2;
    const expandedH = bh + featherRadius * 2;
    const expandedMinX = bx - featherRadius;
    const expandedMinY = by - featherRadius;

    // 计算降采样倍率
    const downsample = Math.max(featherRadius / 10.0, 1.0);

    // 通过 MVP 矩阵将局部坐标 bbox 投影到屏幕像素空间，确定 FBO 分辨率
    const screenExtent = this.computeScreenExtent(
      renderer, worldMatrix,
      expandedMinX, expandedMinY, expandedW, expandedH,
    );
    const maxFboSize = 2048;
    const fboW = Math.min(Math.max(Math.ceil(screenExtent[0] / downsample), 1), maxFboSize);
    const fboH = Math.min(Math.max(Math.ceil(screenExtent[1] / downsample), 1), maxFboSize);

    // 构建正交投影矩阵 (局部坐标 → NDC)
    const orthoProjection = createOrthoMatrix(
      expandedMinX, expandedMinX + expandedW,
      expandedMinY, expandedMinY + expandedH,
    );

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

    // Pass 1: Indicator
    this.indicatorMaterial.setMatrix('uProjection', orthoProjection);
    renderer.drawGeometry(
      this.indicatorGeometry, Matrix4.IDENTITY, this.indicatorMaterial,
    );

    // Pass 2: Scatter (实例化渲染)
    this.scatterMaterial.setMatrix('uProjection', orthoProjection);
    this.scatterMaterial.setFloat('uRadius', featherRadius);
    renderer.drawGeometryInstanced(
      this.scatterGeometry, this.scatterMaterial, this.scatterInstanceCount,
    );

    // === Pass 3: Upsample → 屏幕 ===
    renderer.setFramebuffer(prevFramebuffer);
    renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());

    // 更新 upsample 四边形覆盖区域
    this.updateUpsampleQuad(featherRadius);

    // 设置 upsample 材质参数
    const atlasTexture = atlas.getColorTextures()[0];

    this.upsampleMaterial.setTexture('uAtlasTex', atlasTexture);
    this.upsampleMaterial.setVector2('uTextureSize', new Vector2(fboW, fboH));
    this.upsampleMaterial.setVector2('uAtlasSize', new Vector2(fboW, fboH));
    this.upsampleMaterial.setVector2('uTextureOffset', new Vector2(0, 0));
    this.upsampleMaterial.setVector4('uColor', new Vector4(color.r, color.g, color.b, color.a));

    // 使用世界变换矩阵绘制 upsample 四边形
    renderer.drawGeometry(
      this.upsampleGeometry, worldMatrix, this.upsampleMaterial,
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
