import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { ShapeComponent } from '../components';
import type { Framebuffer } from './framebuffer';
import { FilterMode, RenderTextureFormat } from './framebuffer';
import { RenderPass, RenderPassPriorityFeatherOffscreen } from './render-pass';
import type { Renderer } from './renderer';
import { TextureLoadAction } from '../texture';
import type { AtlasRect } from '../math/shape/atlas-allocator';
import { AtlasAllocator } from '../math/shape/atlas-allocator';
import type { FeatherRenderParams, VectorFeatherRenderer } from '../math/shape/vector-feather-renderer';

const MAX_ATLAS_SIZE = 4096;
const ATLAS_PADDING = 2;

type FeatherEntry = {
  featherRenderer: VectorFeatherRenderer,
  params: FeatherRenderParams,
  atlas: Framebuffer,
  rect: AtlasRect,
};

/**
 * FeatherOffscreenPass
 * 在 DrawObjectPass 之前执行，将所有需要羽化的 ShapeComponent
 * 的 indicator + scatter pass 渲染到共享的 atlas FBO 中。
 * atlas 信息存入每个 VectorFeatherRenderer.atlasInfo，
 * 由 ShapeComponent.render() 中的 upsample 步骤消费。
 */
export class FeatherOffscreenPass extends RenderPass {

  private entries: FeatherEntry[] = [];
  private allocator = new AtlasAllocator(1, 1);

  constructor (renderer: Renderer) {
    super(renderer);
    this.priority = RenderPassPriorityFeatherOffscreen;
    this.name = 'FeatherOffscreenPass';
  }

  override configure (_renderer: Renderer): void {
    // 不需要在 configure 阶段设置 framebuffer，execute 中临时管理
  }

  override execute (renderer: Renderer): void {
    // 1. 收集需要羽化的 ShapeComponent
    const featheredComponents: {
      featherRenderer: VectorFeatherRenderer,
      params: FeatherRenderParams,
    }[] = [];

    const renderList = renderer.renderingData.currentFrame.renderList;

    for (const mesh of renderList) {
      if (mesh instanceof ShapeComponent && mesh.featherRenderer.featherRadius > 0) {
        const fr = mesh.featherRenderer;
        const worldMatrix = mesh.transform.getWorldMatrix();
        const params = fr.computeRenderParams(renderer, worldMatrix, fr.featherRadius);

        if (!params) { continue; }
        featheredComponents.push({ featherRenderer: fr, params });
      }
    }

    if (featheredComponents.length === 0) {
      return;
    }

    // 2. 计算 atlas 布局
    let maxW = 0;
    let totalArea = 0;

    for (const { params } of featheredComponents) {
      maxW = Math.max(maxW, params.fboW);
      totalArea += (params.fboW + ATLAS_PADDING) * (params.fboH + ATLAS_PADDING);
    }

    const atlasW = Math.min(Math.max(maxW, Math.ceil(Math.sqrt(totalArea))), MAX_ATLAS_SIZE);
    const atlasH = Math.min(Math.max(Math.ceil(totalArea / atlasW) * 2, maxW), MAX_ATLAS_SIZE);

    this.allocator = new AtlasAllocator(atlasW, atlasH);
    this.entries = [];

    const prevFramebuffer = renderer.getFramebuffer();
    let currentAtlas: Framebuffer | null = null;

    // 辅助函数：渲染当前队列
    const flushCurrentBatch = () => {
      if (this.entries.length === 0 || !currentAtlas) { return; }

      renderer.setFramebuffer(currentAtlas);
      renderer.setViewport(0, 0, atlasW, atlasH);
      renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });

      for (const { featherRenderer, params, rect } of this.entries) {
        renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
        featherRenderer.drawIndicatorPass(renderer, params.orthoProjection);
        featherRenderer.drawScatterPass(renderer, params.orthoProjection, featherRenderer.featherRadius);

        featherRenderer.atlasInfo = {
          atlasTexture: currentAtlas.getColorTextures()[0],
          atlasSize: new Vector2(atlasW, atlasH),
          textureOffset: new Vector2(rect.x, rect.y),
          textureSize: new Vector2(rect.w, rect.h),
        };
      }
    };

    // 3. 分配并渲染
    for (const entry of featheredComponents) {
      const rect: AtlasRect = { x: 0, y: 0, w: 0, h: 0 };

      if (this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect)) {
        // 当前 atlas 可以容纳
        if (!currentAtlas) {
          currentAtlas = renderer.getTemporaryRT(
            '_FeatherAtlas', atlasW, atlasH, 0,
            FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
          );
        }
        this.entries.push({ ...entry, atlas: currentAtlas, rect });
      } else {
        // 溢出：先渲染当前队列
        flushCurrentBatch();

        // 重置并创建新 atlas
        this.allocator.reset();
        this.entries = [];
        currentAtlas = renderer.getTemporaryRT(
          '_FeatherAtlas', atlasW, atlasH, 0,
          FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
        );

        this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect);
        this.entries.push({ ...entry, atlas: currentAtlas, rect });
      }
    }

    // 渲染最后一批
    flushCurrentBatch();

    // 4. 恢复 framebuffer
    renderer.setFramebuffer(prevFramebuffer);
    if (prevFramebuffer) {
      const vp = prevFramebuffer.viewport;

      renderer.setViewport(vp[0], vp[1], vp[2], vp[3]);
    } else {
      renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());
    }
  }

  override onCameraCleanup (renderer: Renderer): void {
    for (const { featherRenderer, atlas } of this.entries) {
      renderer.releaseTemporaryRT(atlas);
      featherRenderer.atlasInfo = null;
    }

    this.entries = [];
  }
}