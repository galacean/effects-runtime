import { math, glContext, MouseButton, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type InputEventKey, type Renderer, type VFXItem } from '@galacean/effects';
import type { Editor3D } from '../editor-3d';
import { rayPlanePoint } from '../../math/plane';
import type { Point2, Point3 } from '../../math/types';
import { sub3, mul3, dot3, cross3, unit3 } from '../../math/vector3';
import { Gizmo3D, type Transform3DActionEvent, type Transform3DOperation, type Viewport3DSpace, type Viewport3DPivotMode } from './gizmo-3d';
import type { NativeGizmoType } from './viewport-gizmo-picker';
import { gizmoSubTypes } from './viewport-gizmo-picker';
import { GizmoGeometry } from './gizmo-geometry';
import { moveToPointWidthFixDistance } from '../util';
import { getItemWorldBoundsCorners } from './item-bounds';

const { Vector3, Quaternion, Matrix4 } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

export interface TransformGizmo3DOptions {
  transform?: Transform3DOperation,
  space?: Viewport3DSpace,
  pivotMode?: Viewport3DPivotMode,
}

type Handle = 0 | 1 | 2 | 'xy' | 'xz' | 'yz' | 'all' | 'view';
type Frame = { pivot: Point3, axes: Point3[], rotation: Quaternion };
type LocalTransform = { position: Vector3, quat: Quaternion, scale: Vector3 };
type DragItem = {
  item: VFXItem, world: Matrix4, inverseParent: Matrix4, anchor: Vector3,
  before: LocalTransform, preview?: LocalTransform, parent?: VFXItem, parentWorld: Matrix4,
  rotation: Quaternion,
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
  handleSize: number,
  scaleDirection: Vector3,
  scale: Vector3,
  translation: Point3,
  rotationAxis: Vector3,
  rotationFrom: Vector3,
  rotationDelta: Quaternion,
  rotationAngle: number,
  lastMouse: Vector2,
}

function matchesLocal (item: VFXItem, value: LocalTransform): boolean {
  return item.transform.position.equals(value.position) && item.transform.getQuaternion().equals(value.quat)
    && item.transform.scale.equals(value.scale);
}
const vector = (p: Point3): Vector3 => new Vector3(p.x, p.y, p.z);
const identity = new Matrix4();
const axes: Point3[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
const transformKeys = ['position', 'quat', 'scale'] as const;

function getWorldRotation (item: VFXItem): Quaternion {
  const rotation = new Quaternion();

  for (let transform: typeof item.transform | null | undefined = item.transform; transform; transform = transform.parentTransform) {
    rotation.copyFrom(transform.getQuaternion().clone().multiply(rotation));
  }

  return rotation;
}

/** The visible handle and the drag operation share the same world-space pivot and orientation. */
export function getTransformGizmoPose (
  items: readonly VFXItem[], space: Viewport3DSpace, mode: Viewport3DPivotMode = 'center', active = items[items.length - 1],
) {
  const pivot = new Vector3();
  const rotation = new Quaternion();

  if (mode === 'pivot') {
    pivot.copyFrom(active.transform.getWorldPosition());
  } else {
    const points = getItemWorldBoundsCorners(items);
    const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);

    for (const point of points) { min.min(point); max.max(point); }
    pivot.copyFrom(min).add(max).multiply(0.5);
  }
  if (space === 'local') { rotation.copyFrom(getWorldRotation(active)); }

  return { pivot, rotation };
}

/** Perspective ray-based axes, planes, rotation rings and scale handles. */
export class TransformGizmo3D extends Gizmo3D {
  readonly type = 'transform-3d';
  operation: Transform3DOperation;
  space: Viewport3DSpace;
  pivotMode: Viewport3DPivotMode;
  private drag?: TransformDrag;
  private hoveredHandle?: Handle;
  private readonly geometries = new Map<Transform3DOperation, GizmoGeometry>();
  geometry?: GizmoGeometry;
  constructor (owner: Editor3D, options: TransformGizmo3DOptions = {}) {
    super(owner);
    this.operation = options.transform ?? 'translate';
    this.space = options.space ?? 'world';
    this.pivotMode = options.pivotMode ?? 'center';
  }

  private getPose (items: readonly VFXItem[]) {
    const space = this.operation === 'scale' && items.length === 1 ? 'local' : this.space;

    return getTransformGizmoPose(items, space, this.pivotMode, this.owner.selectionGizmo.activeItem);
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
    const pose = this.drag?.frame ?? this.getPose(items);
    const pivot = this.drag ? vector(pose.pivot).add(vector(this.drag.translation)) : pose.pivot;
    const rotation = this.drag && this.operation === 'rotate' ? this.drag.rotationDelta.clone().multiply(pose.rotation) : pose.rotation;
    const cameraPosition = composition.camera.worldPosition;
    const center = moveToPointWidthFixDistance(cameraPosition, vector(pivot));
    const size = this.owner.getHandleSize(center) / 1.6;

    if (this.operation === 'scale') { geometry.updateScale(this.drag?.scale ?? Vector3.ONE); }
    const active = this.handleKey(this.drag?.handle ?? this.hoveredHandle);

    geometry.highlight(active, this.operation === 'scale' && this.drag?.handle === 'all');
    if (this.operation === 'rotate') {
      const inverse = rotation.clone().conjugate();
      const viewRotation = inverse.clone().multiply(composition.camera.getInverseViewMatrix().getTransform().rotation);
      const drag = this.drag;
      const feedback = drag && drag.handle !== 'all' ? {
        axis: drag.rotationAxis.clone().applyQuaternion(inverse), from: drag.rotationFrom.clone().applyQuaternion(inverse), angle: drag.rotationAngle,
      } : undefined;

      geometry.updateRotation(viewRotation, active, feedback);
    }
    geometry.updateMatrix(new Matrix4().compose(center, rotation, new Vector3(size, size, size)));
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

  hover (point?: Point2): void {
    if (this.drag) { return; }
    this.hoveredHandle = point ? this.pickHandle(point) : undefined;
    this.geometry?.highlight(this.handleKey(this.hoveredHandle));
  }

  private handleKey (handle?: Handle): string | undefined {
    if (this.operation === 'rotate' && (handle === 'view' || handle === 'all')) { return handle === 'view' ? 'screenRing' : 'freeRing'; }

    return handle === undefined ? undefined : typeof handle === 'number' ? ['xAxis', 'yAxis', 'zAxis'][handle]
      : handle === 'xy' ? 'xyPlane' : handle === 'yz' ? 'yzPlane' : handle === 'xz' ? 'zxPlane' : 'center';
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
    if (key === 'screenRing') { return 'view'; }
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
    if (this.owner.tool !== this.operation) { return; }
    const hit = this.owner.picker.hit(point, this.nativeType());

    if (hit) { return this.nativeHandle(hit.key); }
    if (this.operation === 'rotate' && this.owner.selectionGizmo.items.length) {
      const center = this.owner.project(this.getPose(this.owner.selectionGizmo.items).pivot);

      if (center && center.distance(new math.Vector2(point.x, point.y)) < 80) { return 'all'; }
    }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    const selected = this.owner.selectionGizmo.items;

    if (!selected.length || selected.some(item => !this.owner.selectionGizmo.canTransform(item))) { return; }
    const hit = this.owner.picker.hit(event.position, this.nativeType());
    const handle = hit ? this.nativeHandle(hit.key) : this.pickHandle(event.position);

    if (handle === undefined) { return; }
    const ray = this.owner.ray(event.position);

    if (!ray) { return; }
    this.cancel('restart');
    const { pivot, rotation } = this.getPose(selected);
    const frame = { pivot, rotation, axes: axes.map(axis => vector(axis).applyQuaternion(rotation)) };
    const viewNormal = this.owner.composition!.camera.getInverseViewMatrix().transformNormal(new Vector3(0, 0, 1));
    let planeNormal: Point3 = viewNormal;

    if (typeof handle === 'number' && this.operation === 'translate') {
      const axis = frame.axes[handle];

      planeNormal = unit3(cross3(axis, cross3(axis, viewNormal)));
    } else if (typeof handle === 'string' && handle !== 'view' && handle !== 'all') {
      const [a, b] = this.planeAxes(handle);

      planeNormal = cross3(frame.axes[a], frame.axes[b]);
    }
    let startPoint = rayPlanePoint(ray, frame.pivot, planeNormal) ?? (this.operation !== 'translate' ? pivot : undefined);

    if (!startPoint) { return; }
    const handleSize = this.owner.getHandleSize(pivot);

    if (handleSize <= 0) { return; }
    if (this.operation === 'rotate' && hit?.position && this.geometry) {
      const radial = vector(hit.position).subtract(this.geometry.matrix.getTranslation(new Vector3())).normalize();

      startPoint = vector(pivot).add(radial.multiply(handleSize * (handle === 'view' ? 1.1 : 1)));
    }
    const cameraMatrix = this.owner.composition!.camera.getInverseViewMatrix();
    const screenDirection = cameraMatrix.transformNormal(new Vector3(1, 1, 0)).normalize();
    const rotationAxis = typeof handle === 'number' ? vector(frame.axes[handle]) : viewNormal.clone();
    const rotationFrom = vector(startPoint).subtract(pivot).normalize();
    const drag: TransformDrag = {
      action: { source: this, transformType: this.operation, itemIds: selected.map(item => item.getInstanceId()) },
      items: [], composition: this.owner.composition,
      frame, handle, start: event.position.clone(), startPoint, planeNormal,
      handleSize, scaleDirection: screenDirection,
      scale: new Vector3(1, 1, 1), translation: new Vector3(),
      rotationAxis, rotationFrom, rotationDelta: new Quaternion(), rotationAngle: 0, lastMouse: event.position.clone(),
    };

    for (const item of selected) {
      const transform = item.transform;
      const parentWorld = (transform.getParentMatrix() ?? identity).clone();
      const worldRotation = getWorldRotation(item);

      if (Math.abs(parentWorld.determinant()) < 1e-10) { return; }
      drag.items.push({
        item, parent: item.parent, parentWorld, inverseParent: parentWorld.clone().invert(),
        world: transform.getWorldMatrix().clone(), anchor: transform.anchor.clone(),
        rotation: worldRotation,
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
    const { frame, handle, start, startPoint } = drag;
    const point = this.operation === 'translate' ? rayPlanePoint(ray, frame.pivot, drag.planeNormal) : undefined;

    if (this.operation === 'translate' && !point) { return; }
    const motion = point ? sub3(point, startPoint) : new Vector3();
    const snapping = event.ctrlPressed || event.metaPressed;
    let operation = new Matrix4();

    if (this.operation === 'translate') {
      let delta = motion;

      if (typeof handle === 'number') {
        let distance = this.owner.getLineTranslation(start, event.position, frame.pivot, frame.axes[handle]);

        if (snapping) { distance = Math.round(distance * 10) / 10; }
        delta = mul3(frame.axes[handle], distance);
      }
      operation.setPosition(vector(delta));
      drag.translation = delta;
    } else if (this.operation === 'rotate') {
      if (handle === 'all') {
        const motion = event.position.clone().subtract(drag.lastMouse);
        const axis = this.owner.composition!.camera.getInverseViewMatrix().transformNormal(new Vector3(-motion.y, -motion.x, 0)).normalize();

        drag.rotationDelta = new Quaternion().setFromAxisAngle(axis, motion.length() * Math.PI / 180).multiply(drag.rotationDelta);
      } else {
        const tangent = new Vector3().crossVectors(drag.rotationAxis, drag.rotationFrom).normalize();
        const radius = drag.handleSize * (handle === 'view' ? 1.1 : 1);
        let angle = this.owner.getLineTranslation(start, event.position, startPoint, tangent) / radius * Math.PI / 6;

        if (snapping && handle !== 'view') { angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12; }
        drag.rotationAngle = angle;
        drag.rotationDelta.setFromAxisAngle(drag.rotationAxis, angle);
      }
      operation = around(frame.pivot, new Matrix4().setFromQuaternion(drag.rotationDelta));
    } else if (this.operation === 'scale') {
      const scale = new Vector3(1, 1, 1);
      const affected = typeof handle === 'number' ? [handle] : handle === 'all' ? [0, 1, 2] : this.planeAxes(handle);

      for (const index of affected) {
        const direction = handle === 'all' ? drag.scaleDirection : frame.axes[index];
        let factor = 1 + this.owner.getLineTranslation(start, event.position, frame.pivot, direction) / drag.handleSize;

        if (snapping) { factor = Math.round(factor * 10) / 10; }
        scale.setElement(index, factor);
      }
      drag.scale.copyFrom(scale);
    }
    drag.lastMouse.copyFrom(event.position);
    const after: LocalTransform[] = [];

    for (const initial of drag.items) {
      if (this.operation === 'scale') {
        after.push(this.scaleItem(initial, drag));

        continue;
      }
      let itemOperation = operation;

      if (this.operation === 'rotate' && this.pivotMode === 'pivot') {
        let rotation = drag.rotationDelta;

        if (this.space === 'local') {
          const local = frame.rotation.clone().conjugate().multiply(rotation).multiply(frame.rotation);

          rotation = initial.rotation.clone().multiply(local).multiply(initial.rotation.clone().conjugate());
        }
        itemOperation = around(initial.world.getTranslation(new Vector3()), new Matrix4().setFromQuaternion(rotation));
      }
      const local = initial.inverseParent.clone().multiply(itemOperation).multiply(initial.world);
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
        scale: initial.before.scale });
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

  private scaleItem (initial: DragItem, drag: TransformDrag): LocalTransform {
    const individual = drag.items.length === 1 || this.pivotMode === 'pivot' && this.space === 'local';
    const scale = individual ? drag.scale : alignScale(drag.scale, drag.frame.rotation, initial.rotation);
    const s = initial.before.scale.clone().multiply(scale);
    const q = initial.before.quat;
    const origin = initial.world.getTranslation(new Vector3()).applyMatrix(initial.inverseParent);
    let position = origin.clone();

    if (this.pivotMode === 'center') {
      const pivot = vector(drag.frame.pivot).applyMatrix(initial.inverseParent);

      if (individual) {
        position.subtract(pivot).applyQuaternion(q.clone().conjugate()).multiply(drag.scale).applyQuaternion(q).add(pivot);
      } else {
        position = initial.world.getTranslation(new Vector3()).subtract(vector(drag.frame.pivot))
          .applyQuaternion(drag.frame.rotation.clone().conjugate()).multiply(drag.scale)
          .applyQuaternion(drag.frame.rotation).add(vector(drag.frame.pivot)).applyMatrix(initial.inverseParent);
      }
    }
    position.add(initial.anchor.clone().multiply(s).applyQuaternion(q));

    return { position, quat: q, scale: s };
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
    this.owner.updateGizmos();
    this.owner.emit('actioncommit', drag.action);
  }
  override onKeyDown (event: InputEventKey): void {
    const key = event.keycode.toLowerCase();

    if (event.ctrlPressed || event.metaPressed) { return; }
    if (key === 'q') {
      this.owner.setTool('camera');
      event.accept();
    } else if (key === 'w' || key === 'e' || key === 'r') {
      this.owner.setTool(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale');
      event.accept();
    } else if (key === 'x') {
      this.owner.setTool(this.operation, this.space === 'world' ? 'local' : 'world');
      event.accept();
    } else if (key === 'z') {
      this.owner.setPivotMode(this.pivotMode === 'center' ? 'pivot' : 'center');
      event.accept();
    } else if (key === 'escape') {
      this.cancel('escape');
      event.accept();
    }
  }
}

/** Match each local scale axis to the closest orthogonal handle orientation. */
function alignScale (scale: Vector3, rotation: Quaternion, itemRotation: Quaternion): Vector3 {
  const frameAxes = axes.map(axis => vector(axis).applyQuaternion(rotation));
  const itemAxes = axes.map(axis => vector(axis).applyQuaternion(itemRotation));
  const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let best = permutations[0], score = -1;

  for (const permutation of permutations) {
    const match = Math.min(...permutation.map((axis, index) => Math.abs(dot3(itemAxes[index], frameAxes[axis]))));

    if (match > score) { best = permutation; score = match; }
  }

  return new Vector3(...best.map(index => scale.getElement(index)) as [number, number, number]);
}
function around (pivot: Point3, matrix: Matrix4): Matrix4 {
  return new Matrix4().setPosition(vector(pivot)).multiply(matrix).multiply(new Matrix4().setPosition(vector(mul3(pivot, -1))));
}
