import type { GizmoActionEvent } from '../../gizmo-action';
import type { Vector2 } from '../../math';

export interface PathPoint { x: number, y: number }
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

const lerp = (a: PathPoint, b: PathPoint, t: number): PathPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const add = (a: PathPoint, b?: PathPoint): PathPoint => ({ x: a.x + (b?.x ?? 0), y: a.y + (b?.y ?? 0) });
const sub = (a: PathPoint, b: PathPoint): PathPoint => ({ x: a.x - b.x, y: a.y - b.y });

export function splitPenSegment (path: PenPathData, shapeIndex: number, segment: number, t: number): number | undefined {
  if (!Number.isFinite(t) || t <= 0 || t >= 1) { return; }
  const shape = path.shapes[shapeIndex];
  const a = shape?.indexes[segment];
  const b = shape?.indexes[segment + 1] ?? (shape?.close ? shape.indexes[0] : undefined);

  if (!a || !b) { return; }
  const p0 = path.points[a.point]; const p3 = path.points[b.point];

  if (!p0 || !p3) { return; }
  const p1 = add(p0, path.easingOuts[a.easingOut]); const p2 = add(p3, path.easingIns[b.easingIn]);
  const q0 = lerp(p0, p1, t); const q1 = lerp(p1, p2, t); const q2 = lerp(p2, p3, t);
  const r0 = lerp(q0, q1, t); const r1 = lerp(q1, q2, t); const point = lerp(r0, r1, t);

  a.easingOut = path.easingOuts.push(sub(q0, p0)) - 1;
  b.easingIn = path.easingIns.push(sub(q2, p3)) - 1;
  const index = path.points.push(point) - 1;

  shape.indexes.splice(segment + 1, 0, { point: index,
    easingIn: path.easingIns.push(sub(r0, point)) - 1,
    easingOut: path.easingOuts.push(sub(r1, point)) - 1 });

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
