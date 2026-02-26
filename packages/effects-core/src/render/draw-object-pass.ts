import type { CompositionComponent } from '../components';
import { TextureLoadAction } from '../texture/types';
import { FilterMode, RenderTextureFormat } from './framebuffer';
import { RenderPass, RenderPassPriorityNormal } from './render-pass';
import type { Renderer } from './renderer';

export class DrawObjectPass extends RenderPass {
  private rootComposition: CompositionComponent;
  private useRenderTarget = false;

  constructor (renderer: Renderer) {
    super(renderer);

    this.priority = RenderPassPriorityNormal;
    this.name = 'DrawObjectPass';
  }

  setup (useRenderTarget: boolean, rootComposition: CompositionComponent) {
    this.useRenderTarget = useRenderTarget;
    this.rootComposition = rootComposition;
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

    // this.meshes.sort((a, b) => a.priority - b.priority);

    // renderer.renderMeshes(this.meshes);

    if (this.rootComposition.item.isDuringPlay && this.rootComposition.isActiveAndEnabled) {
      this.rootComposition.render(renderer);
    }
  }

  override onCameraCleanup (renderer: Renderer): void {
    if (this.useRenderTarget && this.framebuffer) {
      renderer.releaseTemporaryRT(this.framebuffer);
    }
  }
}
