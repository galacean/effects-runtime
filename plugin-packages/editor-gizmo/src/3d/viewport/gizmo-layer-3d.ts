import { VFXItem, type Composition } from '@galacean/effects';
import type { Editor3D } from '../editor-3d';
import { CoordinateSpace, GizmoComponent } from '../gizmo-component';
import type { Transform3DOperation } from './gizmo-3d';
import { getTransformGizmoPose } from './transform-gizmo-3d';
import { gizmoSubTypes, type NativeGizmoType } from './viewport-gizmo-picker';

/** Viewport-owned geometry rendered with the edited composition's camera. */
export class GizmoLayer3D {
  readonly root: VFXItem;
  readonly components: GizmoComponent[] = [];
  private readonly viewHelper: GizmoComponent;
  private readonly handles: Record<Transform3DOperation, GizmoComponent>;
  private activeHandle?: GizmoComponent;

  constructor (composition: Composition) {
    this.root = new VFXItem(composition.engine);
    this.root.name = 'Editor3D Gizmos';
    composition.addItem(this.root);
    // Handles and the floor grid use world coordinates even when the scene root is transformed.
    this.root.transform.parentTransform = null;
    this.viewHelper = this.create('view-helper', { scale: 1, padding: 0.8 });
    this.create('floor-grid', { sideLength: 100, parts: 50 }, 100 / 255);
    this.create('floor-grid', { sideLength: 100, parts: 200 }, 50 / 255);
    this.handles = {
      translate: this.create('translation', { scale: 2 }),
      rotate: this.create('rotation', { scale: 2 }),
      scale: this.create('scale', { scale: 2 }),
    };
  }

  private create (type: NativeGizmoType, size: Record<string, number>, gray = 1): GizmoComponent {
    const item = new VFXItem(this.root.engine);
    const component = item.addComponent(GizmoComponent);
    const isGrid = type === 'floor-grid';

    item.name = type;
    component.targetItem = item;
    component.target = item.getInstanceId();
    component.subType = gizmoSubTypes[type];
    component.size = size;
    component.color = [gray, gray, gray];
    component.renderMode = component.getDefaultRenderMode();
    component.depthTest = isGrid;
    if (isGrid) { item.transform.setRotation(90, 0, 0); }
    item.setVisible(isGrid || type === 'view-helper');
    item.setParent(this.root);
    this.components.push(component);

    return component;
  }

  setActive (active: boolean): void {
    this.root.setActive(active);
    for (const item of this.root.children) { item.setActive(active); }
  }

  update (editor: Editor3D): void {
    const orientation = this.root.composition!.camera.getInverseViewMatrix().getTransform().rotation.conjugate();
    const cameraRotated = !this.viewHelper.transform.quat.equals(orientation);

    if (cameraRotated) {
      this.viewHelper.transform.setQuaternion(orientation.x, orientation.y, orientation.z, orientation.w);
      this.viewHelper.updateRenderData();
    }

    const { tool, space, selectionGizmo } = editor;
    const items = selectionGizmo.items;
    const handle = tool !== 'camera' && items.length && items.every(item => selectionGizmo.canTransform(item))
      ? this.handles[tool] : undefined;
    const changed = handle !== this.activeHandle;

    if (changed) {
      this.activeHandle?.item.setVisible(false);
      this.activeHandle = handle;
    }
    if (!handle) { return; }

    const { pivot, rotation } = getTransformGizmoPose(items, space);
    const transform = handle.transform;
    const moved = !transform.position.equals(pivot) || !transform.quat.equals(rotation);

    handle.target = items.length === 1 ? items[0].getInstanceId() : handle.item.getInstanceId();
    handle.coordinateSpace = space === 'local' ? CoordinateSpace.Local : CoordinateSpace.World;
    transform.setPosition(pivot.x, pivot.y, pivot.z);
    transform.setQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    if (changed) { handle.item.setVisible(true); }
    if (changed || moved || cameraRotated) { handle.updateRenderData(); }
  }
}
