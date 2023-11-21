
import type { Camera, spec } from '@galacean/effects';
import { vec3MulMat4, distanceOfPointAndLine, projectionOfPointAndLine, vecSub, vec3ToVec2, vecAdd, vecNormalize, vecMulScalar } from './math/vec';

type mat4 = spec.mat4;
type vec2 = spec.vec2;
type vec3 = spec.vec3;

/**
 * 线条包围盒射线检测算法
 * @param out - 射线与包围盒交点位置
 * @param pointInCanvas - 归一化的画布交互点坐标
 * @param points - 线条包围盒两端点位置
 * @param radius - 线条包围盒辐射半径
 * @param camera - 相机对象
 * @returns 射线与包围盒交点位置 | null
 */
export function intersectRayLine (
  out: vec3 | number[],
  pointInCanvas: vec2,
  points: [p0: vec3, p1: vec3],
  radius: number,
  worldMat4: mat4,
  camera: Camera,
): vec3 | null {
  // 构造一个辐射半径边缘的点 radiusPoint
  const radiusPoint: vec3 = [0, 0, 0];
  const up = [
    worldMat4[1],
    worldMat4[5],
    worldMat4[9],
  ];

  vecMulScalar(radiusPoint, vecNormalize(up), radius);
  vecAdd(radiusPoint, points[0], radiusPoint);

  // 计算 start、end、radius 在屏幕空间上的投影
  const mvpMat4 = camera.getModelViewProjection([], worldMat4);
  const screenStart: vec3 = [0, 0, 0];
  const screenEnd: vec3 = [0, 0, 0];
  const screenRadiusPoint: vec3 = [0, 0, 0];

  vec3MulMat4(screenStart, points[0], mvpMat4);
  vec3MulMat4(screenEnd, points[1], mvpMat4);
  vec3MulMat4(screenRadiusPoint, radiusPoint, mvpMat4);
  const screenRadiusVector: vec3 = [0, 0, 0];

  vecSub(screenRadiusVector, screenRadiusPoint, screenStart);
  const screenRadius = Math.hypot(...screenRadiusVector);

  // 计算屏幕交互点与线条的距离
  const { distance, isInLine } = distanceOfPointAndLine(pointInCanvas, [vec3ToVec2(screenStart), vec3ToVec2(screenEnd)]);

  if (distance <= screenRadius && isInLine) { // 距离小于阈值且交互点在线条上的投影位于线段内
    // 计算交互点在线条上的投影并转换为世界坐标
    const screenPosition = projectionOfPointAndLine(pointInCanvas, [screenStart, screenEnd]);
    const inverseViewProjection = camera.getInverseViewProjectionMatrix();
    const worldPosition: vec3 = [0, 0, 0];

    vec3MulMat4(worldPosition, screenPosition, inverseViewProjection);

    return out = worldPosition;
  }

  return null;
}
