import type { Renderer, RenderingData, RenderPassDestroyOptions } from '@galacean/effects';
import {
  COPY_VERTEX_SHADER, COPY_FRAGMENT_SHADER, glContext, Material, math,
  RenderPass, RenderPassEvent, RendererFeature, ResourceData, TextureLoadAction,
} from '@galacean/effects';
import type { Editor3D } from '../editor-3d';

/** Renderer-owned overlay pass reused by the active editor. */
export class EditorPrimitives extends RendererFeature {
  private passes: RenderPass[] = [];
  editor?: Editor3D;

  constructor (editor: Editor3D) {
    super();
    this.editor = editor;
  }

  override create (renderer: Renderer): void {
    this.passes = [new EditorPrimitivesPass(renderer, this)];
  }

  override addRenderPasses (renderer: Renderer, data: RenderingData): void {
    const editor = this.editor;

    if (!editor?.enabled || editor.isDisposed || !editor.visible || data.options?.camera !== editor.composition?.camera) { return; }
    for (const pass of this.passes) { renderer.enqueuePass(pass); }
  }

  override dispose (): void {
    this.active = false;
    this.editor = undefined;
    this.passes.forEach(pass => pass.dispose());
    this.passes.length = 0;
  }
}

class EditorPrimitivesPass extends RenderPass {
  private readonly depthCopyMaterial: Material;

  constructor (renderer: Renderer, private readonly feature: EditorPrimitives) {
    super(renderer);
    this.name = 'EditorPrimitivesPass';
    this.renderPassEvent = RenderPassEvent.AfterRendering;

    this.depthCopyMaterial = Material.create(renderer.engine, {
      shader: {
        name: 'CopyDepth',
        vertex: COPY_VERTEX_SHADER,
        fragment: COPY_FRAGMENT_SHADER,
        macros: [['DEPTH_TEXTURE', 1]],
      },
    });
    this.depthCopyMaterial.colorMask = false;
    this.depthCopyMaterial.blending = false;
    this.depthCopyMaterial.depthTest = true;
    this.depthCopyMaterial.depthFunc = glContext.ALWAYS;
    this.depthCopyMaterial.depthMask = true;
    this.depthCopyMaterial.stencilTest = false;
    this.depthCopyMaterial.culling = false;
    // Allow one depth-24 quantization step for coplanar scene helpers.
    this.depthCopyMaterial.setFloat('uDepthBias', 1 / 16777216);
  }

  override execute (renderer: Renderer, data: RenderingData): void {
    const editor = this.feature.editor;

    if (!editor || editor.isDisposed) { return; }
    const viewport = editor.viewportSize;

    renderer.setGlobalVector4('effects_GizmoViewportSize', new math.Vector4(viewport.x, viewport.y, 0, 0));
    const sceneDepth = data.frameData.get(ResourceData).cameraDepth;
    const target = data.options?.target ?? null;

    if (sceneDepth && sceneDepth !== target?.getDepthTexture()) {
      renderer.blit(sceneDepth, target, this.depthCopyMaterial);
      this.depthCopyMaterial.setTexture('_MainTex', renderer.engine.assetServer.transparentTexture);
    }
    editor.gizmos.forEach(gizmo => {
      if (gizmo.visible && !gizmo.isActive) { gizmo.draw(renderer); }
    });
    renderer.clear({ depthAction: TextureLoadAction.clear });
    const active = editor.activeGizmo;

    if (active?.visible) { active.draw(renderer); }
    renderer.clear({ depthAction: TextureLoadAction.clear });
    editor.directionGizmo.drawGizmo(renderer);
  }

  override dispose (options?: RenderPassDestroyOptions): void {
    if (this.isDisposed) {
      return;
    }
    this.depthCopyMaterial.dispose();
    super.dispose(options);
  }
}
