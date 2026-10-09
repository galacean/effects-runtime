import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { ShapeComponent } from '../components';
import type { Framebuffer } from './framebuffer';
import { FilterMode, RenderTextureFormat } from './framebuffer';
import { RenderPass, RenderPassPriorityFeatherOffscreen } from './render-pass';
import type { Renderer } from './renderer';
import { TextureLoadAction } from '../texture';
import type { AtlasRect } from '../math/shape/atlas-allocator';
import { AtlasAllocator } from '../math/shape/atlas-allocator';
import type { FeatherRenderParams, FeatherSide } from '../math/shape/vector-feather-renderer';
import { VectorFeatherRenderer } from '../math/shape/vector-feather-renderer';

const MAX_ATLAS_SIZE = 4096;
const ATLAS_PADDING = 2;

type FeatherEntry = {
  component: ShapeComponent,
  featherRenderer: VectorFeatherRenderer,
  side: FeatherSide,
  params: FeatherRenderParams,
  atlas: Framebuffer,
  rect: AtlasRect,
};

/**
 * FeatherOffscreenPass
 * 在 DrawObjectPass 之前执行，将需要羽化的填充和描边
 * 分别渲染到 atlas 中互不重叠的区域。
 * 结果写入 VectorFeatherRenderer.atlasLayers，由 ShapeComponent.render() 上色。
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
    const pending: {
      component: ShapeComponent,
      featherRenderer: VectorFeatherRenderer,
      side: FeatherSide,
      params: FeatherRenderParams,
    }[] = [];
    const renderList = renderer.renderingData.currentFrame.renderList;

    for (const mesh of renderList) {
      if (!(mesh instanceof ShapeComponent) || mesh.featherRenderer.featherRadius <= 0) {
        continue;
      }

      const featherRenderer = mesh.featherRenderer;
      const worldMatrix = mesh.transform.getWorldMatrix();
      const prepared = featherRenderer.prepareFeatherRadius(renderer, worldMatrix, featherRenderer.featherRadius);
      const sides: FeatherSide[] = ['fill', 'stroke'];

      featherRenderer.atlasLayers = { fill: null, stroke: null };

      for (const side of sides) {
        const scatter = featherRenderer.layerInstanceRange(side);
        const triangles = featherRenderer.layerTriangleRange(side);

        if (scatter.count <= 0 && triangles.count <= 0) {
          continue;
        }

        const params = featherRenderer.createLayerParams(
          renderer, worldMatrix, featherRenderer.layerBBox(side), prepared,
        );

        if (!params) {
          continue;
        }

        pending.push({ component: mesh, featherRenderer, side, params });
      }
    }

    if (pending.length === 0) {
      return;
    }

    let maxW = 0;
    let totalArea = 0;

    for (const { params } of pending) {
      maxW = Math.max(maxW, params.fboW);
      totalArea += (params.fboW + ATLAS_PADDING) * (params.fboH + ATLAS_PADDING);
    }

    const atlasW = Math.min(Math.max(maxW, Math.ceil(Math.sqrt(totalArea))), MAX_ATLAS_SIZE);
    const atlasH = Math.min(Math.max(Math.ceil(totalArea / atlasW) * 2, maxW), MAX_ATLAS_SIZE);

    this.allocator = new AtlasAllocator(atlasW, atlasH);
    this.entries = [];

    const prevFramebuffer = renderer.getFramebuffer();
    let currentAtlas: Framebuffer | null = null;
    let batchStart = 0;

    const flushCurrentBatch = () => {
      const atlas = currentAtlas;
      const batch = this.entries.slice(batchStart);

      if (batch.length === 0 || !atlas) {
        return;
      }

      renderer.setFramebuffer(atlas);
      renderer.setViewport(0, 0, atlasW, atlasH);
      renderer.clear({ colorAction: TextureLoadAction.clear, clearColor: [0, 0, 0, 0] });

      for (const { component, featherRenderer, side, params, rect } of batch) {
        const scatter = featherRenderer.layerInstanceRange(side);
        const triangles = featherRenderer.layerTriangleRange(side);
        const viewportOffset = new Vector2(rect.x, rect.y);

        renderer.setViewport(rect.x, rect.y, rect.w, rect.h);

        if (VectorFeatherRenderer.indicatorSoS) {
          featherRenderer.drawIndicatorSoSPass(renderer, params, viewportOffset, triangles.start, triangles.count);
        } else {
          component.drawFeatherIndicatorPass(renderer, params.orthoProjection, side === 'fill' ? 2 : 3);
        }

        featherRenderer.drawScatterPass(
          renderer, params, featherRenderer.featherRadius, viewportOffset, scatter.start, scatter.count,
        );

        const layers = featherRenderer.atlasLayers ?? { fill: null, stroke: null };

        layers[side] = {
          atlasTexture: atlas.getColorTextures()[0],
          atlasSize: new Vector2(atlasW, atlasH),
          textureOffset: viewportOffset,
          textureSize: new Vector2(rect.w, rect.h),
          featherRadiusScreen: params.featherRadiusScreen,
          expandedRect: params.localRect,
        };
        featherRenderer.atlasLayers = layers;
      }
    };

    for (const entry of pending) {
      const rect: AtlasRect = { x: 0, y: 0, w: 0, h: 0 };

      if (this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect)) {
        if (!currentAtlas) {
          currentAtlas = renderer.getTemporaryRT(
            '_FeatherAtlas', atlasW, atlasH, 0,
            FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
            1,
          );
        }
        this.entries.push({ ...entry, atlas: currentAtlas, rect });
      } else {
        flushCurrentBatch();
        this.allocator.reset();
        batchStart = this.entries.length;
        currentAtlas = renderer.getTemporaryRT(
          '_FeatherAtlas', atlasW, atlasH, 0,
          FilterMode.Nearest, RenderTextureFormat.RGBAHalf,
          1,
        );
        this.allocator.allocate(entry.params.fboW, entry.params.fboH, rect);
        this.entries.push({ ...entry, atlas: currentAtlas, rect });
      }
    }

    flushCurrentBatch();

    renderer.setFramebuffer(prevFramebuffer);
    if (prevFramebuffer) {
      const vp = prevFramebuffer.viewport;

      renderer.setViewport(vp[0], vp[1], vp[2], vp[3]);
    } else {
      renderer.setViewport(0, 0, renderer.getWidth(), renderer.getHeight());
    }
  }

  override onCameraCleanup (renderer: Renderer): void {
    const released = new Set<Framebuffer>();

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
