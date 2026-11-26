import { math, MouseButton, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey, type VFXItem } from '@galacean/effects';
import type { Editor3D } from '../editor-3d';
import { Gizmo3D, type Transform3DActionEvent, type Transform3DOperation, type Viewport3DSpace } from './gizmo-3d';
import type { NativeGizmoType } from './viewport-gizmo-picker';
import { add3, sub3, mul3, dot3, cross3, unit3, rayPlanePoint, rayAxisParameter, type Point2, type Point3 } from './gizmo-3d-math';

const { Vector3, Quaternion, Matrix4 } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

export interface TransformGizmo3DOptions {
  transform?: Transform3DOperation,
  space?: Viewport3DSpace,
}

type Handle = 0 | 1 | 2 | 'xy' | 'xz' | 'yz' | 'all' | 'view';
type Frame = { pivot: Point3, axes: Point3[], rotation: Quaternion };
type LocalTransform = { position: Vector3, quat: Quaternion, scale: Vector3 };
type DragItem = {
  item: VFXItem, world: Matrix4, inverseParent: Matrix4, anchor: Vector3,
  before: LocalTransform, preview?: LocalTransform, parent?: VFXItem, parentWorld: Matrix4,
};
interface TransformDrag {
  action: Transform3DActionEvent,
  items: DragItem[],
  composition?: Composition,
  frame: Frame,
  handle: Handle,
  start: Vector2,
  startValue?: number,
  startPoint?: Point3,
  viewNormal?: Point3,
}

function matchesLocal (item: VFXItem, value: LocalTransform): boolean {
  return item.transform.position.equals(value.position) && item.transform.getQuaternion().equals(value.quat)
    && item.transform.scale.equals(value.scale);
}
const vector = (p: Point3): Vector3 => new Vector3(p.x, p.y, p.z);
const identity = new Matrix4();
const axes: Point3[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];

/** Perspective ray-based axes, planes, rotation rings and scale handles. */
export class TransformGizmo3D extends Gizmo3D {
  readonly type = 'transform-3d';
  operation: Transform3DOperation;
  space: Viewport3DSpace;
  private drag?: TransformDrag;
  constructor (owner: Editor3D, options: TransformGizmo3DOptions = {}) {
    super(owner);
    this.operation = options.transform ?? 'translate';
    this.space = options.space ?? 'world';
  }
  private valid (drag: TransformDrag): boolean {
    const selected = this.owner.selectionGizmo.items;

    return this.owner.composition === drag.composition && selected.length === drag.items.length
      && drag.items.every(({ item, parent, parentWorld, preview, before }, index) =>
        item === selected[index] && this.owner.selectionGizmo.canTransform(item) && item.parent === parent
        && parentWorld.equals(item.transform.getParentMatrix() ?? identity) && matchesLocal(item, preview ?? before));
  }

  override onUpdate (): void {
    if (this.drag && !this.valid(this.drag)) { this.cancel('context'); }
  }

  override cancel (reason: string): void {
    const drag = this.drag;

    if (!drag) { return; }
    this.drag = undefined;
    for (const { item, before, preview } of drag.items) {
      // Only roll back our own preview. Another editor may have replaced the item or its transform.
      if (preview && item.transform.getValid() && matchesLocal(item, preview)) { item.transform.setTransform(before); }
    }
    this.owner.emit('actioncommit', { ...drag.action, canceled: true, reason });
  }
  setOperation (operation: Transform3DOperation): void { this.cancel('operation'); this.operation = operation; }
  setSpace (space: Viewport3DSpace): void { this.cancel('space'); this.space = space; }
  private createFrame (items: readonly VFXItem[]): Frame {
    const sum = items.reduce((total, item) => add3(total, new Vector3().applyMatrix(item.transform.getWorldMatrix())), { x: 0, y: 0, z: 0 });
    const pivot = mul3(sum, 1 / items.length);
    const rotation = new Quaternion();

    if (this.space === 'local') {
      items[0].transform.assignWorldTRS(undefined, rotation);
    }

    return { pivot, rotation, axes: axes.map(axis => vector(axis).applyQuaternion(rotation)) };
  }
  private planeAxes (handle: string): [number, number] { return handle === 'xy' ? [0, 1] : handle === 'xz' ? [0, 2] : [1, 2]; }
  private nativeType (): NativeGizmoType { return this.operation === 'translate' ? 'translation' : this.operation === 'rotate' ? 'rotation' : 'scale'; }
  private nativeHandle (key: string): Handle | undefined {
    if (key === 'xAxis') { return 0; }
    if (key === 'yAxis') { return 1; }
    if (key === 'zAxis') { return 2; }
    if (key === 'xyPlane') { return 'xy'; }
    if (key === 'yzPlane') { return 'yz'; }
    if (key === 'zxPlane') { return 'xz'; }
    if (key === 'center') { return this.operation === 'translate' ? 'view' : 'all'; }

    return;
  }
  pickHandle (point: Point2): Handle | undefined {
    const hit = this.owner.picker.hit(point, this.nativeType());

    return hit && this.nativeHandle(hit.key);
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    const selected = this.owner.selectionGizmo.items;

    if (!selected.length || selected.some(item => !this.owner.selectionGizmo.canTransform(item))) { return; }
    const handle = this.pickHandle(event.position);

    if (handle === undefined) { return; }
    const ray = this.owner.ray(event.position);

    if (!ray) { return; }
    this.cancel('restart');
    const frame = this.createFrame(selected);
    const drag: TransformDrag = {
      action: { source: this, transformType: this.operation, itemIds: selected.map(item => item.getInstanceId()) },
      items: [], composition: this.owner.composition,
      frame, handle, start: event.position.clone(),
    };

    if (typeof handle === 'number') {
      if (this.operation === 'rotate') {
        drag.startPoint = rayPlanePoint(ray, frame.pivot, frame.axes[handle]);
        if (!drag.startPoint) { return; }
      } else {
        drag.startValue = rayAxisParameter(ray, frame.pivot, frame.axes[handle]);
        if (drag.startValue === undefined) { return; }
      }
    } else if (handle === 'view') {
      drag.viewNormal = unit3(ray.direction);
      drag.startPoint = rayPlanePoint(ray, frame.pivot, drag.viewNormal);
      if (!drag.startPoint) { return; }
    } else if (handle !== 'all') {
      const [a, b] = this.planeAxes(handle);

      drag.startPoint = rayPlanePoint(ray, frame.pivot, cross3(frame.axes[a], frame.axes[b]));
      if (!drag.startPoint) { return; }
    }
    for (const item of selected) {
      const transform = item.transform;
      const parentWorld = (transform.getParentMatrix() ?? identity).clone();

      if (Math.abs(parentWorld.determinant()) < 1e-10) { return; }
      drag.items.push({
        item, parent: item.parent, parentWorld, inverseParent: parentWorld.clone().invert(),
        world: transform.getWorldMatrix().clone(), anchor: transform.anchor.clone(),
        before: { position: transform.position.clone(), quat: transform.getQuaternion().clone(), scale: transform.scale.clone() },
      });
    }
    this.drag = drag;
    event.accept();
    this.owner.emit('actionstart', drag.action);
  }
  override onMouseDrag (event: InputEventMouseMotion): void {
    const drag = this.drag;

    if (!drag) { return; }
    if (!this.valid(drag)) {
      this.cancel('context');

      return;
    }
    const ray = this.owner.ray(event.position);

    if (!ray) { return; }
    const { frame, handle, start, startPoint, startValue, viewNormal } = drag;
    let operation = new Matrix4();

    if (this.operation === 'translate') {
      let delta: Point3;

      if (typeof handle === 'number') {
        const value = rayAxisParameter(ray, frame.pivot, frame.axes[handle]);

        if (value === undefined) { return; }
        let distance = value - startValue!;

        if (event.shiftPressed) { distance = Math.round(distance * 10) / 10; }
        delta = mul3(frame.axes[handle], distance);
      } else if (handle === 'view') {
        const p = viewNormal && rayPlanePoint(ray, frame.pivot, viewNormal);

        if (!p || !startPoint) { return; }
        delta = sub3(p, startPoint);
      } else {
        const [a, b] = this.planeAxes(handle); const p = rayPlanePoint(ray, frame.pivot, cross3(frame.axes[a], frame.axes[b]));

        if (!p || !startPoint) { return; }
        delta = sub3(p, startPoint);
      }
      operation.setPosition(vector(delta));
    } else if (this.operation === 'rotate' && typeof handle === 'number') {
      const p = rayPlanePoint(ray, frame.pivot, frame.axes[handle]);

      if (!p || !startPoint) { return; }
      const a = unit3(sub3(startPoint, frame.pivot)), b = unit3(sub3(p, frame.pivot));
      let angle = Math.atan2(dot3(frame.axes[handle], cross3(a, b)), dot3(a, b));

      if (event.shiftPressed) { angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12; }
      operation = around(frame.pivot, new Matrix4().setFromQuaternion(new Quaternion().setFromAxisAngle(vector(frame.axes[handle]), angle)));
    } else if (this.operation === 'scale') {
      const value = typeof handle === 'number' ? rayAxisParameter(ray, frame.pivot, frame.axes[handle]) : undefined;
      let factor = handle === 'all' ? Math.exp((start.y - event.position.y) / 100) : (value ?? startValue!) / startValue!;

      if (!Number.isFinite(factor)) { return; } factor = Math.max(0.01, factor);
      if (event.shiftPressed) { factor = Math.max(0.1, Math.round(factor * 10) / 10); }
      const scale = new Vector3(handle === 0 || handle === 'all' ? factor : 1, handle === 1 || handle === 'all' ? factor : 1, handle === 2 || handle === 'all' ? factor : 1);
      const basis = new Matrix4().setFromQuaternion(frame.rotation);

      operation = around(frame.pivot, basis.clone().multiply(new Matrix4().compose(new Vector3(), new Quaternion(), scale)).multiply(basis.invert()));
    }
    const after: LocalTransform[] = [];

    for (const initial of drag.items) {
      const local = initial.inverseParent.clone().multiply(operation).multiply(initial.world);
      const p = new Vector3(), q = new Quaternion(), s = new Vector3();

      local.decompose(p, q, s);
      const rebuilt = new Matrix4().compose(p, q, s);

      if (local.elements.some((value, i) => !Number.isFinite(value) || Math.abs(value - rebuilt.elements[i]) > 1e-5)) {
        this.cancel('unrepresentable-shear');

        return;
      }
      const anchorShift = new Vector3(initial.anchor.x * s.x, initial.anchor.y * s.y, initial.anchor.z * s.z).applyQuaternion(q);

      p.add(anchorShift);
      after.push({ position: p, quat: this.operation === 'translate' ? initial.before.quat : q,
        scale: this.operation === 'scale' ? s : initial.before.scale });
    }
    // Validate the whole selection before publishing any preview.
    drag.items.forEach((entry, index) => {
      entry.preview = after[index];
      entry.item.transform.setTransform(after[index]);
    });
    event.accept();
    this.owner.emit('actionupdate', drag.action);
  }
  override onMouseUp (event: InputEventMouseButton): void {
    const drag = this.drag;

    if (!drag) { return; }
    event.accept();
    if (event.isCanceled() || !this.valid(drag)) {
      this.cancel(event.isCanceled() ? 'pointer' : 'context');

      return;
    }
    this.drag = undefined;
    this.owner.emit('actioncommit', drag.action);
  }
  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (event.ctrlPressed || event.metaPressed) { return; }
    if (key === 'w' || key === 'e' || key === 'r') { this.setOperation(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale'); event.accept(); } else if (key === 'x') { this.setSpace(this.space === 'world' ? 'local' : 'world'); event.accept(); } else if (key === 'escape') { this.cancel('escape'); event.accept(); }
  }
}
function around (pivot: Point3, matrix: Matrix4): Matrix4 {
  return new Matrix4().setPosition(vector(pivot)).multiply(matrix).multiply(new Matrix4().setPosition(vector(mul3(pivot, -1))));
}
