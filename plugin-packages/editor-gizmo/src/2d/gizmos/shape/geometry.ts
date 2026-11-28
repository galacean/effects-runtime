import type { ShapeComponent } from '@galacean/effects';
import { Line2 } from '@galacean/effects-math/es/extension/index';
import type { GizmoActionEvent } from '../../gizmo-action';
import { lerp, Vector2, type Vector2Like } from '../../math';

/** 路径数据兼容宿主和 JSON 快照中的普通坐标对象。 */
export type PathPoint = Vector2Like;
export interface PathIndex { point: number, easingIn: number, easingOut: number }
export interface PenPathData {
  points: PathPoint[],
  easingIns: PathPoint[],
  easingOuts: PathPoint[],
  shapes: Array<{ close: boolean, indexes: PathIndex[] }>,
}
export type ShapePrimitive = 'rect' | 'ellipse' | 'polygon' | 'star';
export interface ShapeGeometry {
  shapeType: ShapePrimitive,
  center: PathPoint,
  width: number,
  height: number,
}

export type GeometryEditKind = 'custom' | 'vector';

export type PenToolState = 'create' | 'edit';

export type PenInteractionState = 'idle' | 'drawing' | 'editing';

export type HandleMirrorMode = 'none' | 'angle' | 'angle-length' | 'independent' | 'mirrored';

export interface PenNodeSelection {
  shape: number,
  point: number,
}
export interface PenEditOperation {
  kind: 'point' | 'handle-in' | 'handle-out' | 'topology',
  index?: number,
}
export interface GeometryPathTarget {
  /** Present only when path coordinates directly address this runtime custom shape. */
  component?: ShapeComponent,
  itemId: string,
  path: PenPathData,
  kind?: GeometryEditKind,
  revision?: number,
}

export interface GeometryGizmoHost {
  canEdit(itemId?: string): boolean,
  readPath(): GeometryPathTarget | undefined,
  viewToLocal(point: Vector2, itemId?: string): Vector2 | undefined,
  localToView(point: PathPoint, itemId?: string): Vector2,
  /** @deprecated 造型默认尺寸由 shapeConfig 统一管理。 */
  defaultShapeSize?(type?: ShapePrimitive): [number, number],
  snapPoints?(itemId?: string): Vector2[],
  contextKey?(): unknown,
  deleteBehavior?: 'split' | 'reconnect',
  appendSubpaths?: boolean,
}

export interface ShapeDrawingActionEvent extends GizmoActionEvent {
  sessionId: number,
  phase: 'start' | 'update' | 'commit' | 'cancel',
  create?: { kind: 'pen', path: PenPathData } | { kind: 'shape', geometry: ShapeGeometry },
  edit?: { itemId: string, before: PenPathData, path: PenPathData, operations: PenEditOperation[], kind?: GeometryEditKind, selection?: PenNodeSelection[] },
  canceled?: boolean,
  finish?: boolean,
  continueCreate?: boolean,
}

let sessionSequence = 0;

export function nextGeometrySession (): number { return ++sessionSequence; }

/** 在视口中按四分之一像素容差细分曲线，并限制递归深度。 */
export function hitPenCurve (
  point: Vector2,
  controls: [Vector2, Vector2, Vector2, Vector2],
  hitDistance: number,
): { distance: number, t: number } | undefined {
  let nearest = hitDistance;
  let hit: { distance: number, t: number } | undefined;
  const tolerance = Math.min(0.25, hitDistance / 4);
  const chord = new Line2();
  const closestPoint = new Vector2();
  const visit = (p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, start: number, end: number, depth: number): void => {
    if (point.x < Math.min(p0.x, p1.x, p2.x, p3.x) - nearest
      || point.x > Math.max(p0.x, p1.x, p2.x, p3.x) + nearest
      || point.y < Math.min(p0.y, p1.y, p2.y, p3.y) - nearest
      || point.y > Math.max(p0.y, p1.y, p2.y, p3.y) + nearest) {
      return;
    }
    chord.set(p0, p3);
    if (depth >= 16 || Math.max(
      p1.distance(chord.closestPointToPoint(p1, true, closestPoint)),
      p2.distance(chord.closestPointToPoint(p2, true, closestPoint)),
    ) <= tolerance) {
      const t = chord.closestPointToPointParameter(point, true);
      const distance = point.distance(chord.at(t, closestPoint));

      if (distance < nearest) {
        nearest = distance;
        hit = { distance: nearest, t: lerp(start, end, t) };
      }

      return;
    }
    const a = new Vector2().lerpVectors(p0, p1, 0.5);
    const b = new Vector2().lerpVectors(p1, p2, 0.5);
    const c = new Vector2().lerpVectors(p2, p3, 0.5);
    const d = new Vector2().lerpVectors(a, b, 0.5);
    const e = new Vector2().lerpVectors(b, c, 0.5);
    const middle = new Vector2().lerpVectors(d, e, 0.5);
    const t = lerp(start, end, 0.5);

    visit(p0, a, d, middle, start, t, depth + 1);
    visit(middle, e, c, p3, t, end, depth + 1);
  };

  visit(...controls, 0, 1, 0);

  return hit;
}

/** 新手柄必须避开其他节点引用但尚未写入的索引。 */
export function appendPenHandle (path: PenPathData, field: 'easingIn' | 'easingOut', point: PathPoint): number {
  const handles = field === 'easingIn' ? path.easingIns : path.easingOuts;
  let nextIndex = handles.length;

  for (const shape of path.shapes) {
    for (const index of shape.indexes) {
      if (Number.isInteger(index[field])) {
        nextIndex = Math.max(nextIndex, index[field] + 1);
      }
    }
  }
  while (handles.length < nextIndex) {
    handles.push({ x: 0, y: 0 });
  }

  return handles.push({ x: point.x, y: point.y }) - 1;
}

export function splitPenSegment (path: PenPathData, shapeIndex: number, segment: number, t: number): number | undefined {
  if (!Number.isFinite(t) || t <= 0 || t >= 1) { return; }
  const shape = path.shapes[shapeIndex];
  const a = shape?.indexes[segment];
  const b = shape?.indexes[segment + 1] ?? (shape?.close ? shape.indexes[0] : undefined);

  if (!a || !b) { return; }
  const from = path.points[a.point]; const to = path.points[b.point];

  if (!from || !to) { return; }
  const p0 = new Vector2().copyFrom(from); const p3 = new Vector2().copyFrom(to);
  const p1 = new Vector2().copyFrom(path.easingOuts[a.easingOut] ?? Vector2.ZERO).add(p0);
  const p2 = new Vector2().copyFrom(path.easingIns[b.easingIn] ?? Vector2.ZERO).add(p3);
  const q0 = new Vector2().lerpVectors(p0, p1, t);
  const q1 = new Vector2().lerpVectors(p1, p2, t);
  const q2 = new Vector2().lerpVectors(p2, p3, t);
  const r0 = new Vector2().lerpVectors(q0, q1, t);
  const r1 = new Vector2().lerpVectors(q1, q2, t);
  const point = new Vector2().lerpVectors(r0, r1, t);

  a.easingOut = appendPenHandle(path, 'easingOut', q0.subtract(p0));
  b.easingIn = appendPenHandle(path, 'easingIn', q2.subtract(p3));
  const index = path.points.push({ ...point }) - 1;

  shape.indexes.splice(segment + 1, 0, { point: index,
    easingIn: appendPenHandle(path, 'easingIn', r0.subtract(point)),
    easingOut: appendPenHandle(path, 'easingOut', r1.subtract(point)) });

  return segment + 1;
}

export function cloneGeometry<T> (value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export function penEditOperations (before: PenPathData, after: PenPathData): PenEditOperation[] {
  const operations: PenEditOperation[] = [];

  for (const [field, kind] of [['points', 'point'], ['easingIns', 'handle-in'], ['easingOuts', 'handle-out']] as const) {
    after[field].forEach((point, index) => {
      const previous = before[field][index];

      if (!previous || previous.x !== point.x || previous.y !== point.y) { operations.push({ kind, index }); }
    });
  }
  if (JSON.stringify(before.shapes) !== JSON.stringify(after.shapes)) { operations.push({ kind: 'topology' }); }

  return operations;
}

export function deletePenPoint (path: PenPathData, shapeIndex: number, index: number, behavior: 'split' | 'reconnect'): void {
  const shape = path.shapes[shapeIndex];
  const anchor = shape?.indexes[index]?.point;

  if (anchor === undefined) { return; }
  if (behavior === 'reconnect') {
    shape.indexes.splice(index, 1);
    if (shape.indexes.length < 2) { path.shapes.splice(shapeIndex, 1); }

    return;
  }
  path.shapes = path.shapes.flatMap(current => {
    if (!current.indexes.some(value => value.point === anchor)) { return [current]; }
    const nodes = [...current.indexes];

    if (current.close) {
      const first = nodes.findIndex(value => value.point === anchor);

      nodes.push(...nodes.splice(0, first + 1));
    }
    const segments: typeof path.shapes = [];
    let indexes: PathIndex[] = [];

    for (const node of nodes) {
      if (node.point === anchor) {
        if (indexes.length) { segments.push({ ...current, close: false, indexes }); }
        indexes = [];
      } else { indexes.push(node); }
    }
    if (indexes.length) { segments.push({ ...current, close: false, indexes }); }

    return segments;
  });
}

export function openClosedShapeAt (path: PenPathData, shapeIndex: number, vertexIndex: number): boolean {
  const shape = path.shapes[shapeIndex];

  if (!shape?.close || vertexIndex < 0 || vertexIndex >= shape.indexes.length) {
    return false;
  }
  shape.indexes = [
    ...shape.indexes.slice(vertexIndex + 1),
    ...shape.indexes.slice(0, vertexIndex + 1),
  ];
  shape.close = false;

  return true;
}

export function disconnectPenSegment (path: PenPathData, shapeIndex: number, segmentIndex: number): boolean {
  const shape = path.shapes[shapeIndex];

  if (!shape || shape.indexes.length < 2 || segmentIndex < 0 || segmentIndex >= shape.indexes.length) {
    return false;
  }
  if (shape.close) {
    shape.indexes = [
      ...shape.indexes.slice(segmentIndex + 1),
      ...shape.indexes.slice(0, segmentIndex + 1),
    ];
    shape.close = false;

    return true;
  }
  if (segmentIndex >= shape.indexes.length - 1) {
    return false;
  }
  const left = { close: false, indexes: shape.indexes.slice(0, segmentIndex + 1) };
  const right = { close: false, indexes: shape.indexes.slice(segmentIndex + 1) };

  path.shapes.splice(shapeIndex, 1, left, right);

  return true;
}
