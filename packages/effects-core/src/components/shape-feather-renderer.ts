import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Engine } from '../engine';
import { Material } from '../material';
import type { Renderer } from '../render';
import { GLSLVersion, Geometry } from '../render';
import { FilterMode, RenderTextureFormat } from '../render';
import { TextureLoadAction } from '../texture';
import { glContext } from '../gl';
import { screenMeshVert } from '../shader';
import shapeBlurHFrag from '../math/shape/shaders/shape-blur-h.frag.glsl';
import shapeBlurVFrag from '../math/shape/shaders/shape-blur-v.frag.glsl';
import featherOutputVert from '../math/shape/shaders/shape-feather-output.vert.glsl';
import featherOutputFrag from '../math/shape/shaders/shape-feather-output.frag.glsl';

export interface ShapeFeatherBounds {
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
}

/**
 * Shape 高斯模糊羽化渲染器
 * 负责将 shape 渲染到临时 FBO，执行高斯模糊，然后 blit 到默认缓冲区
 * @since 2.9.0
 */
export class ShapeFeatherRenderer {
  private static readonly maxKernelRadius = 6;
  private static readonly maxDownsampleLevels = 6;

  private blurHMaterial: Material;
  private blurVMaterial: Material;
  private outputMaterial: Material;
  private outputGeometry: Geometry;
  private disposed = false;

  constructor (private engine: Engine) {
    // 水平模糊材质
    this.blurHMaterial = Material.create(engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: shapeBlurHFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });
    this.blurHMaterial.blending = false;
    this.blurHMaterial.depthTest = false;
    this.blurHMaterial.culling = false;

    // 垂直模糊材质
    this.blurVMaterial = Material.create(engine, {
      shader: {
        vertex: screenMeshVert,
        fragment: shapeBlurVFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });
    this.blurVMaterial.blending = false;
    this.blurVMaterial.depthTest = false;
    this.blurVMaterial.culling = false;

    // 输出材质（带 premultiplied alpha blending）
    this.outputMaterial = Material.create(engine, {
      shader: {
        vertex: featherOutputVert,
        fragment: featherOutputFrag,
        glslVersion: GLSLVersion.GLSL1,
      },
    });
    this.outputMaterial.blending = true;
    this.outputMaterial.depthTest = false;
    this.outputMaterial.culling = false;

    // 输出矩形面片：[0,1] 范围的两个三角形
    this.outputGeometry = Geometry.create(engine, {
      mode: glContext.TRIANGLE_STRIP,
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array([0, 1, 0, 0, 1, 1, 1, 0]),
        },
      },
      drawCount: 4,
    });
  }

  /**
   * 以高斯模糊羽化方式渲染 shape
   * @param renderer - 渲染器
   * @param featherRadius - 羽化半径（屏幕像素）
    * @param iterationCount - 多层 down/up 采样最小层数
   * @param drawCallback - 绘制 shape 的回调
   * @param worldMatrix - shape 的世界变换矩阵
   * @param bounds - shape 的局部空间 AABB
   */
  renderFeathered (
    renderer: Renderer,
    featherRadius: number,
    iterationCount: number,
    drawCallback: (renderer: Renderer) => void,
    worldMatrix: Matrix4,
    bounds: ShapeFeatherBounds,
  ): void {
    const camera = renderer.renderingData.currentCamera;
    const vpMatrix = camera.getViewProjectionMatrix();
    const screenWidth = renderer.getWidth();
    const screenHeight = renderer.getHeight();

    // Step 1: 计算 shape 在屏幕空间的 AABB
    const mvpMatrix = new Matrix4().multiplyMatrices(vpMatrix, worldMatrix);
    const screenBounds = this.projectBoundsToScreen(mvpMatrix, bounds, screenWidth, screenHeight);

    // 向外扩展 featherRadius 作为 padding
    const padding = Math.ceil(featherRadius);

    screenBounds.minX = Math.max(0, Math.floor(screenBounds.minX) - padding);
    screenBounds.minY = Math.max(0, Math.floor(screenBounds.minY) - padding);
    screenBounds.maxX = Math.min(screenWidth, Math.ceil(screenBounds.maxX) + padding);
    screenBounds.maxY = Math.min(screenHeight, Math.ceil(screenBounds.maxY) + padding);

    const rtWidth = screenBounds.maxX - screenBounds.minX;
    const rtHeight = screenBounds.maxY - screenBounds.minY;

    if (rtWidth <= 0 || rtHeight <= 0) {
      return;
    }

    // 保存当前状态
    const prevFramebuffer = renderer.getFramebuffer();

    // Step 2: 在临时 FBO 中绘制 shape
    const shapeRT = renderer.getTemporaryRT('ShapeFeather', rtWidth, rtHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBA32);

    renderer.setFramebuffer(shapeRT);
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    });

    // 构建一个自定义的 VP 矩阵，将世界空间映射到 FBO 的视口区域
    // FBO 对应屏幕上的 [screenBounds.minX, screenBounds.minY, rtWidth, rtHeight]
    // 需要从原始 VP 变换中截取这个区域
    const ndcMinX = (screenBounds.minX / screenWidth) * 2.0 - 1.0;
    const ndcMinY = (screenBounds.minY / screenHeight) * 2.0 - 1.0;
    const ndcMaxX = (screenBounds.maxX / screenWidth) * 2.0 - 1.0;
    const ndcMaxY = (screenBounds.maxY / screenHeight) * 2.0 - 1.0;

    const ndcW = ndcMaxX - ndcMinX;
    const ndcH = ndcMaxY - ndcMinY;
    const ndcCenterX = (ndcMinX + ndcMaxX) / 2.0;
    const ndcCenterY = (ndcMinY + ndcMaxY) / 2.0;

    // 构建裁剪矩阵：将 [ndcMinX..ndcMaxX, ndcMinY..ndcMaxY] 映射到 [-1..1, -1..1]
    // scale = 2/ndcW, 2/ndcH; translate = -ndcCenterX * scaleX, -ndcCenterY * scaleY
    const cropMatrix = new Matrix4(
      2.0 / ndcW, 0, 0, 0,
      0, 2.0 / ndcH, 0, 0,
      0, 0, 1, 0,
      -ndcCenterX * (2.0 / ndcW), -ndcCenterY * (2.0 / ndcH), 0, 1,
    );

    // 新的 VP = cropMatrix * originalVP
    const croppedVP = new Matrix4().multiplyMatrices(cropMatrix, vpMatrix);

    renderer.setGlobalMatrix('effects_MatrixVP', croppedVP);

    drawCallback(renderer);

    // 恢复原来的 VP 矩阵
    renderer.setGlobalMatrix('effects_MatrixVP', vpMatrix);

    // Step 3: 多层降采样仅用于线性过滤加速，真正的模糊仍在最小层执行 separable gaussian
    const requestedDownsample = Math.max(1, Math.ceil(featherRadius / ShapeFeatherRenderer.maxKernelRadius));
    const downsampleLevelCount = this.resolveDownsampleLevelCount(requestedDownsample, iterationCount, rtWidth, rtHeight);
    const retainedRTs = [shapeRT];
    const downsampleRTs = [shapeRT];
    let blurRT = shapeRT;

    for (let i = 0; i < downsampleLevelCount; i++) {
      const sourceTexture = blurRT.getColorTextures()[0];
      const nextWidth = Math.max(1, Math.ceil(sourceTexture.getWidth() / 2));
      const nextHeight = Math.max(1, Math.ceil(sourceTexture.getHeight() / 2));
      const downsampleRT = renderer.getTemporaryRT(`ShapeFeatherDS${i}`, nextWidth, nextHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBA32);

      renderer.blit(sourceTexture, downsampleRT);
      retainedRTs.push(downsampleRT);
      downsampleRTs.push(downsampleRT);
      blurRT = downsampleRT;
    }

    const actualDownsample = Math.max(1, shapeRT.getColorTextures()[0].getWidth() / blurRT.getColorTextures()[0].getWidth());
    const dsWidth = blurRT.getColorTextures()[0].getWidth();
    const dsHeight = blurRT.getColorTextures()[0].getHeight();
    const effectiveRadius = featherRadius / actualDownsample;

    const texSize = new Vector2(dsWidth, dsHeight);
    const tempRT = renderer.getTemporaryRT('ShapeFeatherBlur', dsWidth, dsHeight, 0, FilterMode.Linear, RenderTextureFormat.RGBA32);

    this.blurHMaterial.setVector2('_TextureSize', texSize);
    this.blurHMaterial.setFloat('_BlurRadius', effectiveRadius);
    renderer.blit(blurRT.getColorTextures()[0], tempRT, this.blurHMaterial);

    this.blurVMaterial.setVector2('_TextureSize', texSize);
    this.blurVMaterial.setFloat('_BlurRadius', effectiveRadius);
    renderer.blit(tempRT.getColorTextures()[0], blurRT, this.blurVMaterial);

    renderer.releaseTemporaryRT(tempRT);

    // Step 4: 渐进式上采样回更高分辨率，只做线性重建，不与各层内容混合，避免 bloom 式中心增强
    for (let i = downsampleRTs.length - 2; i >= 0; i--) {
      const upsampleSource = downsampleRTs[i].getColorTextures()[0];
      const upsampleRT = renderer.getTemporaryRT(`ShapeFeatherUS${i}`, upsampleSource.getWidth(), upsampleSource.getHeight(), 0, FilterMode.Linear, RenderTextureFormat.RGBA32);

      renderer.blit(blurRT.getColorTextures()[0], upsampleRT);
      retainedRTs.push(upsampleRT);
      blurRT = upsampleRT;
    }

    // Step 5: 输出到默认缓冲区
    renderer.setFramebuffer(prevFramebuffer);

    // 计算输出矩形在 NDC 空间中的位置
    const screenRect = new Vector4(ndcMinX, ndcMinY, ndcW, ndcH);

    this.outputMaterial.setTexture('_MainTex', blurRT.getColorTextures()[0]);
    this.outputMaterial.setVector4('_ScreenRect', screenRect);

    const identity = Matrix4.IDENTITY;

    renderer.drawGeometry(this.outputGeometry, identity, this.outputMaterial);

    for (const rt of retainedRTs) {
      renderer.releaseTemporaryRT(rt);
    }
  }

  dispose (): void {
    if (this.disposed) {
      return;
    }
    this.blurHMaterial.dispose();
    this.blurVMaterial.dispose();
    this.outputMaterial.dispose();
    this.outputGeometry.dispose();
    this.disposed = true;
  }

  /**
   * 将局部空间 AABB 投影到屏幕像素坐标
   */
  private projectBoundsToScreen (
    mvpMatrix: Matrix4,
    bounds: ShapeFeatherBounds,
    screenWidth: number,
    screenHeight: number,
  ): { minX: number, minY: number, maxX: number, maxY: number } {
    // AABB 的 4 个角点
    const corners = [
      new Vector4(bounds.minX, bounds.minY, 0, 1),
      new Vector4(bounds.maxX, bounds.minY, 0, 1),
      new Vector4(bounds.minX, bounds.maxY, 0, 1),
      new Vector4(bounds.maxX, bounds.maxY, 0, 1),
    ];

    let sMinX = Number.MAX_VALUE;
    let sMinY = Number.MAX_VALUE;
    let sMaxX = -Number.MAX_VALUE;
    let sMaxY = -Number.MAX_VALUE;

    for (const corner of corners) {
      const clip = this.transformVec4(mvpMatrix, corner);

      if (clip.w <= 0) {
        continue;
      }

      // NDC
      const ndcX = clip.x / clip.w;
      const ndcY = clip.y / clip.w;

      // Screen pixels
      const sx = (ndcX + 1.0) * 0.5 * screenWidth;
      const sy = (ndcY + 1.0) * 0.5 * screenHeight;

      sMinX = Math.min(sMinX, sx);
      sMinY = Math.min(sMinY, sy);
      sMaxX = Math.max(sMaxX, sx);
      sMaxY = Math.max(sMaxY, sy);
    }

    return { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY };
  }

  private transformVec4 (m: Matrix4, v: Vector4): Vector4 {
    const e = m.elements;
    const x = v.x, y = v.y, z = v.z, w = v.w;

    return new Vector4(
      e[0] * x + e[4] * y + e[8] * z + e[12] * w,
      e[1] * x + e[5] * y + e[9] * z + e[13] * w,
      e[2] * x + e[6] * y + e[10] * z + e[14] * w,
      e[3] * x + e[7] * y + e[11] * z + e[15] * w,
    );
  }

  private resolveDownsampleLevelCount (downsample: number, iterationCount: number, width: number, height: number): number {
    const requestedLevelCount = Math.max(0, Math.floor(iterationCount));
    let remainingDownsample = downsample;
    let currentWidth = width;
    let currentHeight = height;
    let levelCount = 0;

    while (
      remainingDownsample > 1
      && levelCount < ShapeFeatherRenderer.maxDownsampleLevels
      && (currentWidth > 1 || currentHeight > 1)
    ) {
      const nextWidth = Math.max(1, Math.ceil(currentWidth / 2));
      const nextHeight = Math.max(1, Math.ceil(currentHeight / 2));

      if (nextWidth === currentWidth && nextHeight === currentHeight) {
        break;
      }

      currentWidth = nextWidth;
      currentHeight = nextHeight;
      remainingDownsample = Math.ceil(remainingDownsample / 2);
      levelCount++;
    }

    return Math.min(
      ShapeFeatherRenderer.maxDownsampleLevels,
      Math.max(requestedLevelCount, levelCount),
    );
  }
}

/**
 * 创建 ShapeFeatherRenderer 实例的工厂函数
 */
export function createShapeFeatherRenderer (engine: Engine): ShapeFeatherRenderer {
  return new ShapeFeatherRenderer(engine);
}
