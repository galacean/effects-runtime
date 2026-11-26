import { math, glContext, MouseButton, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey, type Renderer, type VFXItem } from '@galacean/effects';
import type { Editor3D } from '../editor-3d';
import { rayPlanePoint } from '../../math/plane';
import type { Point2, Point3 } from '../../math/types';
import { sub3, mul3, dot3, cross3, unit3, length3 } from '../../math/vector3';
import { Gizmo3D, type Transform3DActionEvent, type Transform3DOperation, type Viewport3DSpace } from './gizmo-3d';
import type { NativeGizmoType } from './viewport-gizmo-picker';
import { gizmoSubTypes } from './viewport-gizmo-picker';
import { GizmoGeometry } from './gizmo-geometry';
import { moveToPointWidthFixDistance } from '../util';

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
  startPoint: Point3,
  planeNormal: Point3,
  viewNormal: Point3,
  scaleDistance: number,
  previousRotation: Point3,
  rotationAngle: number,
}

function matchesLocal (item: VFXItem, value: LocalTransform): boolean {
  return item.transform.position.equals(value.position) && item.transform.getQuaternion().equals(value.quat)
    && item.transform.scale.equals(value.scale);
}
const vector = (p: Point3): Vector3 => new Vector3(p.x, p.y, p.z);
const identity = new Matrix4();
const axes: Point3[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
const transformKeys = ['position', 'quat', 'scale'] as const;

/** The visible handle and the drag operation share the same world-space pivot and orientation. */
export function getTransformGizmoPose (items: readonly VFXItem[], space: Viewport3DSpace) {
  const pivot = new Vector3();
  const rotation = new Quaternion();

  for (const item of items) { pivot.add(item.transform.getWorldPosition()); }
  pivot.multiply(1 / items.length);
  if (space === 'local') { items[0].transform.assignWorldTRS(undefined, rotation); }

  return { pivot, rotation };
}

/** Perspective ray-based axes, planes, rotation rings and scale handles. */
export class TransformGizmo3D extends Gizmo3D {
  readonly type = 'transform-3d';
  operation: Transform3DOperation;
  space: Viewport3DSpace;
  private drag?: TransformDrag;
  private readonly geometries = new Map<Transform3DOperation, GizmoGeometry>();
  geometry?: GizmoGeometry;
  constructor (owner: Editor3D, options: TransformGizmo3DOptions = {}) {
    super(owner);
    this.operation = options.transform ?? 'translate';
    this.space = options.space ?? 'world';
  }

  updateGeometry (): void {
    this.geometry = undefined;
    const composition = this.owner.composition;
    const items = this.owner.selectionGizmo.items;

    if (!composition || this.owner.tool === 'camera' || !items.length || items.some(item => !this.owner.selectionGizmo.canTransform(item))) { return; }
    let geometry = this.geometries.get(this.operation);

    if (!geometry) {
      geometry = new GizmoGeometry(this.owner.engine, gizmoSubTypes[this.nativeType()], { size: { scale: 2 }, renderMode: glContext.TRIANGLES });
      this.geometries.set(this.operation, geometry);
    }
    const { pivot, rotation } = getTransformGizmoPose(items, this.space);
    const cameraPosition = composition.camera.worldPosition;
    const center = moveToPointWidthFixDistance(cameraPosition, pivot);

    geometry.updateMatrix(new Matrix4().compose(center, rotation, Vector3.ONE));
    if (this.operation === 'rotate') {
      for (const { data: { material } } of geometry.parts) {
        material.setVector3('u_cameraPos', cameraPosition);
        material.setVector3('u_center', center);
      }
    }
    this.geometry = geometry;
  }

  override draw (renderer: Renderer): void {
    this.updateGeometry();
    this.geometry?.draw(renderer);
  }

  override dispose (): void {
    this.geometries.forEach(geometry => geometry.dispose());
    this.geometries.clear();
    this.geometry = undefined;
  }

  hasGeometry (operation: Transform3DOperation): boolean {
    return !!this.geometries.get(operation)?.parts.length;
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
    this.owner.updateGizmos();
    this.owner.emit('actioncommit', { ...drag.action, canceled: true, reason });
  }
  setOperation (operation: Transform3DOperation): void { this.cancel('operation'); this.operation = operation; }
  setSpace (space: Viewport3DSpace): void { this.cancel('space'); this.space = space; }
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
    const { pivot, rotation } = getTransformGizmoPose(selected, this.space);
    const frame = { pivot, rotation, axes: axes.map(axis => vector(axis).applyQuaternion(rotation)) };
    const viewNormal = this.owner.composition!.camera.getInverseViewMatrix().transformNormal(new Vector3(0, 0, 1));
    let planeNormal: Point3 = viewNormal;

    if (typeof handle === 'number' && this.operation !== 'rotate') {
      const axis = frame.axes[handle];

      planeNormal = unit3(cross3(axis, cross3(axis, viewNormal)));
    } else if (typeof handle === 'string' && handle !== 'view' && handle !== 'all') {
      const [a, b] = this.planeAxes(handle);

      planeNormal = cross3(frame.axes[a], frame.axes[b]);
    }
    const startPoint = rayPlanePoint(ray, frame.pivot, planeNormal);

    if (!startPoint) { return; }
    const offset = sub3(startPoint, pivot);
    const drag: TransformDrag = {
      action: { source: this, transformType: this.operation, itemIds: selected.map(item => item.getInstanceId()) },
      items: [], composition: this.owner.composition,
      frame, handle, start: event.position.clone(), startPoint, planeNormal, viewNormal,
      scaleDistance: Math.max(length3(offset), 1e-6),
      previousRotation: unit3(offset), rotationAngle: 0,
    };

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
    const { frame, handle, start, startPoint, viewNormal } = drag;
    const point = rayPlanePoint(ray, frame.pivot, drag.planeNormal);

    if (!point) { return; }
    const motion = sub3(point, startPoint);
    let operation = new Matrix4();

    if (this.operation === 'translate') {
      let delta = motion;

      if (typeof handle === 'number') {
        let distance = dot3(motion, frame.axes[handle]);

        if (event.shiftPressed) { distance = Math.round(distance * 10) / 10; }
        delta = mul3(frame.axes[handle], distance);
      }
      operation.setPosition(vector(delta));
    } else if (this.operation === 'rotate' && typeof handle === 'number') {
      const axis = frame.axes[handle];
      const edgeOn = Math.abs(dot3(viewNormal, axis)) < Math.cos(85 * Math.PI / 180);
      let angle: number;

      if (edgeOn) {
        angle = dot3(motion, cross3(viewNormal, axis)) * Math.PI / (2 * drag.scaleDistance);
      } else {
        const current = unit3(sub3(point, frame.pivot));
        const cross = cross3(drag.previousRotation, current);

        drag.rotationAngle += Math.atan2(length3(cross), dot3(drag.previousRotation, current)) * Math.sign(dot3(axis, cross));
        drag.previousRotation = current;
        angle = drag.rotationAngle;
      }
      if (event.shiftPressed) { angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12; }
      operation = around(frame.pivot, new Matrix4().setFromQuaternion(new Quaternion().setFromAxisAngle(vector(axis), angle)));
    } else if (this.operation === 'scale') {
      const scale = new Vector3(1, 1, 1);
      const affected = typeof handle === 'number' ? [handle] : handle === 'all' ? [0, 1, 2] : this.planeAxes(handle);

      for (const index of affected) {
        let factor = handle === 'all'
          ? 1 + (start.y - event.position.y) / 100
          : 1 + dot3(motion, frame.axes[index]) / drag.scaleDistance;

        factor = Math.max(0.01, factor);
        if (event.shiftPressed) { factor = Math.max(0.1, Math.round(factor * 10) / 10); }
        scale.setElement(index, factor);
      }
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
    for (const [index, entry] of drag.items.entries()) {
      entry.preview ??= { ...entry.before };
      for (const key of transformKeys) {
        const change = { [key]: after[index][key] };

        // A setter can synchronously cancel the drag. Only the properties written so far belong to this preview.
        Object.assign(entry.preview, change);
        entry.item.transform.setTransform(change);
        if (this.drag !== drag) { return; }
      }
    }
    this.owner.updateGizmos();
    event.accept();
    if (this.drag === drag) { this.owner.emit('actionupdate', drag.action); }
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
    if (key === 'w' || key === 'e' || key === 'r') {
      this.owner.setTool(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale');
      event.accept();
    } else if (key === 'x') {
      this.owner.setTool(this.operation, this.space === 'world' ? 'local' : 'world');
      event.accept();
    } else if (key === 'escape') {
      this.cancel('escape');
      event.accept();
    }
  }
}
function around (pivot: Point3, matrix: Matrix4): Matrix4 {
  return new Matrix4().setPosition(vector(pivot)).multiply(matrix).multiply(new Matrix4().setPosition(vector(mul3(pivot, -1))));
}
