import type { Color } from '@galacean/effects-math/es/core/color';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { Engine } from '../../engine';
import type { Renderer } from '../../render';
import { FilterMode, RenderTextureFormat } from '../../render/framebuffer';
import { TextureLoadAction } from '../../texture';
import type { AtlasRect } from './atlas-allocator';
import { AtlasAllocator } from './atlas-allocator';
import type { FeatherRenderParams, VectorFeatherRenderer } from './vector-feather-renderer';

const MAX_ATLAS_SIZE = 4096;
const ATLAS_PADDING = 2;

/**
 * 批处理提交条目
 */
export type FeatherBatchEntry = {
  featherRenderer: VectorFeatherRenderer,
  params: FeatherRenderParams,
  worldMatrix: Matrix4,
  featherRadius: number,
  color: Color,
};

/**
 * 矢量羽化批处理管理器
 * 将多个羽化 shape 的 3-pass 管线合并为：
 *   1 次 FBO 绑定 → N 个 indicator 绘制 → N 个 scatter 绘制
 *   → 1 次 FBO 切换 → N 个 upsample 绘制
 * 从而将 2N 次 FBO 切换降低到 2 次。
 *
 * 无内部状态，由 DrawObjectPass 收集 entries 后调用 render()。
 * @since 2.1.0
 */
export class VectorFeatherBatchManager {
  private static instances = new WeakMap<Engine, VectorFeatherBatchManager>();

  static getInstance (engine: Engine): VectorFeatherBatchManager {
    let instance = VectorFeatherBatchManager.instances.get(engine);

    if (!instance) {
      instance = new VectorFeatherBatchManager();
      VectorFeatherBatchManager.instances.set(engine, instance);
    }

    return instance;
  }

  private allocator = new AtlasAllocator(1, 1);

  /**
   * 渲染给定的羽化批次条目
   */
  render (renderer: Renderer, entries: FeatherBatchEntry[]): void {
    if (entries.length === 0) {
      return;
    }

    // 单个 shape 直接走独立渲染路径（无 atlas 开销）
    if (entries.length === 1) {
      const e = entries[0];

      e.featherRenderer.render(renderer, e.worldMatrix, e.featherRadius, e.color);

      return;
    }

    // 计算 atlas 尺寸
    let maxW = 0;
    let totalArea = 0;

    for (const entry of entries) {
      maxW = Math.max(maxW, entry.params.fboW);
      totalArea += (entry.params.fboW + ATLAS_PADDING) * (entry.params.fboH + ATLAS_PADDING);
    }

    const atlasW = Math.min(Math.max(maxW, Math.ceil(Math.sqrt(totalArea))), MAX_ATLAS_SIZE);
    const atlasH = Math.min(Math.max(Math.ceil(totalArea / atlasW) * 2, maxW), MAX_ATLAS_SIZE);

    // 用 allocator 分配每个 shape 的 atlas 区域
    this.allocator = new AtlasAllocator(atlasW, atlasH);
    this.allocator.reset();

    const batched: { entry: FeatherBatchEntry, rect: AtlasRect }[] = [];
    const overflow: FeatherBatchEntry[] = [];

    for (const entry of entries) {
      const rect: AtlasRect = { x: 0, y: 0, w: 0, h: 0 };

      if (this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect)) {
        batched.push({ entry, rect });
      } else {
        overflow.push(entry);
      }
    }

    // 批量渲染分配成功的 shape
    if (batched.length > 1) {
      this.renderBatch(renderer, batched, atlasW, atlasH);
    } else if (batched.length === 1) {
      // 只有一个能放进 atlas，直接独立渲染
      const e = batched[0].entry;

      e.featherRenderer.render(renderer, e.worldMatrix, e.featherRadius, e.color);
    }

    // 溢出的 shape 逐个独立渲染
    for (const e of overflow) {
      e.featherRenderer.render(renderer, e.worldMatrix, e.featherRadius, e.color);
    }
  }

  private renderBatch (
    renderer: Renderer,
    batched: { entry: FeatherBatchEntry, rect: AtlasRect }[],
    atlasW: number,
    atlasH: number,
  ): void {
    // 获取共享 atlas FBO
    const atlas = renderer.getTemporaryRT(
      '_FeatherAtlasBatch', atlasW, atlasH, 0,
      FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
    );
    const prevFramebuffer = renderer.getFramebuffer();

    // 绑定 atlas FBO，清空一次
    renderer.setFramebuffer(atlas);
    renderer.setViewport(0, 0, atlasW, atlasH);
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    });

    // Pass 1: 所有 shape 的 Indicator
    for (const { entry, rect } of batched) {
      renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
      entry.featherRenderer.drawIndicatorPass(renderer, entry.params.orthoProjection);
    }

    // Pass 2: 所有 shape 的 Scatter
    for (const { entry, rect } of batched) {
      renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
      entry.featherRenderer.drawScatterPass(renderer, entry.params.orthoProjection, entry.featherRadius);
    }

    // 切换回屏幕 FBO
    renderer.setFramebuffer(prevFramebuffer);
    renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());

    // Pass 3: 所有 shape 的 Upsample（按提交顺序，保持混合正确性）
    const atlasTexture = atlas.getColorTextures()[0];
    const atlasSizeVec = new Vector2(atlasW, atlasH);

    for (const { entry, rect } of batched) {
      entry.featherRenderer.updateUpsampleQuad(entry.featherRadius);
      entry.featherRenderer.drawUpsamplePass(
        renderer, entry.worldMatrix, atlasTexture,
        new Vector2(rect.w, rect.h), atlasSizeVec,
        new Vector2(rect.x, rect.y), entry.color,
      );
    }

    // 释放共享 atlas
    renderer.releaseTemporaryRT(atlas);
  }
}
