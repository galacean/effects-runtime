import { GizmoSubType } from '../define';
import type { Editor3D } from '../editor-3d';
import type { Point2 } from '../../math/types';

export type NativeGizmoType = keyof typeof gizmoSubTypes;
export interface NativeGizmoHit { key: string, target?: string }

export const gizmoSubTypes = {
  translation: GizmoSubType.translation,
  rotation: GizmoSubType.rotation,
  scale: GizmoSubType.scale,
  'view-helper': GizmoSubType.viewHelper,
  'floor-grid': GizmoSubType.floorGrid,
};

/** Pick the same geometry matrices used by the active viewport's draw pass. */
export class ViewportGizmoPicker {
  constructor (private readonly owner: Editor3D) {}

  hasMesh (type: NativeGizmoType): boolean {
    if (type === 'floor-grid') { return !!this.owner.composition; }
    if (type === 'view-helper') { return !!this.owner.camera.geometry?.parts.length; }

    return this.owner.transform.hasGeometry(type === 'translation' ? 'translate' : type === 'rotation' ? 'rotate' : 'scale');
  }

  hit (point: Point2, type: NativeGizmoType): NativeGizmoHit | undefined {
    const composition = this.owner.composition;

    if (!this.owner.enabled || !composition?.interactive || type === 'floor-grid') { return; }
    const ndc = this.owner.toNDC(point);

    if (!ndc) { return; }
    const viewHelper = type === 'view-helper';

    if (viewHelper) {
      this.owner.camera.updateGeometry();
    } else {
      const operation = type === 'translation' ? 'translate' : type === 'rotation' ? 'rotate' : 'scale';

      if (this.owner.tool !== operation) { return; }
      this.owner.transform.updateGeometry();
    }
    const geometry = viewHelper ? this.owner.camera.geometry : this.owner.transform.geometry;
    const hit = geometry?.hit(composition.getHitTestRay(ndc.x, ndc.y), ndc, composition.camera);
    const items = this.owner.selectionGizmo.items;

    return hit && { key: hit.key, target: !viewHelper && items.length === 1 ? items[0].getInstanceId() : undefined };
  }
}
