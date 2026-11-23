import { MouseButton, Transform, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { createSelectionInteractionGizmo } from '../selection/create-selection-interaction-gizmo';
import { getPlayerItemById } from '../items';
import type { Vector2 } from '../math';
import { Vector3, Quaternion, Matrix4, Euler } from '../math';
import { toColor } from '../drawing';
import type { EditMode } from './edit-mode';
import type { SpatialEditHost, Transform3DSnapshot, NativeGizmoType, Point3 } from './spatial-edit-host';
import { SpatialEditSession } from './spatial-edit-session';
import { add3, sub3, mul3, dot3, cross3, length3, unit3, rayPlanePoint, rayAxisParameter } from './spatial-math';
import { FloorGridGizmo, Viewport3DGizmo } from './viewport-3d-edit-mode';

export interface Transform3DEditModeOptions {
  transform?: 'translate' | 'rotate' | 'scale',
  space?: 'local' | 'world',
}

type Handle = 0 | 1 | 2 | 'xy' | 'xz' | 'yz' | 'all' | 'view';
type Frame = { pivot: Point3, axes: Point3[], length: number, rotation: Quaternion };
type Initial = { id: string, world: Matrix4, inverseParent: Matrix4, anchor: Vector3 };
const vector = (p: Point3): Vector3 => new Vector3(p.x, p.y, p.z);
const axes: Point3[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
const colors = [0xe05252, 0x55bf69, 0x549cfa];

/** Perspective ray-based axes, planes, rotation rings and scale handles. */
export class Transform3DGizmo extends Gizmo {
  readonly type = 'transform-3d';
  operation: 'translate' | 'rotate' | 'scale';
  space: 'local' | 'world';
  private session?: SpatialEditSession<'transform-3d'>;
  private frame?: Frame;
  private initial: Initial[] = [];
  private handle?: Handle;
  private start?: Vector2;
  private startValue?: number;
  private startPoint?: Point3;
  private viewNormal?: Point3;
  constructor (owner: GizmoOwner, private readonly host: SpatialEditHost, options: Transform3DEditModeOptions = {}) {
    super(owner); this.operation = options.transform ?? 'translate'; this.space = options.space ?? 'world';
  }
  override onUpdate (): void { if (this.session && !this.session.valid()) { this.cancel('context'); } }
  cancel (reason: string): void {
    this.session?.cancel(reason); this.session = undefined; this.frame = undefined; this.handle = undefined; this.initial = []; this.start = undefined; this.viewNormal = undefined;
  }
  override dispose (): void { this.cancel('dispose'); }
  setOperation (operation: 'translate' | 'rotate' | 'scale'): void { this.cancel('operation'); this.operation = operation; }
  setSpace (space: 'local' | 'world'): void { this.cancel('space'); this.space = space; }
  private getFrame (): Frame | undefined {
    if (this.frame) { return this.frame; }
    const target = this.host.read('transform-3d');

    if (!target?.data.length) { return; }
    const pivot = mul3(target.data.reduce((sum, item) => add3(sum, this.host.localToWorld({ x: 0, y: 0, z: 0 }, item.id)), { x: 0, y: 0, z: 0 }), 1 / target.data.length);
    const center = this.host.project(pivot);

    if (!center) { return; }
    const ray = this.host.ray(center), side = this.host.ray({ x: center.x + 80, y: center.y });
    const point = ray && side && rayPlanePoint(side, pivot, ray.direction);

    if (!point) { return; }
    const rotation = new Quaternion();

    if (this.space === 'local') {
      const item = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], target.data[0].id);

      item?.transform.assignWorldTRS(undefined, rotation);
    }

    return { pivot, rotation, length: Math.max(1e-6, length3(sub3(point, pivot))), axes: axes.map(axis => vector(axis).applyQuaternion(rotation)) };
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
    if (key === 'center') { return 'all'; }

    return;
  }
  private ring (frame: Frame, axis: number): Point3[] {
    const a = frame.axes[(axis + 1) % 3], b = frame.axes[(axis + 2) % 3];

    return Array.from({ length: 65 }, (_, i) => add3(frame.pivot, mul3(add3(mul3(a, Math.cos(i * Math.PI / 32)), mul3(b, Math.sin(i * Math.PI / 32))), frame.length)));
  }
  private hit (p: Vector2, frame: Frame): Handle | undefined {
    let best = 8, hit: Handle | undefined;
    const center = this.host.project(frame.pivot);

    if (!center) { return; }
    const native = this.host.nativeGizmoHit?.(p, this.nativeType());
    const nativeHit = native && this.nativeHandle(native.key);

    if (nativeHit !== undefined) { return nativeHit; }
    if (this.operation === 'scale' && center.distance(p) < 8) { return 'all'; }
    // The legacy 3D TransformGizmo used its center handle for camera-facing
    // translation (T3D). Keep that interaction in the mode API so existing
    // toolbar behavior remains available without reviving the old stateful
    // TransformGizmo implementation.
    if (this.operation === 'translate' && center.distance(p) < 8) { return 'view'; }
    for (let axis = 0; axis < 3; axis++) {
      const points = this.operation === 'rotate' ? this.ring(frame, axis) : [add3(frame.pivot, mul3(frame.axes[axis], frame.length * 0.2)), add3(frame.pivot, mul3(frame.axes[axis], frame.length))];

      for (let i = 1; i < points.length; i++) {
        const a = this.host.project(points[i - 1]), b = this.host.project(points[i]);

        if (!a || !b) { continue; }
        const d = distanceSegment(p, a, b);

        if (d < best) { best = d; hit = axis as 0 | 1 | 2; }
      }
    }
    if (hit !== undefined || this.operation !== 'translate') { return hit; }
    for (const plane of ['xy', 'xz', 'yz'] as const) {
      const [a, b] = this.planeAxes(plane); const ray = this.host.ray(p);
      const q = ray && rayPlanePoint(ray, frame.pivot, cross3(frame.axes[a], frame.axes[b]));

      if (!q) { continue; }
      const delta = sub3(q, frame.pivot), u = dot3(delta, frame.axes[a]) / frame.length, v = dot3(delta, frame.axes[b]) / frame.length;

      if (u >= 0.15 && u <= 0.4 && v >= 0.15 && v <= 0.4) { return plane; }
    }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    const target = this.host.read('transform-3d'), frame = this.getFrame(), ray = this.host.ray(event.position);

    if (!target || !frame || !ray || !this.host.canEdit('transform-3d', target.id)) { return; }
    const handle = this.hit(event.position, frame);

    if (handle === undefined) { return; }
    this.cancel('restart'); this.handle = handle; this.frame = frame; this.start = event.position.clone();
    if (typeof handle === 'number') {
      if (this.operation === 'rotate') { this.startPoint = rayPlanePoint(ray, frame.pivot, frame.axes[handle]); } else { this.startValue = rayAxisParameter(ray, frame.pivot, frame.axes[handle]); }
      if (this.operation === 'rotate' ? !this.startPoint : this.startValue === undefined) {
        this.cancel('parallel');

        return;
      }
    } else if (handle === 'view') {
      this.viewNormal = unit3(ray.direction);
      this.startPoint = rayPlanePoint(ray, frame.pivot, this.viewNormal);
      if (!this.startPoint) {
        this.cancel('parallel');

        return;
      }
    } else if (handle !== 'all') {
      const [a, b] = this.planeAxes(handle);

      this.startPoint = rayPlanePoint(ray, frame.pivot, cross3(frame.axes[a], frame.axes[b]));
      if (!this.startPoint) {
        this.cancel('parallel');

        return;
      }
    }
    for (const snapshot of target.data) {
      const item = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], snapshot.id);

      if (!item) {
        this.cancel('missing');

        return;
      }
      const parent = item.transform.getParentMatrix()?.clone() ?? new Matrix4();

      if (Math.abs(parent.determinant()) < 1e-10) {
        this.cancel('singular');

        return;
      }
      this.initial.push({ id: snapshot.id, inverseParent: parent.invert(), world: item.transform.getWorldMatrix().clone(), anchor: item.transform.anchor.clone() });
    }
    this.session = new SpatialEditSession('transform-3d', target, this.host); event.accept();
  }
  override onMouseDrag (event: InputEventMouseMotion): void {
    const { session, frame, handle, start } = this; const ray = this.host.ray(event.position);

    if (!session || !frame || handle === undefined || !start || !ray) { return; }
    let operation = new Matrix4();

    if (this.operation === 'translate') {
      let delta: Point3;

      if (typeof handle === 'number') {
        const value = rayAxisParameter(ray, frame.pivot, frame.axes[handle]);

        if (value === undefined) { return; }
        let distance = value - this.startValue!;

        if (event.shiftPressed) { distance = Math.round(distance * 10) / 10; }
        delta = mul3(frame.axes[handle], distance);
      } else if (handle === 'view') {
        const p = this.viewNormal && rayPlanePoint(ray, frame.pivot, this.viewNormal);

        if (!p || !this.startPoint) { return; }
        delta = sub3(p, this.startPoint);
      } else {
        const [a, b] = this.planeAxes(handle); const p = rayPlanePoint(ray, frame.pivot, cross3(frame.axes[a], frame.axes[b]));

        if (!p || !this.startPoint) { return; }
        delta = sub3(p, this.startPoint);
      }
      operation.setPosition(vector(delta));
    } else if (this.operation === 'rotate' && typeof handle === 'number') {
      const p = rayPlanePoint(ray, frame.pivot, frame.axes[handle]);

      if (!p || !this.startPoint) { return; }
      const a = unit3(sub3(this.startPoint, frame.pivot)), b = unit3(sub3(p, frame.pivot));
      let angle = Math.atan2(dot3(frame.axes[handle], cross3(a, b)), dot3(a, b));

      if (event.shiftPressed) { angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12; }
      operation = around(frame.pivot, new Matrix4().setFromQuaternion(new Quaternion().setFromAxisAngle(vector(frame.axes[handle]), angle)));
    } else if (this.operation === 'scale') {
      const value = typeof handle === 'number' ? rayAxisParameter(ray, frame.pivot, frame.axes[handle]) : undefined;
      let factor = handle === 'all' ? Math.exp((start.y - event.position.y) / 100) : (value ?? this.startValue!) / this.startValue!;

      if (!Number.isFinite(factor)) { return; } factor = Math.max(0.01, factor);
      if (event.shiftPressed) { factor = Math.max(0.1, Math.round(factor * 10) / 10); }
      const scale = new Vector3(handle === 0 || handle === 'all' ? factor : 1, handle === 1 || handle === 'all' ? factor : 1, handle === 2 || handle === 'all' ? factor : 1);
      const basis = new Matrix4().setFromQuaternion(frame.rotation);

      operation = around(frame.pivot, basis.clone().multiply(new Matrix4().compose(new Vector3(), new Quaternion(), scale)).multiply(basis.invert()));
    }
    const after: Transform3DSnapshot[] = [];

    for (const initial of this.initial) {
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
      const rotation = Transform.getRotation(q, new Euler());

      const before = session.before.find(item => item.id === initial.id)!;

      after.push({ id: initial.id, position: [p.x, p.y, p.z],
        quaternion: this.operation === 'translate' ? before.quaternion : [q.x, q.y, q.z, q.w],
        rotation: this.operation === 'translate' ? before.rotation : [rotation.x, rotation.y, rotation.z],
        scale: this.operation === 'translate' || this.operation === 'rotate' ? before.scale : [s.x, s.y, s.z] });
    }
    session.update(after); event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.session) { return; } const session = this.session;

    this.session = undefined;
    if (event.isCanceled()) { session.cancel('pointer'); } else { session.commit(); } this.cancel('finished'); event.accept();
  }
  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (event.ctrlPressed || event.metaPressed) { return; }
    if (key === 'w' || key === 'e' || key === 'r') { this.setOperation(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale'); event.accept(); } else if (key === 'x') { this.setSpace(this.space === 'world' ? 'local' : 'world'); event.accept(); } else if (key === 'escape') { this.cancel('escape'); event.accept(); }
  }
  override draw (control: Control): void {
    if (this.host.nativeGizmoVisible?.(this.nativeType())) { return; }
    const frame = this.getFrame();

    if (!frame) { return; }
    for (let i = 0; i < 3; i++) {
      const points = (this.operation === 'rotate' ? this.ring(frame, i) : [frame.pivot, add3(frame.pivot, mul3(frame.axes[i], frame.length))]).map(p => this.host.project(p));

      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1], b = points[j];

        if (a && b) { control.drawLine(a.x, a.y, b.x, b.y, toColor(colors[i], 1), 2); }
      }
      const end = points[points.length - 1];

      if (this.operation !== 'rotate' && end) { control.fillCircle(end.x, end.y, this.operation === 'scale' ? 6 : 4, toColor(colors[i], 1)); }
    }
    if (this.operation === 'translate') {
      for (const plane of ['xy', 'xz', 'yz']) {
        const [a, b] = this.planeAxes(plane); const points = [[0.15, 0.15], [0.4, 0.15], [0.4, 0.4], [0.15, 0.4], [0.15, 0.15]].map(([u, v]) => this.host.project(add3(frame.pivot, mul3(add3(mul3(frame.axes[a], u), mul3(frame.axes[b], v)), frame.length))));

        for (let i = 1; i < points.length; i++) {
          const p = points[i - 1], q = points[i];

          if (p && q) { control.drawLine(p.x, p.y, q.x, q.y, toColor(colors[a], 0.8), 1); }
        }
      }
    }
    const p = this.host.project(frame.pivot);

    if (p && this.operation === 'translate') { control.drawRect(p.x - 6, p.y - 6, 12, 12, toColor(0xffffff, 1), 2); }
    if (p && this.operation === 'scale') { control.drawRect(p.x - 6, p.y - 6, 12, 12, toColor(0xffffff, 1), 2); }
  }
}
function around (pivot: Point3, matrix: Matrix4): Matrix4 {
  return new Matrix4().setPosition(vector(pivot)).multiply(matrix).multiply(new Matrix4().setPosition(vector(mul3(pivot, -1))));
}
function distanceSegment (p: Vector2, a: Vector2, b: Vector2): number {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;

  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export class Transform3DEditMode implements EditMode {
  readonly id = 'transform-3d';
  private gizmo?: Transform3DGizmo;
  private viewport?: Viewport3DGizmo;
  constructor (private readonly owner: GizmoOwner, private readonly host: SpatialEditHost, private readonly options: Transform3DEditModeOptions = {}) {}
  canRemainActiveForTool (tool: GizmoTool): boolean { return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool; }
  createGizmos (): Gizmo[] {
    const options = this.gizmo ? { transform: this.gizmo.operation, space: this.gizmo.space } : this.options;

    this.gizmo?.cancel('rebuild');
    this.viewport?.cancel('rebuild');
    this.gizmo = new Transform3DGizmo(this.owner, this.host, options);
    this.viewport = new Viewport3DGizmo(this.owner, this.host);

    // World editing keeps the original ViewHelper/navigation path active next
    // to the native TransformGizmo handles, matching the legacy selector order.
    return [this.viewport, new FloorGridGizmo(this.owner, this.host), this.gizmo, createSelectionInteractionGizmo(this.owner, { allowTransform: false })];
  }
  onEnter (): void { this.owner.getSelection().clearHover(); }
  onMouseWheel (event: InputEventMouseButton): void { this.viewport?.onMouseWheel(event); }
  onExit (): void { this.gizmo?.cancel('mode-exit'); this.viewport?.cancel('mode-exit'); }
}
