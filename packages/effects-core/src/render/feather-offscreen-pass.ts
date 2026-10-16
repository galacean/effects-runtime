import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { ShapeComponent } from '../plugins/shape/shape-component';
import type { GPUFramebuffer } from './gpu-framebuffer';
import { FilterMode, RenderTextureFormat } from './gpu-framebuffer';
import { RenderPass, RenderPassEvent } from './render-pass';
import type { Renderer } from './renderer';
import type { RenderingData } from './rendering-data';
import { TextureLoadAction } from '../texture';
import type { AtlasRect } from '../math/shape/atlas-allocator';
import { AtlasAllocator } from '../math/shape/atlas-allocator';
import type { FeatherRenderParams, FeatherSide } from '../math/shape/vector-feather-renderer';
import { FEATHER_SIDES, VectorFeatherRenderer } from '../math/shape/vector-feather-renderer';

const MAX_ATLAS_SIZE = 4096;
const ATLAS_PADDING = 2;

type PendingFeatherEntry = {
  featherRenderer: VectorFeatherRenderer,
  side: FeatherSide,
  params: FeatherRenderParams,
};

type FeatherEntry = PendingFeatherEntry & {
  atlas: GPUFramebuffer,
  rect: AtlasRect,
};

/**
 * FeatherOffscreenPass
 * 在 DrawObjectPass 之前执行，将需要羽化的填充和描边
 * 分别渲染到 atlas 中互不重叠的区域。
 * 结果写入 VectorFeatherRenderer.atlasLayers，由 renderer 完成合成上色。
 */
export class FeatherOffscreenPass extends RenderPass {

  private entries: FeatherEntry[] = [];
  private allocator = new AtlasAllocator(1, 1);

  constructor (renderer: Renderer) {
    super(renderer);
    this.renderPassEvent = RenderPassEvent.BeforeRendering;
    this.name = 'FeatherOffscreenPass';
  }

  hasFeatheredShapes (data: RenderingData): boolean {
    return data.renderList.objects.some(mesh => mesh instanceof ShapeComponent && mesh.featherRenderer.enabled);
  }

  override execute (renderer: Renderer, data: RenderingData): void {
    const pending: PendingFeatherEntry[] = [];
    const renderList = data.renderList.objects;

    for (const mesh of renderList) {
      if (!(mesh instanceof ShapeComponent) || !mesh.featherRenderer.enabled) {
        continue;
      }

      const featherRenderer = mesh.featherRenderer;
      const worldMatrix = mesh.transform.getWorldMatrix();
      const prepared = featherRenderer.prepareFeatherRadius(renderer, worldMatrix, featherRenderer.featherRadius);

      featherRenderer.atlasLayers = { fill: null, stroke: null };

      for (const side of FEATHER_SIDES) {
        if (!featherRenderer.layerHasContent(side)) {
          continue;
        }

        const params = featherRenderer.createLayerParams(
          renderer, worldMatrix, featherRenderer.layerBBox(side), prepared,
        );

        if (!params) {
          continue;
        }

        pending.push({ featherRenderer, side, params });
      }
    }

    if (pending.length === 0) {
      return;
    }

    let maxW = 0;
    let maxH = 0;
    let totalArea = 0;

    for (const { params } of pending) {
      maxW = Math.max(maxW, params.fboW);
      maxH = Math.max(maxH, params.fboH);
      totalArea += (params.fboW + ATLAS_PADDING) * (params.fboH + ATLAS_PADDING);
    }

    const maxAtlasSize = Math.min(MAX_ATLAS_SIZE, renderer.engine.displayServer.renderingDevice.gpuCapability.detail.maxTextureSize);
    const atlasW = Math.min(Math.max(maxW, Math.ceil(Math.sqrt(totalArea))), maxAtlasSize);
    const atlasH = Math.min(Math.max(Math.ceil(totalArea / atlasW) * 2, maxH), maxAtlasSize);

    this.allocator = new AtlasAllocator(atlasW, atlasH);
    this.entries = [];

    const prevFramebuffer = renderer.getFramebuffer();
    const prevViewport = renderer.getViewport();
    let currentAtlas: GPUFramebuffer | null = null;
    let batchStart = 0;

    const createAtlas = () => renderer.getTemporaryRT(
      '_FeatherAtlas', atlasW, atlasH, 0,
      FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
      1, // 禁用各向异性过滤。upsample 用 texture2D 模拟 texelFetch，必须关闭各向异性。
    );

    const flushCurrentBatch = () => {
      const atlas = currentAtlas;
      const batch = this.entries.slice(batchStart);

      if (batch.length === 0 || !atlas) {
        return;
      }

      renderer.setFramebuffer(atlas);
      renderer.setViewport(0, 0, atlasW, atlasH);
      renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });

      for (const { featherRenderer, side, params, rect } of batch) {
        const viewportOffset = new Vector2(rect.x, rect.y);

        renderer.setViewport(rect.x, rect.y, rect.w, rect.h);

        if (VectorFeatherRenderer.indicatorSoS) {
          featherRenderer.drawIndicatorSoSPass(renderer, params, viewportOffset, side);
        } else {
          featherRenderer.drawIndicatorPass(renderer, params.orthoProjection, side);
        }

        featherRenderer.drawScatterPass(renderer, params, viewportOffset, side);

        const layers = featherRenderer.atlasLayers ?? { fill: null, stroke: null };

        layers[side] = {
          atlasTexture: atlas.getColorTextures()[0],
          atlasSize: new Vector2(atlasW, atlasH),
          textureOffset: viewportOffset,
          textureSize: new Vector2(rect.w, rect.h),
          expandedRect: params.localRect,
        };
        featherRenderer.atlasLayers = layers;
      }
    };

    for (const entry of pending) {
      const rect: AtlasRect = { x: 0, y: 0, w: 0, h: 0 };

      if (!this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect)) {
        flushCurrentBatch();
        this.allocator.reset();
        batchStart = this.entries.length;
        currentAtlas = null;
        if (!this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect)) {
          this.onCameraCleanup(renderer);
          renderer.setFramebuffer(prevFramebuffer);
          renderer.setViewport(...prevViewport);

          throw new Error(`Feather region ${entry.params.fboW}×${entry.params.fboH} does not fit atlas ${atlasW}×${atlasH}.`);
        }
      }
      if (!currentAtlas) {
        currentAtlas = createAtlas();
      }
      this.entries.push({ ...entry, atlas: currentAtlas, rect });
    }
    flushCurrentBatch();

    renderer.setFramebuffer(prevFramebuffer);
    renderer.setViewport(...prevViewport);
  }

  override onCameraCleanup (renderer: Renderer): void {
    const released = new Set<GPUFramebuffer>();

    for (const { featherRenderer, atlas } of this.entries) {
      if (!released.has(atlas)) {
        renderer.releaseTemporaryRT(atlas);
        released.add(atlas);
      }
      featherRenderer.atlasLayers = null;
    }

    this.entries = [];
  }
}
