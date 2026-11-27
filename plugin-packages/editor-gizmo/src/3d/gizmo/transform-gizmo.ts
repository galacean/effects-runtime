import { PrimitiveType } from '../geometry/primitives';
import { GizmoBoundsType, type GizmoBounds } from './gizmo-bounds';
import { createGizmoDrawing, createGizmoMesh, updateGizmoMatrices, drawGizmo, disposeGizmoDrawing, type GizmoDrawing, type GizmoMesh } from './gizmo-drawing';
import { createTransparentGizmoMaterial, createGizmoLineMaterial } from './gizmo-materials';
import { math, MouseButton, BufferUsage, Geometry, Transform, glContext, type Engine, type spec, type Composition, type InputEventMouseButton, type InputEventMouseMotion, type Renderer, type VFXItem } from '@galacean/effects';
import type { Editor3D } from '../editor-3d';
import { rayPlanePoint } from '../../math/plane';
import type { Point2, Point3 } from '../../math/types';
import { sub3, mul3, cross3, unit3, dot3 } from '../../math/vector3';
import { Gizmo3D } from './gizmo-3d';
import { color, color as palette, gizmoOpacity, renderMode, transformGizmoStyle } from './gizmo-settings';
import { hitTestGizmo, type GizmoHit } from './gizmo-picking';

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'local' | 'world';
export type PivotType = 'object-center' | 'selection-center' | 'world-origin';

export interface TransformGizmoOptions {
  mode?: TransformMode,
  space?: TransformSpace,
  pivotType?: PivotType,
}

/** IDs identify the selected parents whose live transforms the gizmo edits. */
export interface TransformActionEvent {
  source: TransformGizmo,
  transformType: TransformMode,
  itemIds: readonly string[],
  /** On a canceled commit the gizmo has already rolled back its preview. */
  canceled?: boolean,
  reason?: string,
}

const { Vector2, Vector3, Quaternion, Matrix4 } = math;

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

type Handle = 0 | 1 | 2 | 'xy' | 'xz' | 'yz' | 'all' | 'view';
type Frame = { pivot: Point3, axes: Point3[], rotation: Quaternion };
type LocalTransform = { position: Vector3, quat: Quaternion, scale: Vector3 };
type DragItem = {
  item: VFXItem, world: Matrix4, inverseParent: Matrix4, anchor: Vector3,
  before: LocalTransform, preview?: LocalTransform, parent?: VFXItem, parentWorld: Matrix4,
  rotation: Quaternion,
};
interface TransformDrag {
  action: TransformActionEvent,
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

/** Perspective ray-based axes, planes, rotation rings and scale handles. */
export class TransformGizmo extends Gizmo3D {
  mode: TransformMode;
  space: TransformSpace;
  pivotType: PivotType;
  private drag?: TransformDrag;
  private hoveredHandle?: Handle;
  private readonly drawings = new Map<TransformMode, GizmoDrawing>();
  private drawing?: GizmoDrawing;
  constructor (owner: Editor3D, options: TransformGizmoOptions = {}) {
    super(owner);
    this.mode = options.mode ?? 'translate';
    this.space = options.space ?? 'world';
    this.pivotType = options.pivotType ?? 'selection-center';
  }

  get selection (): readonly VFXItem[] { return this.owner.selectedItems; }
  get selectedParents (): readonly VFXItem[] {
    const selected = new Set(this.selection);

    return this.selection.filter(item => {
      for (let parent = item.parent; parent; parent = parent.parent) {
        if (selected.has(parent)) { return false; }
      }

      return true;
    });
  }
  get activeItem (): VFXItem | undefined { return this.selection[this.selection.length - 1]; }
  canTransform (item: VFXItem): boolean { return this.owner.canTransform(item); }

  override onSelectionChanged (): void { this.cancel('selection'); }

  override pick (event: InputEventMouseButton): void {
    const composition = this.owner.composition;
    const ndc = this.owner.toNDC(event.position);

    if (!composition || !ndc) { return; }
    const { x, y } = ndc;
    const origin = composition.getHitTestRay(x, y).origin;
    const candidates = new Set(this.owner.getSelectionCandidates());
    const hits = composition.hitTest(x, y, true, { skip: item => !item.isVisible });
    let nearest: VFXItem | undefined;
    let distance = Infinity;

    for (const hit of hits) {
      let item: VFXItem | undefined = hit.item;

      while (item && !candidates.has(item)) { item = item.parent; }
      const depth = origin.distanceSquared(hit.position);

      if (item && depth <= distance) {
        nearest = item;
        distance = depth;
      }
    }
    const subtractive = event.ctrlPressed || event.metaPressed;
    const result = new Set<VFXItem>(event.shiftPressed || subtractive ? this.selection : []);

    if (nearest) {
      if (result.has(nearest) && (subtractive || event.shiftPressed && nearest === this.activeItem)) {
        result.delete(nearest);
      } else { result.add(nearest); }
    }
    this.owner.select(Array.from(result), nearest);
    event.accept();
  }

  private getPose (items: readonly VFXItem[]) {
    const space = this.mode === 'scale' && items.length === 1 ? 'local' : this.space;

    return getTransformGizmoPose(items, space, this.pivotType);
  }

  updateDrawing (): void {
    this.drawing = undefined;
    const composition = this.owner.composition;
    const items = this.selectedParents;

    if (!composition || !this.isActive || !items.length || items.some(item => !this.canTransform(item))) { return; }
    let drawing = this.drawings.get(this.mode);

    if (!drawing) {
      drawing = createTransformGizmoDrawing(this.owner.engine, this.mode);
      this.drawings.set(this.mode, drawing);
    }
    const pose = this.drag?.frame ?? this.getPose(items);
    const pivot = this.drag ? vector(pose.pivot).add(vector(this.drag.translation)) : pose.pivot;
    const rotation = this.drag && this.mode === 'rotate' ? this.drag.rotationDelta.clone().multiply(pose.rotation) : pose.rotation;
    const cameraPosition = composition.camera.worldPosition;
    const center = getHandleRenderPosition(cameraPosition, vector(pivot));
    const size = this.owner.getHandleSize(center) / (transformGizmoStyle.axisLength * 2);

    if (this.mode === 'scale') { updateScaleHandles(drawing, this.drag?.scale ?? Vector3.ONE); }
    const active = this.handleKey(this.drag?.handle ?? this.hoveredHandle);

    highlightTransformGizmo(drawing, active, this.mode === 'scale' && this.drag?.handle === 'all');
    if (this.mode === 'rotate') {
      const inverse = rotation.clone().conjugate();
      const viewRotation = inverse.clone().multiply(composition.camera.getInverseViewMatrix().getTransform().rotation);
      const drag = this.drag;
      const feedback = drag && drag.handle !== 'all' ? {
        axis: drag.rotationAxis.clone().applyQuaternion(inverse), from: drag.rotationFrom.clone().applyQuaternion(inverse), angle: drag.rotationAngle,
      } : undefined;

      updateRotationHandles(drawing, viewRotation, active, feedback);
    }
    updateGizmoMatrices(drawing, new Matrix4().compose(center, rotation, new Vector3(size, size, size)));
    if (this.mode === 'rotate') {
      for (const { data: { material } } of drawing.meshes) {
        material.setVector3('u_cameraPos', cameraPosition);
        material.setVector3('u_center', center);
      }
    }
    this.drawing = drawing;
  }

  override draw (renderer: Renderer): void {
    this.updateDrawing();
    if (this.drawing) { drawGizmo(this.drawing, renderer); }
  }

  override dispose (): void {
    this.cancel('disposed');
    this.drawings.forEach(disposeGizmoDrawing);
    this.drawings.clear();
    this.drawing = undefined;
    super.dispose();
  }

  hasGeometry (): boolean {
    return !!this.drawing?.meshes.length;
  }

  hover (point?: Point2): void {
    if (this.drag) { return; }
    this.hoveredHandle = point ? this.pickHandle(point) : undefined;
    if (this.drawing) { highlightTransformGizmo(this.drawing, this.handleKey(this.hoveredHandle)); }
  }

  private handleKey (handle?: Handle): string | undefined {
    if (this.mode === 'rotate' && (handle === 'view' || handle === 'all')) { return handle === 'view' ? 'screenRing' : 'freeRing'; }

    return handle === undefined ? undefined : typeof handle === 'number' ? ['xAxis', 'yAxis', 'zAxis'][handle]
      : handle === 'xy' ? 'xyPlane' : handle === 'yz' ? 'yzPlane' : handle === 'xz' ? 'zxPlane' : 'center';
  }

  private valid (drag: TransformDrag): boolean {
    const selected = this.selectedParents;

    return this.owner.composition === drag.composition && selected.length === drag.items.length
      && drag.items.every(({ item, parent, parentWorld, preview, before }, index) =>
        item === selected[index] && this.canTransform(item) && item.parent === parent
        && parentWorld.equals(item.transform.getParentMatrix() ?? identity) && matchesLocal(item, preview ?? before));
  }

  override update (): void {
    if (this.drag && !this.valid(this.drag)) { this.cancel('context'); }
    this.updateDrawing();
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
  setMode (mode: TransformMode): void { this.cancel('mode'); this.mode = mode; }
  setSpace (space: TransformSpace): void { this.cancel('space'); this.space = space; }
  private planeAxes (handle: string): [number, number] { return handle === 'xy' ? [0, 1] : handle === 'xz' ? [0, 2] : [1, 2]; }
  private handleFromKey (key: string): Handle | undefined {
    if (key === 'screenRing') { return 'view'; }
    if (key === 'xAxis') { return 0; }
    if (key === 'yAxis') { return 1; }
    if (key === 'zAxis') { return 2; }
    if (key === 'xyPlane') { return 'xy'; }
    if (key === 'yzPlane') { return 'yz'; }
    if (key === 'zxPlane') { return 'xz'; }
    if (key === 'center') { return this.mode === 'translate' ? 'view' : 'all'; }

    return;
  }
  hitTest (point: Point2): (GizmoHit & { target?: string }) | undefined {
    const composition = this.owner.composition;
    const ndc = this.owner.toNDC(point);

    if (!this.visible || !this.isActive || !this.owner.enabled || !composition?.interactive || !ndc) { return; }
    this.updateDrawing();
    const hit = this.drawing && hitTestGizmo(this.drawing, composition.getHitTestRay(ndc.x, ndc.y), ndc, composition.camera, this.owner.viewportSize);
    const items = this.selectedParents;

    return hit && { ...hit, target: items.length === 1 ? items[0].getInstanceId() : undefined };
  }

  pickHandle (point: Point2): Handle | undefined {
    if (!this.isActive) { return; }
    const hit = this.hitTest(point);

    if (hit) { return this.handleFromKey(hit.key); }
    if (this.mode === 'rotate' && this.selectedParents.length) {
      const center = this.owner.project(this.getPose(this.selectedParents).pivot);

      if (center && center.distance(new math.Vector2(point.x, point.y)) < transformGizmoStyle.size) { return 'all'; }
    }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    const selected = this.selectedParents;

    if (!selected.length || selected.some(item => !this.canTransform(item))) { return; }
    const hit = this.hitTest(event.position);
    const handle = hit ? this.handleFromKey(hit.key) : this.pickHandle(event.position);

    if (handle === undefined) { return; }
    const ray = this.owner.ray(event.position);

    if (!ray) { return; }
    this.cancel('restart');
    const { pivot, rotation } = this.getPose(selected);
    const frame = { pivot, rotation, axes: axes.map(axis => vector(axis).applyQuaternion(rotation)) };
    const viewNormal = this.owner.composition!.camera.getInverseViewMatrix().transformNormal(new Vector3(0, 0, 1));
    let planeNormal: Point3 = viewNormal;

    if (typeof handle === 'number' && this.mode === 'translate') {
      const axis = frame.axes[handle];

      planeNormal = unit3(cross3(axis, cross3(axis, viewNormal)));
    } else if (typeof handle === 'string' && handle !== 'view' && handle !== 'all') {
      const [a, b] = this.planeAxes(handle);

      planeNormal = cross3(frame.axes[a], frame.axes[b]);
    }
    let startPoint = rayPlanePoint(ray, frame.pivot, planeNormal) ?? (this.mode !== 'translate' ? pivot : undefined);

    if (!startPoint) { return; }
    const handleSize = this.owner.getHandleSize(pivot);

    if (handleSize <= 0) { return; }
    if (this.mode === 'rotate' && hit?.position && this.drawing) {
      const radial = vector(hit.position).subtract(this.drawing.matrix.getTranslation(new Vector3())).normalize();

      startPoint = vector(pivot).add(radial.multiply(handleSize * (handle === 'view' ? transformGizmoStyle.screenRingRadius : 1)));
    }
    const cameraMatrix = this.owner.composition!.camera.getInverseViewMatrix();
    const screenDirection = cameraMatrix.transformNormal(new Vector3(1, 1, 0)).normalize();
    const rotationAxis = typeof handle === 'number' ? vector(frame.axes[handle]) : viewNormal.clone();
    const rotationFrom = vector(startPoint).subtract(pivot).normalize();
    const drag: TransformDrag = {
      action: { source: this, transformType: this.mode, itemIds: selected.map(item => item.getInstanceId()) },
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
    const point = this.mode === 'translate' ? rayPlanePoint(ray, frame.pivot, drag.planeNormal) : undefined;

    if (this.mode === 'translate' && !point) { return; }
    const motion = point ? sub3(point, startPoint) : new Vector3();
    const snapping = event.ctrlPressed || event.metaPressed;
    let operation = new Matrix4();

    if (this.mode === 'translate') {
      let delta = motion;

      if (typeof handle === 'number') {
        let distance = this.owner.getLineTranslation(start, event.position, frame.pivot, frame.axes[handle]);

        if (snapping) { distance = Math.round(distance * 10) / 10; }
        delta = mul3(frame.axes[handle], distance);
      }
      operation.setPosition(vector(delta));
      drag.translation = delta;
    } else if (this.mode === 'rotate') {
      if (handle === 'all') {
        const motion = event.position.clone().subtract(drag.lastMouse);
        const axis = this.owner.composition!.camera.getInverseViewMatrix().transformNormal(new Vector3(-motion.y, -motion.x, 0)).normalize();

        drag.rotationDelta = new Quaternion().setFromAxisAngle(axis, motion.length() * Math.PI / 180).multiply(drag.rotationDelta);
      } else {
        const tangent = new Vector3().crossVectors(drag.rotationAxis, drag.rotationFrom).normalize();
        const radius = drag.handleSize * (handle === 'view' ? transformGizmoStyle.screenRingRadius : 1);
        let angle = this.owner.getLineTranslation(start, event.position, startPoint, tangent) / radius * Math.PI / 6;

        if (snapping && handle !== 'view') { angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12; }
        drag.rotationAngle = angle;
        drag.rotationDelta.setFromAxisAngle(drag.rotationAxis, angle);
      }
      operation = createPivotTransform(frame.pivot, new Matrix4().setFromQuaternion(drag.rotationDelta));
    } else if (this.mode === 'scale') {
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
      if (this.mode === 'scale') {
        after.push(this.scaleItem(initial, drag));

        continue;
      }
      let itemOperation = operation;

      if (this.mode === 'rotate' && this.pivotType === 'object-center') {
        let rotation = drag.rotationDelta;

        if (this.space === 'local') {
          const local = frame.rotation.clone().conjugate().multiply(rotation).multiply(frame.rotation);

          rotation = initial.rotation.clone().multiply(local).multiply(initial.rotation.clone().conjugate());
        }
        itemOperation = createPivotTransform(initial.world.getTranslation(new Vector3()), new Matrix4().setFromQuaternion(rotation));
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
      after.push({ position: p, quat: this.mode === 'translate' ? initial.before.quat : q,
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
    const individual = drag.items.length === 1 || this.pivotType === 'object-center' && this.space === 'local';
    const scale = individual ? drag.scale : alignScale(drag.scale, drag.frame.rotation, initial.rotation);
    const s = initial.before.scale.clone().multiply(scale);
    const q = initial.before.quat;
    const origin = initial.world.getTranslation(new Vector3()).applyMatrix(initial.inverseParent);
    let position = origin.clone();

    if (this.pivotType !== 'object-center') {
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

}

type vec3 = spec.vec3;
type TriangleLike = math.TriangleLike;

function createTransformGizmoDrawing (engine: Engine, mode: TransformMode): GizmoDrawing {
  const bounds = new Map<string, GizmoBounds>();
  const meshes = mode === 'translate' ? createTranslationMeshes(engine, bounds)
    : mode === 'rotate' ? createRotationMeshes(engine, bounds) : createScaleMeshes(engine, bounds);

  return createGizmoDrawing(meshes, bounds);
}

/**
 * 创建旋转手柄的几何体和材质
 * @internal
 * @param boundingMap - 包围盒 Map
 * @returns 绘制数据和对应的局部变换
 */
function createRotationMeshes (
  engine: Engine,
  boundingMap: Map<string, GizmoBounds>,
  scale = 2,
): Map<GizmoMesh, Transform> {
  const result = new Map<GizmoMesh, Transform>();
  const radius = transformGizmoStyle.axisLength * scale;
  const circle = Array.from({ length: 96 }, (value, index) => [index, index + 1].map(step => {
    const angle = step * Math.PI * 2 / 96;

    return new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  })).flat();
  const freeRing = createLineMesh(engine, 'freeRing', circle, [0.45, 0.45, 0.45]);

  result.set(freeRing, new Transform());
  for (const [index, name] of ['xAxis', 'yAxis', 'zAxis'].entries()) {
    const mesh = createLineMesh(engine, name, circle,
      [color.xAxisColor, color.yAxisColor, color.zAxisColor][index] as vec3, { frontOnly: true });
    const local = new Transform();
    const normal = new Vector3();

    normal.setElement(index, 1);
    if (index === 0) { local.setRotation(0, 90, 0); }
    if (index === 1) { local.setRotation(-90, 0, 0); }
    result.set(mesh, local);
    boundingMap.set(name, { type: GizmoBoundsType.circle, normal, radius, frontOnly: true });
  }
  const screenRadius = radius * transformGizmoStyle.screenRingRadius;
  const screenRing = createLineMesh(engine, 'screenRing',
    circle.map(point => point.clone().multiply(transformGizmoStyle.screenRingRadius)), [0.8, 0.8, 0.8]);

  result.set(screenRing, new Transform());
  boundingMap.set('screenRing', { type: GizmoBoundsType.circle, normal: new Vector3(0, 0, 1), radius: screenRadius });
  const geometry = Geometry.create(engine, {
    attributes: { a_Position: { size: 3, data: new Float32Array(66 * 3) } },
    indices: { data: new Uint16Array(Array.from({ length: 64 }, (value, index) => [0, index + 1, index + 2]).flat()) },
    mode: glContext.TRIANGLES, drawCount: 0, bufferUsage: BufferUsage.Dynamic,
  });
  const material = createTransparentGizmoMaterial(engine, color.highlightColor as vec3, false, 0.2);
  const lineColor = Vector3.fromArray(color.highlightColor).multiply(0.8).add(new Vector3(0.2, 0.2, 0.2));
  const lines = createLineMesh(engine, 'rotationLines', Array.from({ length: 4 }, () => new Vector3()), lineColor.toArray() as vec3);

  material.depthMask = false;
  lines.material.setFloat('u_alpha', 0.7);
  lines.material.blending = true;
  lines.material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];
  lines.geometry.setDrawCount(0);
  result.set({ name: 'rotationSector', geometry, material }, new Transform());
  result.set(lines, new Transform());

  return result;
}

/**
 * 获取几何体的三角面数组
 * @internal
 * @param geometry - 几何体
 * @param transform - 变换式
 * @returns 三角面数组
 */
function getTriangle (geometry: Geometry, transform: Transform): TriangleLike[] {
  const result: TriangleLike[] = [];
  const indices = geometry.getIndexData();
  const points = geometry.getAttributeData('a_Position');
  const mat4 = transform.getWorldMatrix();

  if (points && indices && indices.length > 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      const p0 = new Vector3(points[i0], points[i0 + 1], points[i0 + 2]);
      const p1 = new Vector3(points[i1], points[i1 + 1], points[i1 + 2]);
      const p2 = new Vector3(points[i2], points[i2 + 1], points[i2 + 2]);

      result.push({
        p0: mat4.projectPoint(p0),
        p1: mat4.projectPoint(p1),
        p2: mat4.projectPoint(p2),
      });

    }
  }

  return result;
}

/**
 * 创建位移手柄的几何体和材质
 * @internal
 * @param boundingMap - 包围盒 Map
 * @returns 绘制数据和对应的局部变换
 */
function createTranslationMeshes (engine: Engine, boundingMap: Map<string, GizmoBounds>, scale = 2): Map<GizmoMesh, Transform> {
  const result: Map<GizmoMesh, Transform> = new Map();
  const axisLength = transformGizmoStyle.axisLength * scale;
  const axisMesh = createAxisMeshes(engine, axisLength * 0.9);

  for (const [mesh, transform] of axisMesh) {
    result.set(mesh, transform);
  }

  const arrowSize = {
    radius: 0.08 * axisLength,
    height: 0.24 * axisLength,
  };
  const xArrow = createGizmoMesh(engine, PrimitiveType.Cone, {
    size: arrowSize,
    color: color.xAxisColor as vec3,
    renderMode,
    depthTest: true,
    name: 'xAxis',
  }, 'blend');
  const yArrow = createGizmoMesh(engine, PrimitiveType.Cone, {
    size: arrowSize,
    color: color.yAxisColor as vec3,
    renderMode,
    depthTest: true,
    name: 'yAxis',
  }, 'blend');
  const zArrow = createGizmoMesh(engine, PrimitiveType.Cone, {
    size: arrowSize,
    color: color.zAxisColor as vec3,
    renderMode,
    name: 'zAxis',
    depthTest: true,
  }, 'blend');
  const xArrowTransform = new Transform({
    valid: true,
  });
  const yArrowTransform = new Transform({
    valid: true,
  });
  const zArrowTransform = new Transform({
    valid: true,
  });

  xArrowTransform.setRotation(0, 0, 90);
  yArrowTransform.setRotation(0, 0, 0);
  zArrowTransform.setRotation(-90, 0, 0);
  xArrowTransform.translate(axisLength * 1.02, 0, 0);
  yArrowTransform.translate(0, axisLength * 1.02, 0);
  zArrowTransform.translate(0, 0, axisLength * 1.02);

  const planeSize = {
    width: 0.25 * axisLength,
    height: 0.25 * axisLength,
  };
  const planeOffset = 0.125 * axisLength;
  const xyPlane = createGizmoMesh(engine, PrimitiveType.Plane, {
    size: planeSize, color: color.zAxisColor as vec3, renderMode, alpha: gizmoOpacity, name: 'xyPlane',
  }, 'blend');
  const yzPlane = createGizmoMesh(engine, PrimitiveType.Plane, {
    size: planeSize, color: color.xAxisColor as vec3, renderMode, alpha: gizmoOpacity, name: 'yzPlane',
  }, 'blend');
  const zxPlane = createGizmoMesh(engine, PrimitiveType.Plane, {
    size: planeSize, color: color.yAxisColor as vec3, renderMode, alpha: gizmoOpacity, name: 'zxPlane',
  }, 'blend');

  for (const { material } of [xyPlane, yzPlane, zxPlane]) {
    material.culling = false;
    material.depthMask = false;
    material.blendFunction = [glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];
  }
  const xyPlaneTransform = new Transform({
    valid: true,
  });
  const yzPlaneTransform = new Transform({
    valid: true,
  });
  const zxPlaneTransform = new Transform({
    valid: true,
  });

  xyPlaneTransform.translate(planeSize.width / 2 + planeOffset, planeSize.height / 2 + planeOffset, 0);
  yzPlaneTransform.setRotation(0, 90, 0);
  yzPlaneTransform.translate(0, planeSize.height / 2 + planeOffset, planeSize.width / 2 + planeOffset);
  zxPlaneTransform.setRotation(-90, 0, 0);
  zxPlaneTransform.translate(planeSize.width / 2 + planeOffset, 0, planeSize.height / 2 + planeOffset);

  result.set(xArrow, xArrowTransform);
  result.set(yArrow, yArrowTransform);
  result.set(zArrow, zArrowTransform);
  result.set(xyPlane, xyPlaneTransform);
  result.set(yzPlane, yzPlaneTransform);
  result.set(zxPlane, zxPlaneTransform);

  createAxisPickBounds({ width: arrowSize.radius * 2.4, length: axisLength * 1.14 }, boundingMap);
  boundingMap.set('xyPlane', {
    type: GizmoBoundsType.triangle,
    triangles: xyPlane.geometry ? getTriangle(xyPlane.geometry, xyPlaneTransform) : [],
    backfaceCulling: false,
  });

  // FIXME: getTriangle 函数调用 getWorldMatrix 后 worldMatrix被修改
  boundingMap.set('yzPlane', {
    type: GizmoBoundsType.triangle,
    triangles: yzPlane.geometry ? getTriangle(yzPlane.geometry, yzPlaneTransform) : [],
    backfaceCulling: false,
  });
  boundingMap.set('zxPlane', {
    type: GizmoBoundsType.triangle,
    triangles: zxPlane.geometry ? getTriangle(zxPlane.geometry, zxPlaneTransform) : [],
    backfaceCulling: false,
  });

  return result;
}

/**
 * 创建缩放手柄的几何体和材质
 * @internal
 * @param boundingMap - 包围盒 Map
 * @returns 绘制数据和对应的局部变换
 */
function createScaleMeshes (engine: Engine, boundingMap: Map<string, GizmoBounds>, scale = 2): Map<GizmoMesh, Transform> {
  const result: Map<GizmoMesh, Transform> = new Map();
  const axisLength = transformGizmoStyle.axisLength * scale;
  const axisMesh = createAxisMeshes(engine, axisLength * 0.95);

  for (const [mesh, transform] of axisMesh) {
    result.set(mesh, transform);
  }
  const boxSize = {
    width: 0.1 * axisLength,
    height: 0.1 * axisLength,
    depth: 0.1 * axisLength,
  };
  const centerBoxSize = {
    width: 0.15 * axisLength,
    height: 0.15 * axisLength,
    depth: 0.15 * axisLength,
  };
  const xCube = createGizmoMesh(engine, PrimitiveType.Box, {
    size: boxSize, color: color.xAxisColor as vec3, renderMode, depthTest: true, name: 'xAxis',
  }, 'blend');
  const yCube = createGizmoMesh(engine, PrimitiveType.Box, {
    size: boxSize, color: color.yAxisColor as vec3, renderMode, depthTest: true, name: 'yAxis',
  }, 'blend');
  const zCube = createGizmoMesh(engine, PrimitiveType.Box, {
    size: boxSize, color: color.zAxisColor as vec3, renderMode, depthTest: true, name: 'zAxis',
  }, 'blend');
  const centerCube = createGizmoMesh(engine, PrimitiveType.Box, {
    size: centerBoxSize,
    color: [0.8, 0.8, 0.8],
    renderMode,
    depthTest: true,
    name: 'center',
  }, 'blend');
  const xCubeTransform = new Transform({
    valid: true,
  });
  const yCubeTransform = new Transform({
    valid: true,
  });
  const zCubeTransform = new Transform({
    valid: true,
  });
  const centerCubeTransform = new Transform({
    valid: true,
  });

  xCubeTransform.translate(axisLength, 0, 0);
  yCubeTransform.translate(0, axisLength, 0);
  zCubeTransform.translate(0, 0, axisLength);
  result.set(centerCube, centerCubeTransform);
  result.set(xCube, xCubeTransform);
  result.set(yCube, yCubeTransform);
  result.set(zCube, zCubeTransform);

  createAxisPickBounds({ width: boxSize.width * 1.2, length: axisLength + boxSize.width / 2 }, boundingMap);
  boundingMap.set('center', {
    type: GizmoBoundsType.box,
    center: new Vector3(),
    size: new Vector3(centerBoxSize.width, centerBoxSize.height, centerBoxSize.depth),
  });

  return result;
}

/**
 * 创建坐标轴的几何体和材质
 * @internal
 * @param length - 轴杆长度
 * @returns 绘制数据和对应的局部变换
 */
function createAxisMeshes (engine: Engine, length: number): Map<GizmoMesh, Transform> {
  const result: Map<GizmoMesh, Transform> = new Map();
  const points = [new Vector3(), new Vector3(length, 0, 0)];
  const xAxis = createLineMesh(engine, 'xAxisLine', points, color.xAxisColor as vec3, { depthTest: true });
  const yAxis = createLineMesh(engine, 'yAxisLine', points, color.yAxisColor as vec3, { depthTest: true });
  const zAxis = createLineMesh(engine, 'zAxisLine', points, color.zAxisColor as vec3, { depthTest: true });

  const xAxisTransform = new Transform({
    valid: true,
  });
  const yAxisTransform = new Transform({
    valid: true,
  });
  const zAxisTransform = new Transform({
    valid: true,
  });

  yAxisTransform.setRotation(0, 0, -90);
  zAxisTransform.setRotation(0, 90, 0);
  result.set(xAxis, xAxisTransform);
  result.set(yAxis, yAxisTransform);
  result.set(zAxis, zAxisTransform);

  return result;
}

/**
 * 创建坐标轴包围盒
 * @internal
 * @param size 包围盒尺寸
 * @param boundingMap 包围盒 Map
 */
function createAxisPickBounds (size: { width: number, length: number }, boundingMap: Map<string, GizmoBounds>) {
  boundingMap.set('xAxis', {
    type: GizmoBoundsType.line,
    points: [new Vector3(0, 0, 0), new Vector3(size.length, 0, 0)],
    width: size.width,
  });
  boundingMap.set('yAxis', {
    type: GizmoBoundsType.line,
    points: [new Vector3(0, 0, 0), new Vector3(0, size.length, 0)],
    width: size.width,
  });
  boundingMap.set('zAxis', {
    type: GizmoBoundsType.line,
    points: [new Vector3(0, 0, 0), new Vector3(0, 0, size.length)],
    width: size.width,
  });
}

function highlightTransformGizmo (drawing: GizmoDrawing, key?: string, highlightAllAxes = false): void {
  for (const { data, color } of drawing.meshes) {
    const axis = data.name.includes('Axis');
    const selected = key !== undefined && (data.name === key || data.name === key + 'Line' || highlightAllAxes && axis);

    if (color) {
      const tint = selected ? Vector3.fromArray(palette.highlightColor) : color;

      if (data.name.endsWith('Plane')) {
        data.material.setVector2('u_alpha', new Vector2(selected ? 1 : gizmoOpacity, 0));
      }

      data.material.setVector3('u_color', tint);
    } else {
      data.material.setFloat('u_highlight', selected ? 1 : 0);
    }
  }
}

function updateRotationHandles (drawing: GizmoDrawing,
  viewRotation: math.Quaternion, active?: string,
  feedback?: { axis: math.Vector3, from: math.Vector3, angle: number },
): void {
  const viewNormal = new Vector3(0, 0, 1).applyQuaternion(viewRotation);

  for (const { data, local } of drawing.meshes) {
    if (data.name === 'freeRing' || data.name === 'screenRing') { local.setTransform({ quat: viewRotation }); }
    const axis = ['xAxis', 'yAxis', 'zAxis'].indexOf(data.name);
    const full = data.name === active || axis >= 0 && Math.abs(viewNormal.getElement(axis)) > 0.999;

    data.material.setFloat('u_showFull', full ? 1 : 0);
    if (data.name !== 'rotationSector' && data.name !== 'rotationLines') { continue; }
    if (!feedback) { data.geometry.setDrawCount(0); continue; }
    const bound = drawing.bounds.get(active ?? 'xAxis');
    const radius = bound?.type === GizmoBoundsType.circle ? bound.radius : 0;
    const from = feedback.from.clone().multiply(radius);
    const to = from.clone().applyQuaternion(new math.Quaternion().setFromAxisAngle(feedback.axis, feedback.angle));

    if (data.name === 'rotationLines') {
      updateLineGeometry(data.geometry, [new Vector3(), from, new Vector3(), to]);
    } else {
      const vertices = data.geometry.getAttributeData('a_Position') as Float32Array;
      const angle = Math.sign(feedback.angle) * Math.min(Math.abs(feedback.angle), Math.PI * 2);

      vertices.fill(0);
      for (let i = 0; i <= 64; i++) {
        const point = from.clone().applyQuaternion(new math.Quaternion().setFromAxisAngle(feedback.axis, angle * i / 64));

        vertices.set(point.toArray(), (i + 1) * 3);
      }
      data.geometry.setDrawCount(64 * 3);
      data.geometry.setAttributeData('a_Position', vertices);
    }
  }
  const screenRing = drawing.bounds.get('screenRing');

  if (screenRing?.type === GizmoBoundsType.circle) { screenRing.normal.set(0, 0, 1).applyQuaternion(viewRotation); }
}

/** Stretch the axis shafts and move their end caps without enlarging the caps. */
function updateScaleHandles (drawing: GizmoDrawing, value: math.Vector3): void {
  for (const { data, local, position, scale } of drawing.meshes) {
    const axis = data.name.startsWith('xAxis') ? 0 : data.name.startsWith('yAxis') ? 1 : data.name.startsWith('zAxis') ? 2 : undefined;
    const nextScale = scale.clone();
    const nextPosition = position.clone();

    if (axis !== undefined) {
      const factor = value.getElement(axis);

      nextPosition.multiply(factor);
      if (data.name.endsWith('Line')) {
        nextScale.x *= Math.sign(factor) * Math.max(0, Math.abs(factor) - 0.05) / 0.95;
      }
    }
    local.setTransform({ position: nextPosition, scale: nextScale });
  }
}

/** Draw independent line segments with a constant width in CSS pixels. */
function createLineMesh (
  engine: Engine, name: string, points: readonly math.Vector3[], color: spec.vec3,
  options: { depthTest?: boolean, frontOnly?: boolean } = {},
): GizmoMesh {
  const count = points.length / 2;
  const sides = new Float32Array(count * 4);
  const indices = new Uint16Array(count * 6);

  for (let i = 0; i < count; i++) {
    sides.set([-1, 1, 1, -1], i * 4);
    const vertex = i * 4;

    indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], i * 6);
  }
  const geometry = Geometry.create(engine, {
    attributes: {
      a_Position: { size: 3, data: new Float32Array(count * 12) },
      a_Other: { size: 3, data: new Float32Array(count * 12) },
      a_Side: { size: 1, data: sides },
    },
    indices: { data: indices }, mode: glContext.TRIANGLES, drawCount: indices.length, bufferUsage: BufferUsage.Dynamic,
  });

  updateLineGeometry(geometry, points);

  return { name, geometry, material: createGizmoLineMaterial(engine, color, options) };
}

/** Update endpoints without replacing the segment buffers. */
function updateLineGeometry (geometry: Geometry, points: readonly math.Vector3[]): void {
  const positions = geometry.getAttributeData('a_Position') as Float32Array;
  const others = geometry.getAttributeData('a_Other') as Float32Array;

  for (let i = 0; i < points.length; i += 2) {
    const start = points[i].toArray(), end = points[i + 1].toArray();
    const offset = i * 6;

    positions.set([...start, ...start, ...end, ...end], offset);
    others.set([...end, ...end, ...start, ...start], offset);
  }
  geometry.setAttributeData('a_Position', positions);
  geometry.setAttributeData('a_Other', others);
  geometry.setDrawCount(points.length * 3);
}

/** Keep handles at a stable rendering depth while preserving their projected center. */
function getHandleRenderPosition (cameraPosition: Vector3, pivot: Vector3): Vector3 {
  return pivot.clone().subtract(cameraPosition).normalize().multiply(20).add(cameraPosition);
}

function getWorldRotation (item: VFXItem): Quaternion {
  const rotation = new Quaternion();

  for (let transform: typeof item.transform | null | undefined = item.transform; transform; transform = transform.parentTransform) {
    rotation.copyFrom(transform.getQuaternion().clone().multiply(rotation));
  }

  return rotation;
}

/** The visible handle and the drag operation share the same world-space pivot and orientation. */
function getTransformGizmoPose (
  items: readonly VFXItem[], space: TransformSpace, mode: PivotType = 'selection-center', active = items[0],
) {
  const pivot = new Vector3();
  const rotation = new Quaternion();

  if (mode === 'object-center') {
    pivot.copyFrom(active.transform.getWorldPosition());
  } else if (mode === 'selection-center') {
    for (const item of items) { pivot.add(item.transform.getWorldPosition()); }
    pivot.multiply(1 / items.length);
  }
  if (space === 'local') { rotation.copyFrom(getWorldRotation(active)); }

  return { pivot, rotation };
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

function createPivotTransform (pivot: Point3, matrix: Matrix4): Matrix4 {
  return new Matrix4().setPosition(vector(pivot)).multiply(matrix).multiply(new Matrix4().setPosition(vector(mul3(pivot, -1))));
}
