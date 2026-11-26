import type { VFXItem } from '@galacean/effects';
import { GizmoSubType } from '../define';
import type { GizmoComponent } from '../gizmo-component';
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
const skipChildren = { skip: () => true };

/** Pick the meshes owned by the current viewport's gizmo layer. */
export class ViewportGizmoPicker {
  constructor (private readonly owner: Editor3D) {}

  private registered (type: NativeGizmoType): GizmoComponent[] {
    return this.owner.gizmoComponents.filter(component =>
      component.subType === gizmoSubTypes[type] && component.meshes.length > 0);
  }

  /** A registered mesh owns its visual even while explicitly hidden. */
  hasMesh (type: NativeGizmoType): boolean {
    return this.registered(type).length > 0;
  }

  hit (point: Point2, type: NativeGizmoType): NativeGizmoHit | undefined {
    const composition = this.owner.composition;
    const components = this.registered(type);

    if (!components.length || !composition?.interactive) { return; }
    const ndc = this.owner.toNDC(point);

    if (!ndc) { return; }
    const { x, y } = ndc;
    const ray = composition.getHitTestRay(x, y);
    let nearest: NativeGizmoHit | undefined;
    let distance = Infinity;

    for (const component of components) {
      let node: VFXItem | undefined = component.item;

      while (node && node.isActive && node.isVisible) { node = node.parent; }
      if (!component.enabled || node) { continue; }
      if (!component.item.hitTest(ray, x, y, [], [], true, skipChildren) || !component.hitBounding) { continue; }
      const depth = ray.origin.distanceSquared(component.hitBounding.position);

      if (depth <= distance) {
        distance = depth;
        nearest = { key: component.hitBounding.key, target: component.target };
      }
    }

    return nearest;
  }
}
