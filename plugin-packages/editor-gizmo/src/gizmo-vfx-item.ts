import { math } from '@galacean/effects';

export type Ray = math.Ray;
export type TriangleLike = math.TriangleLike;
type Vector3 = math.Vector3;

const { Vector3, Ray } = math;

/**
 * 包围盒类型
 */
export enum BoundingType {
  box,
  sphere,
  triangle,
  line
}

/**
 * 线条包围盒类型
 */
export interface GizmoItemBoundingLine {
  type: BoundingType.line,
  // 线条包围盒两端点
  points: [Vector3, Vector3],
  // 射线与线条距离阈值
  width: number,
}

/**
 * 立方体包围盒类型
 */
export interface GizmoItemBoundingBox {
  type: BoundingType.box,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: Vector3,
  //包围盒的xyz长度，当type为box时生效
  size: Vector3,
}

/**
 * 球体包围盒类型
 */
export interface GizmoItemBoundingSphere {
  type: BoundingType.sphere,
  //包围形状相对于元素位置的偏移，默认[0,0,0]
  center?: Vector3,
  //包围球的半径，当type为sphere时生效
  radius: number,
}

/**
 * 三角数组包围盒类型
 */
export interface GizmoItemBoundingTriangle {
  type: BoundingType.triangle,
  triangles: TriangleLike[],
  backfaceCulling?: boolean,
}

export type GizmoItemBounding =
  | GizmoItemBoundingBox
  | GizmoItemBoundingSphere
  | GizmoItemBoundingTriangle
  | GizmoItemBoundingLine
  ;

/**
 *
 */
// export class GizmoVFXItem extends VFXItem<Mesh | undefined> {
//   constructor (engine: Engine, props?: VFXItemProps) {
//     super(engine, props);
//     const gizmoComponent = this.addComponent(GizmoComponent);

//     if (props) {
//       gizmoComponent.fromData(props);
//     }
//   }
// }
