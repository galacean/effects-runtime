import type { Vector2 } from '../math';

/** Local runtime transform used by the 3D transform mode. */
export interface Transform3DSnapshot {
  readonly id: string,
  readonly position: readonly [number, number, number],
  /** Effects Euler angles, in degrees. */
  readonly rotation: readonly [number, number, number],
  readonly quaternion: readonly [number, number, number, number],
  readonly scale: readonly [number, number, number],
}

/** Explicit spatial values. Pointer coordinates are always canvas-local CSS pixels. */
export type Point2 = { x: number, y: number };
export type Point3 = { x: number, y: number, z: number };
export type Ray3 = { origin: Point3, direction: Point3 };
/** Native runtime helper family supplied by an editor host. */
export type NativeGizmoType = 'translation' | 'rotation' | 'scale' | 'view-helper' | 'floor-grid';
export interface NativeGizmoHit { key: string, target?: string }
export interface CameraEditData {
  position: Point3,
  target: Point3,
  up: Point3,
  /** Vertical field of view, degrees. Navigation affects the editor camera only. */
  fov: number,
}
export interface SpatialEditDataMap {
  'transform-3d': Transform3DSnapshot[],
  'viewport-3d': CameraEditData,
}
export type SpatialEditModeId = keyof SpatialEditDataMap;
export interface SpatialEditTarget<K extends SpatialEditModeId> {
  id: string,
  /** Stable document revision; previews must not change this value. */
  revision: string,
  data: SpatialEditDataMap[K],
}
export interface SpatialEditEvent<K extends SpatialEditModeId = SpatialEditModeId> {
  mode: K,
  sessionId: number,
  phase: 'start' | 'update' | 'commit' | 'cancel',
  targetId: string,
  revision: string,
  context: string,
  dimension: 3,
  coordinateSpace: 'local' | 'world',
  /** Angles use degrees; spatial units are the document's native units. */
  units: 'document',
  before: SpatialEditDataMap[K],
  after: SpatialEditDataMap[K],
  reason?: string,
}
/** Data and projection supplied only to the two spatial editing modes. */
export interface SpatialEditHost {
  contextKey(): string,
  read<K extends SpatialEditModeId>(mode: K): SpatialEditTarget<K> | undefined,
  canEdit(mode: SpatialEditModeId, targetId: string): boolean,
  dispatch<K extends SpatialEditModeId>(event: SpatialEditEvent<K>): void,
  project(point: Point3, itemId?: string): Vector2 | undefined,
  ray(point: Point2): Ray3 | undefined,
  /** Full local/world conversion, including parents; no inferred camera plane. */
  localToWorld(point: Point3, itemId: string): Point3,
  worldToLocal(point: Point3, itemId: string): Point3 | undefined,
  viewportSize(): Point2,
  /** Reuse the renderer's GizmoComponent hit geometry when the host has it. */
  nativeGizmoHit?(point: Point2, type: NativeGizmoType): NativeGizmoHit | undefined,
  /** Whether the renderer has an active native helper that owns the visual. */
  nativeGizmoVisible?(type: NativeGizmoType): boolean,
  /** World-space corners of selected objects and descendants, including model bounds. */
  focusBounds?(itemIds: readonly string[]): Point3[],
}
