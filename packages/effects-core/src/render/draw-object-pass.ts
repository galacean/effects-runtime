import { TextureLoadAction } from '../texture/types';
import type { FeatherBatchEntry } from '../math/shape/vector-feather-batch';
import { VectorFeatherBatchManager } from '../math/shape/vector-feather-batch';
import { FilterMode, RenderTextureFormat } from './framebuffer';
import { RenderPass, RenderPassPriorityNormal } from './render-pass';
import type { Renderer } from './renderer';
import { ShapeComponent } from '../components';

export class DrawObjectPass extends RenderPass {
  private useRenderTarget = false;

  constructor (renderer: Renderer) {
    super(renderer);

    this.priority = RenderPassPriorityNormal;
    this.name = 'DrawObjectPass';
  }

  setup (useRenderTarget: boolean) {
    this.useRenderTarget = useRenderTarget;
  }

  override configure (renderer: Renderer): void {
    if (this.useRenderTarget) {
      this.framebuffer = renderer.getTemporaryRT('DrawObjectPass', renderer.getWidth(), renderer.getHeight(), 16, FilterMode.Linear, RenderTextureFormat.RGBAHalf);
      renderer.setFramebuffer(this.framebuffer);
    }
  }

  override execute (renderer: Renderer) {
    if (this.useRenderTarget) {
      renderer.clear({
        colorAction: TextureLoadAction.clear,
        depthAction: TextureLoadAction.clear,
        stencilAction: TextureLoadAction.clear,
      });
    }

    this.meshes.sort((a, b) => a.priority - b.priority);

    const batch = VectorFeatherBatchManager.getInstance(renderer.engine);
    const meshes = this.meshes;
    const pendingFeatherEntries: FeatherBatchEntry[] = [];

    for (const mesh of meshes) {
      if (mesh instanceof ShapeComponent && mesh.featherBatchable) {
        // 收集羽化 entry，由 pass 统一批处理
        const entry = mesh.getFeatherBatchEntry(renderer);

        if (entry) {
          pendingFeatherEntries.push(entry);
        }
      } else {
        // 遇到非羽化 mesh 前，先渲染之前积累的连续羽化批次
        if (pendingFeatherEntries.length > 0) {
          batch.render(renderer, pendingFeatherEntries);
          pendingFeatherEntries.length = 0;
        }
        mesh.render(renderer);
      }
    }

    // 渲染尾部残余的羽化批次
    if (pendingFeatherEntries.length > 0) {
      batch.render(renderer, pendingFeatherEntries);
    }
  }

  override onCameraCleanup (renderer: Renderer): void {
    if (this.useRenderTarget && this.framebuffer) {
      renderer.releaseTemporaryRT(this.framebuffer);
    }
  }
}
