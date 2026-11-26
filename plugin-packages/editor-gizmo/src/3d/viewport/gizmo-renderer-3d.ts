import { math, RenderPass, RenderPassEvent, RendererFeature, ResourceData, TextureLoadAction, type Renderer, type RenderingData } from '@galacean/effects';
import type { Editor3D } from '../editor-3d';

/** Renderer-owned overlay pass reused by the active editor. */
export class GizmoRenderer3D extends RendererFeature {
  private passes: RenderPass[] = [];
  editor?: Editor3D;

  constructor (editor: Editor3D) {
    super();
    this.editor = editor;
  }

  override create (renderer: Renderer): void {
    this.passes = [new OverlayGizmoPass(renderer, this)];
  }

  override addRenderPasses (renderer: Renderer, data: RenderingData): void {
    const editor = this.editor;

    if (!editor?.enabled || !editor.visible || data.options?.camera !== editor.composition?.camera) { return; }
    for (const pass of this.passes) { renderer.enqueuePass(pass); }
  }

  override dispose (): void {
    this.active = false;
    this.editor = undefined;
    this.passes.forEach(pass => pass.dispose());
    this.passes.length = 0;
  }
}

class OverlayGizmoPass extends RenderPass {
  constructor (renderer: Renderer, private readonly feature: GizmoRenderer3D) {
    super(renderer);
    this.name = 'OverlayGizmoPass';
    this.renderPassEvent = RenderPassEvent.AfterRendering;
  }

  override execute (renderer: Renderer, data: RenderingData): void {
    const editor = this.feature.editor;

    if (!editor) { return; }
    const sceneDepth = data.frameData.get(ResourceData).cameraDepth;

    if (sceneDepth) {
      renderer.clear({ depthAction: TextureLoadAction.clear });
      renderer.setGlobalTexture('effects_GizmoSceneDepth', sceneDepth);
      renderer.setGlobalVector4('effects_GizmoSceneDepthViewport', new math.Vector4(...renderer.getViewport()));
    }
    renderer.setGlobalInt('effects_GizmoSceneDepthEnabled', sceneDepth ? 1 : 0);
    editor.grid.draw(renderer);
    for (const gizmo of editor.sceneGizmos) { gizmo.draw(renderer); }
    renderer.setGlobalInt('effects_GizmoSceneDepthEnabled', 0);
    renderer.clear({ depthAction: TextureLoadAction.clear });
    editor.transform.draw(renderer);
    renderer.clear({ depthAction: TextureLoadAction.clear });
    editor.camera.draw(renderer);
  }
}
