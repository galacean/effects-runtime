import { AbstractPlugin } from '../index';
import type { RenderFrame, Mesh } from '../../render';
import type { Composition } from '../../composition';
import type { VFXItem } from '../../vfx-item';
import type { InteractItem } from './interact-item';
import { InteractVFXItem } from './interact-vfx-item';

export class InteractLoader extends AbstractPlugin {
  private mesh: Mesh[] = [];

  override onCompositionItemLifeBegin (composition: Composition, item: VFXItem<InteractItem>) {
    if (item instanceof InteractVFXItem && item.previewContent) {
      this.addMesh(item.previewContent.mesh);
    }
  }

  override onCompositionItemRemoved (composition: Composition, item: VFXItem<InteractItem>) {
    if (item instanceof InteractVFXItem && item.previewContent) {
      this.removeMesh(item.previewContent.mesh, composition.renderFrame);
    }
  }

  override prepareRenderFrame (composition: Composition, renderFrame: RenderFrame): boolean {
    this.mesh && this.mesh.forEach(mesh => renderFrame.addMeshToDefaultRenderPass(mesh));
    this.mesh = [];

    return false;
  }

  private addMesh (mesh: Mesh) {
    this.mesh.push(mesh);
  }

  private removeMesh (mesh: Mesh, frame: RenderFrame) {
    frame.removeMeshFromDefaultRenderPass(mesh);
  }
}
