import type { RenderPassDestroyOptions, RenderPassOptions } from './render-pass';
import { RenderPass } from './render-pass';
import type { Renderer } from './renderer';

export class DrawObjectPass extends RenderPass {
  constructor (renderer: Renderer, options: RenderPassOptions) {
    super(renderer, options);

    this.onResize = this.onResize.bind(this);
    this.renderer.engine.on('resize', this.onResize);
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