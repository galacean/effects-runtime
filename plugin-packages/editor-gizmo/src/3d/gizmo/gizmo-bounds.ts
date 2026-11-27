import type { math } from '@galacean/effects';

type TriangleLike = math.TriangleLike;
type Vector3 = math.Vector3;

/**
 * 包围盒类型
 */
export enum GizmoBoundsType {
  box,
  sphere,
  triangle,
  line,
  circle,
}

export interface GizmoCircleBounds {
  type: GizmoBoundsType.circle,
  normal: Vector3,
  radius: number,
  frontOnly?: boolean,
}

/**
 * 线条包围盒类型
 */
export interface GizmoLineBounds {
  type: GizmoBoundsType.line,
  // 线条包围盒两端点
  points: [Vector3, Vector3],
  // 射线与线条距离阈值
  width: number,
}

/**
 * 立方体包围盒类型
 */
export interface GizmoBoxBounds {
  type: GizmoBoundsType.box,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: Vector3,
  //包围盒的xyz长度，当type为box时生效
  size: Vector3,
}

/**
 * 球体包围盒类型
 */
export interface GizmoSphereBounds {
  type: GizmoBoundsType.sphere,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: Vector3,
  //包围球的半径，当type为sphere时生效
  radius: number,
}

/**
 * 三角数组包围盒类型
 */
export interface GizmoTriangleBounds {
  type: GizmoBoundsType.triangle,
  triangles: TriangleLike[],
  backfaceCulling?: boolean,
}

export type GizmoBounds =
  | GizmoBoxBounds
  | GizmoSphereBounds
  | GizmoTriangleBounds
  | GizmoLineBounds
  | GizmoCircleBounds
  ;
