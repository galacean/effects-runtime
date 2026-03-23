import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import type { RendererComponent } from '../components';
import { ShapeComponent } from '../components';
import type { Framebuffer } from './framebuffer';
import { FilterMode, RenderTextureFormat } from './framebuffer';
import { RenderPass } from './render-pass';
import type { Renderer } from './renderer';
import { TextureLoadAction } from '../texture';
import type { AtlasRect } from '../math/shape/atlas-allocator';
import { AtlasAllocator } from '../math/shape/atlas-allocator';
import type { FeatherRenderParams, VectorFeatherRenderer } from '../math/shape/vector-feather-renderer';

const MAX_ATLAS_SIZE = 4096;
const ATLAS_PADDING = 2;

export const RenderPassPriorityFeatherOffscreen = 900;

type FeatherEntry = {
  component: ShapeComponent,
  featherRenderer: VectorFeatherRenderer,
  params: FeatherRenderParams,
  rect: AtlasRect,
};

type OverflowEntry = {
  component: ShapeComponent,
  featherRenderer: VectorFeatherRenderer,
  params: FeatherRenderParams,
  fbo: Framebuffer,
};

/**
 * FeatherOffscreenPass
 * 在 DrawObjectPass 之前执行，将所有需要羽化的 ShapeComponent
 * 的 indicator + scatter pass 渲染到共享的 atlas FBO 中。
 * atlas 信息存入每个 ShapeComponent._featherAtlasInfo，
 * 由 ShapeComponent.render() 中的 upsample 步骤消费。
 * @since 2.1.0
 */
export class FeatherOffscreenPass extends RenderPass {
  /**
   * DrawObjectPass.meshes 的实时引用（只读不写）
   */
  private readonly sharedMeshes: RendererComponent[];

  private atlas: Framebuffer | null = null;
  private batchedEntries: FeatherEntry[] = [];
  private overflowEntries: OverflowEntry[] = [];
  private allocator = new AtlasAllocator(1, 1);

  constructor (renderer: Renderer, sharedMeshes: RendererComponent[]) {
    super(renderer);
    this.sharedMeshes = sharedMeshes;
    this.priority = RenderPassPriorityFeatherOffscreen;
    this.name = 'FeatherOffscreenPass';
  }

  override configure (_renderer: Renderer): void {
    // 不需要在 configure 阶段设置 framebuffer，execute 中临时管理
  }

  override execute (renderer: Renderer): void {
    // 1. 收集需要羽化的 ShapeComponent
    const featheredComponents: {
      component: ShapeComponent,
      featherRenderer: VectorFeatherRenderer,
      params: FeatherRenderParams,
    }[] = [];

    for (const mesh of this.sharedMeshes) {
      if (mesh instanceof ShapeComponent && mesh.featherBatchable) {
        const fr = mesh.getFeatherRenderer();

        if (!fr) { continue; }
        const worldMatrix = mesh.transform.getWorldMatrix();
        const params = fr.computeRenderParams(renderer, worldMatrix, mesh.featherRadius);

        if (!params) { continue; }
        featheredComponents.push({ component: mesh, featherRenderer: fr, params });
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
    this.allocator.reset();
    this.batchedEntries = [];
    this.overflowEntries = [];

    for (const entry of featheredComponents) {
      const rect: AtlasRect = { x: 0, y: 0, w: 0, h: 0 };

      if (this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect)) {
        this.batchedEntries.push({ ...entry, rect });
      } else {
        // 溢出：分配独立 FBO
        const fbo = renderer.getTemporaryRT(
          '_FeatherOverflow', entry.params.fboW, entry.params.fboH, 0,
          FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
        );

        this.overflowEntries.push({ ...entry, fbo });
      }
    }

    const prevFramebuffer = renderer.getFramebuffer();

    // 3. 批量渲染到共享 atlas
    if (this.batchedEntries.length > 0) {
      this.atlas = renderer.getTemporaryRT(
        '_FeatherAtlas', atlasW, atlasH, 0,
        FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
      );
      renderer.setFramebuffer(this.atlas);
      renderer.setViewport(0, 0, atlasW, atlasH);
      renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });

      // Indicator pass
      for (const { featherRenderer, params, rect } of this.batchedEntries) {
        renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
        featherRenderer.drawIndicatorPass(renderer, params.orthoProjection);
      }
      // Scatter pass
      for (const { featherRenderer, params, rect, component } of this.batchedEntries) {
        renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
        featherRenderer.drawScatterPass(renderer, params.orthoProjection, component.featherRadius);
      }

      // 存储 atlas 信息到每个 ShapeComponent
      const atlasTexture = this.atlas.getColorTextures()[0];
      const atlasSizeVec = new Vector2(atlasW, atlasH);

      for (const { component, rect } of this.batchedEntries) {
        component._featherAtlasInfo = {
          atlasTexture,
          atlasSize: atlasSizeVec,
          textureOffset: new Vector2(rect.x, rect.y),
          textureSize: new Vector2(rect.w, rect.h),
        };
      }
    }

    // 4. 渲染溢出的 shape 到独立 FBO
    for (const entry of this.overflowEntries) {
      renderer.setFramebuffer(entry.fbo);
      renderer.setViewport(0, 0, entry.params.fboW, entry.params.fboH);
      renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });
      entry.featherRenderer.drawIndicatorPass(renderer, entry.params.orthoProjection);
      entry.featherRenderer.drawScatterPass(renderer, entry.params.orthoProjection, entry.component.featherRadius);

      const tex = entry.fbo.getColorTextures()[0];

      entry.component._featherAtlasInfo = {
        atlasTexture: tex,
        atlasSize: new Vector2(entry.params.fboW, entry.params.fboH),
        textureOffset: new Vector2(0, 0),
        textureSize: new Vector2(entry.params.fboW, entry.params.fboH),
      };
    }

    // 5. 恢复 framebuffer
    renderer.setFramebuffer(prevFramebuffer);
    if (prevFramebuffer) {
      const vp = prevFramebuffer.viewport;

      renderer.setViewport(vp[0], vp[1], vp[2], vp[3]);
    } else {
      renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());
    }
  }

  override onCameraCleanup (renderer: Renderer): void {
    // 释放 atlas FBO
    if (this.atlas) {
      renderer.releaseTemporaryRT(this.atlas);
      this.atlas = null;
    }
    // 释放溢出 FBO
    for (const entry of this.overflowEntries) {
      renderer.releaseTemporaryRT(entry.fbo);
    }
    // 清空所有 ShapeComponent 的 atlas 信息
    for (const { component } of this.batchedEntries) {
      component._featherAtlasInfo = null;
    }
    for (const entry of this.overflowEntries) {
      entry.component._featherAtlasInfo = null;
    }
    this.batchedEntries = [];
    this.overflowEntries = [];
  }
}
