import type { ShapeComponent } from '../plugins/shape/shape-component';
import type { GPUFramebuffer } from './gpu-framebuffer';
import { FilterMode, RenderTextureFormat } from './gpu-framebuffer';
import { RenderPass, RenderPassEvent } from './render-pass';
import type { Renderer } from './renderer';
import type { RenderingData } from './rendering-data';
import { TextureLoadAction } from '../texture';
import type { AtlasRect } from '../math/shape/atlas-allocator';
import { AtlasAllocator } from '../math/shape/atlas-allocator';
import type { FeatherRenderParams, VectorFeatherRenderer } from '../math/shape/vector-feather-renderer';

export const FEATHER_GROUP = 'FeatherOffscreenPass';

const MAX_ATLAS_SIZE = 4096;
const ATLAS_PADDING = 2;

type FeatherEntry = {
  featherRenderer: VectorFeatherRenderer,
  params: FeatherRenderParams,
};

/**
 * FeatherOffscreenPass
 * 在 DrawObjectPass 之前执行，将需要羽化的填充和描边
 * 分别渲染到 atlas 中互不重叠的区域。
 * VectorFeatherRenderer 负责参数准备、离屏绘制和合成上色。
 */
export class FeatherOffscreenPass extends RenderPass {

  private atlases: GPUFramebuffer[] = [];

  constructor (renderer: Renderer) {
    super(renderer);
    this.renderPassEvent = RenderPassEvent.BeforeRendering;
    this.name = FEATHER_GROUP;
  }

  override execute (renderer: Renderer, data: RenderingData): void {
    const entries: FeatherEntry[] = [];
    const shapes = (data.renderList.groups.get(FEATHER_GROUP) ?? []) as ShapeComponent[];
    let maxW = 0;
    let maxH = 0;
    let totalArea = 0;

    for (const shape of shapes) {
      const featherRenderer = shape.featherRenderer;

      for (const params of featherRenderer.prepareLayers(renderer, shape.transform.getWorldMatrix())) {
        entries.push({ featherRenderer, params });
        maxW = Math.max(maxW, params.fboW);
        maxH = Math.max(maxH, params.fboH);
        totalArea += (params.fboW + ATLAS_PADDING) * (params.fboH + ATLAS_PADDING);
      }
    }

    if (entries.length === 0) {
      return;
    }

    const maxAtlasSize = Math.min(MAX_ATLAS_SIZE, renderer.engine.displayServer.renderingDevice.gpuCapability.detail.maxTextureSize);
    const atlasW = Math.min(Math.max(maxW, Math.ceil(Math.sqrt(totalArea))), maxAtlasSize);
    const atlasH = Math.min(Math.max(Math.ceil(totalArea / atlasW) * 2, maxH), maxAtlasSize);
    const allocator = new AtlasAllocator(atlasW, atlasH);
    const prevFramebuffer = renderer.getFramebuffer();
    const prevViewport = renderer.getViewport();
    let currentAtlas = this.createAtlas(renderer, atlasW, atlasH);

    for (const { featherRenderer, params } of entries) {
      const rect: AtlasRect = { x: 0, y: 0, w: 0, h: 0 };

      if (!allocator.allocate(params.fboW, params.fboH, rect)) {
        allocator.reset();
        // Atlas 尺寸覆盖所有区域，重置后一定能容纳当前区域。
        allocator.allocate(params.fboW, params.fboH, rect);
        currentAtlas = this.createAtlas(renderer, atlasW, atlasH);
      }
      renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
      featherRenderer.renderOffscreen(renderer, params, currentAtlas, rect);
    }

    renderer.setFramebuffer(prevFramebuffer);
    renderer.setViewport(...prevViewport);
  }

  override onCameraCleanup (renderer: Renderer, data: RenderingData): void {
    const shapes = (data.renderList.groups.get(FEATHER_GROUP) ?? []) as ShapeComponent[];

    for (const atlas of this.atlases) {
      renderer.releaseTemporaryRT(atlas);
    }
    for (const shape of shapes) {
      shape.featherRenderer.atlasLayers = null;
    }

    this.atlases.length = 0;
  }

  private createAtlas (renderer: Renderer, width: number, height: number): GPUFramebuffer {
    const atlas = renderer.getTemporaryRT(
      '_FeatherAtlas', width, height, 0,
      FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
      1, // 禁用各向异性过滤。upsample 用 texture2D 模拟 texelFetch，必须关闭各向异性。
    );

    this.atlases.push(atlas);
    renderer.setFramebuffer(atlas);
    renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });

    return atlas;
  }
}
