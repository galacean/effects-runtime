import { TextureLoadAction } from '../texture/types';
import { RenderPass, RenderPassEvent } from './render-pass';
import type { Renderer } from './renderer';
import type { RenderingData } from './rendering-data';

export class DrawObjectPass extends RenderPass {
  constructor (renderer: Renderer) {
    super(renderer);
    this.renderPassEvent = RenderPassEvent.BeforeRenderingObjects;
    this.name = 'DrawObjectPass';
  }

  override execute (renderer: Renderer, data: RenderingData): void {
    // Compositions share color, but never depth or stencil. Offscreen color starts transparent.
    renderer.clear({
      colorAction: data.options?.postProcessingEnabled ? TextureLoadAction.clear : undefined,
      clearColor: [0, 0, 0, 0],
      depthAction: TextureLoadAction.clear,
      stencilAction: TextureLoadAction.clear,
    });
    renderer.renderMeshes(data.renderList.objects);
  }
}
