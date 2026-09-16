import { TextureLoadAction } from '../texture/types';
import { FilterMode, RenderTextureFormat } from './framebuffer';
import { RenderPass, RenderPassPriorityNormal } from './render-pass';
import type { Renderer } from './renderer';

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
    // Compositions share color, but never depth or stencil. Offscreen color starts transparent.
    renderer.clear({
      colorAction: this.useRenderTarget ? TextureLoadAction.clear : undefined,
      clearColor: [0, 0, 0, 0],
      depthAction: TextureLoadAction.clear,
      stencilAction: TextureLoadAction.clear,
    });

    this.meshes.sort((a, b) => a.priority - b.priority);

    renderer.renderMeshes(this.meshes);
  }

  override onCameraCleanup (renderer: Renderer): void {
    if (this.useRenderTarget && this.framebuffer) {
      renderer.releaseTemporaryRT(this.framebuffer);
    }
  }
}
