import { RenderPass, RenderPassEvent, RendererFeature, type Composition, type Renderer, type RenderingData } from '@galacean/effects';
import { ModelMeshComponent, type PSubMesh } from '@galacean/effects-plugin-model';
import type { GizmoMesh } from '../../../editor-gizmo/src/3d/gizmo/gizmo-drawing';
import { createWireframeMesh, updateWireframeMesh } from '../../../editor-gizmo/src/3d/gizmo/wireframe';

/** Draw model wireframes directly without adding helper items to the scene. */
export class ModelWireframeRenderer extends RendererFeature {
  private composition?: Composition;
  private readonly geometries = new Map<PSubMesh, GizmoMesh>();
  private pass: ModelWireframePass;

  setScene (composition: Composition, enabled: boolean): void {
    this.clear();
    this.composition = composition;
    this.active = enabled;
  }

  override create (renderer: Renderer): void {
    this.pass = new ModelWireframePass(renderer, this);
  }

  override addRenderPasses (renderer: Renderer, data: RenderingData): void {
    if (this.composition && !this.composition.isDestroyed && data.options?.camera === this.composition.camera) {
      renderer.enqueuePass(this.pass);
    }
  }

  draw (renderer: Renderer): void {
    for (const item of this.composition?.items ?? []) {
      const component = item.getComponent(ModelMeshComponent);

      if (!component?.isActiveAndEnabled || !item.isVisible || !component.getVisible()) { continue; }
      for (const subMesh of component.content.subMeshes) {
        const source = subMesh.getEffectsGeometry();
        const material = subMesh.getEffectsMaterial();
        let geometry = this.geometries.get(subMesh);

        if (!geometry) {
          geometry = createWireframeMesh(renderer.engine, source, material, [0, 1, 1]);
          this.geometries.set(subMesh, geometry);
        } else {
          updateWireframeMesh(source, material, geometry);
        }
        renderer.drawGeometry(geometry.geometry, component.content.matrix, geometry.material);
      }
    }
  }

  private clear (): void {
    this.geometries.forEach(data => {
      data.geometry.dispose();
      data.material.dispose();
    });
    this.geometries.clear();
  }

  override dispose (): void {
    this.active = false;
    this.composition = undefined;
    this.clear();
    this.pass.dispose();
  }
}

class ModelWireframePass extends RenderPass {
  constructor (renderer: Renderer, private readonly feature: ModelWireframeRenderer) {
    super(renderer);
    this.name = 'model-wireframe';
    this.renderPassEvent = RenderPassEvent.AfterRenderingObjects;
  }

  override execute (renderer: Renderer): void { this.feature.draw(renderer); }
}
