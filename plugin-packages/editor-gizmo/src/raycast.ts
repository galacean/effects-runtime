import type { Camera } from '@galacean/effects';
import { math } from '@galacean/effects';
import { distanceOfPointAndLine, projectionOfPointAndLine } from './math-utils';

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Matrix4 = math.Matrix4;

const { Matrix4, Vector2, Vector3 } = math;

/**
 * 线条包围盒射线检测算法
 * @param out - 射线与包围盒交点位置
 * @param pointInCanvas - 归一化的画布交互点坐标
 * @param points - 线条包围盒两端点位置
 * @param radius - 线条包围盒辐射半径
 * @param camera - 相机对象
 * @returns 射线与包围盒交点位置 | undefined
 */
export function intersectRayLine (
  out: Vector3,
  pointInCanvas: Vector2,
  points: [p0: Vector3, p1: Vector3],
  radius: number,
  worldMat4: Matrix4,
  camera: Camera,
): Vector3 | undefined {
  // 构造一个辐射半径边缘的点 radiusPoint
  const up = new Vector3(
    worldMat4.elements[1],
    worldMat4.elements[5],
    worldMat4.elements[9],
  ).normalize();

  const radiusPoint = up.clone().multiply(radius);

  radiusPoint.add(points[0]);

  // 计算 start、end、radius 在屏幕空间上的投影
  const mvpMat4 = camera.getModelViewProjection(new Matrix4(), worldMat4);

  const screenStart = mvpMat4.projectPoint(points[0], new Vector3());
  const screenEnd = mvpMat4.projectPoint(points[1], new Vector3());
  const screenRadiusPoint = mvpMat4.projectPoint(radiusPoint, new Vector3());

  const screenRadiusVector = screenRadiusPoint.clone().subtract(screenStart);

  const screenRadius = screenRadiusVector.length();

  // 计算屏幕交互点与线条的距离
  const { distance, isInLine } = distanceOfPointAndLine(pointInCanvas, [screenStart.toVector2(), screenEnd.toVector2()]);

  if (distance <= screenRadius && isInLine) { // 距离小于阈值且交互点在线条上的投影位于线段内
    // 计算交互点在线条上的投影并转换为世界坐标
    const screenPosition = projectionOfPointAndLine(pointInCanvas, [screenStart, screenEnd]);
    const inverseViewProjection = camera.getInverseViewProjectionMatrix();

    inverseViewProjection.projectPoint(screenPosition, out);

    return out;
  }
}
