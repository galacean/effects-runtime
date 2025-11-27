import { TextureLoadAction } from '../texture/types';
import type { RenderPassDestroyOptions, RenderPassOptions } from './render-pass';
import { RenderPass, RenderPassPriorityNormal } from './render-pass';
import type { Renderer } from './renderer';

export class DrawObjectPass extends RenderPass {
  constructor (renderer: Renderer, options: RenderPassOptions) {
    super(renderer, options);

    this.priority = RenderPassPriorityNormal;

    this.onResize = this.onResize.bind(this);
    this.renderer.engine.on('resize', this.onResize);
  }

  override execute (renderer: Renderer) {
    renderer.clear({
      colorAction: TextureLoadAction.clear,
      depthAction: TextureLoadAction.clear,
      stencilAction: TextureLoadAction.clear,
    });
    renderer.renderMeshes(this.meshes);
    renderer.clear(this.storeAction);
  }

  onResize () {
    const width = this.renderer.getWidth();
    const height = this.renderer.getHeight();

    this.framebuffer?.resize(0, 0, width, height);
  }

  override dispose (options?: RenderPassDestroyOptions): void {
    this.renderer.engine.off('resize', this.onResize);
    super.dispose(options);
  }
}
