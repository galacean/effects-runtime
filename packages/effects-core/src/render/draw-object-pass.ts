import { RendererComponent } from '../components';
import type { VFXItem } from '../vfx-item';
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
    if (this.useRenderTarget) {
      renderer.clear({
        colorAction: TextureLoadAction.clear,
        depthAction: TextureLoadAction.clear,
        stencilAction: TextureLoadAction.clear,
      });
    }

    if (renderer.engine.use2DRenderer) {
      // 从根元素递归遍历并渲染
      this.renderItem(renderer.renderingData.currentComposition.rootItem, renderer);
    } else {
      this.meshes.sort((a, b) => a.priority - b.priority);
      renderer.renderMeshes(this.meshes);
    }
  }

  /**
   * 递归遍历元素及其子元素，渲染 RendererComponent
   */
  private renderItem (item: VFXItem, renderer: Renderer): void {
    // 渲染当前元素的所有 RendererComponent
    for (const component of item.components) {
      if (component instanceof RendererComponent && component.isActiveAndEnabled) {
        component.render(renderer);
      }
    }

    // 递归渲染子元素
    for (const child of item.children) {
      this.renderItem(child, renderer);
    }
  }

  override onCameraCleanup (renderer: Renderer): void {
    if (this.useRenderTarget && this.framebuffer) {
      renderer.releaseTemporaryRT(this.framebuffer);
    }
  }
}
