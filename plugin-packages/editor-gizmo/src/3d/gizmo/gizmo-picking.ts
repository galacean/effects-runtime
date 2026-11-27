import { math, type Camera } from '@galacean/effects';
import type { Point2 } from '../../math/types';
import { GizmoBoundsType, type GizmoBounds } from './gizmo-bounds';
import { distanceOfPointAndLine, projectionOfPointAndLine } from '../../math/projected-line';

const { Vector3, Ray } = math;

export interface GizmoHit {
  key: string,
  position: math.Vector3,
}

interface GizmoPickGeometry {
  readonly bounds: ReadonlyMap<string, GizmoBounds>,
  readonly matrix: math.Matrix4,
  readonly projection?: math.Matrix4,
}

/** Uses the current model matrices without changing tool or render state. */
export function hitTestGizmo (
  geometry: GizmoPickGeometry, ray: math.Ray, point: math.Vector2, camera: Camera, viewportSize: Point2,
): GizmoHit | undefined {
  let nearest: GizmoHit | undefined;
  let distance = Infinity;
  let screenDistance = Infinity;

  for (const [key, bound] of geometry.bounds) {
    let position: math.Vector3 | undefined;
    let pixelDistance: number | undefined;
    let viewDepth: number | undefined;

    switch (bound.type) {
      case GizmoBoundsType.circle: {
        const normal = bound.normal.clone().normalize();
        const u = new Vector3().crossVectors(normal, Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
        const v = new Vector3().crossVectors(normal, u);
        const center = geometry.matrix.getTranslation(new Vector3());
        const view = camera.worldPosition.clone().subtract(center).normalize();
        const worldNormal = geometry.matrix.transformNormal(normal).normalize();
        const projection = camera.getViewProjectionMatrix();
        const { x: width, y: height } = viewportSize;
        const screen = (p: math.Vector3) => {
          const ndc = p.clone().applyProjectionMatrix(projection);

          return new math.Vector2(ndc.x * width / 2, ndc.y * height / 2);
        };
        const mouse = new math.Vector2(point.x * width / 2, point.y * height / 2);
        let previous = u.clone().multiply(bound.radius).applyMatrix(geometry.matrix);

        for (let i = 1; i <= 96; i++) {
          const angle = i * Math.PI * 2 / 96;
          const current = u.clone().multiply(Math.cos(angle)).add(v.clone().multiply(Math.sin(angle))).multiply(bound.radius).applyMatrix(geometry.matrix);
          const visible = !bound.frontOnly || Math.abs(worldNormal.dot(view)) > 0.999
            || previous.clone().add(current).multiply(0.5).subtract(center).dot(view) >= 0;

          if (visible) {
            const a = screen(previous), b = screen(current), delta = b.subtract(a);
            const t = delta.lengthSquared() > 0 ? Math.max(0, Math.min(1, mouse.clone().subtract(a).dot(delta) / delta.lengthSquared())) : 0;
            const d = a.add(delta.multiply(t)).distance(mouse);

            if (d <= 6 && d < (pixelDistance ?? Infinity)) {
              pixelDistance = d;
              position = previous.clone().multiply(1 - t).add(current.clone().multiply(t));
            }
          }
          previous = current;
        }

        break;
      }
      case GizmoBoundsType.line:
        position = intersectRayLine(new Vector3(), point, bound.points, bound.width / 2, geometry.matrix, camera);

        break;
      case GizmoBoundsType.triangle:
        for (const triangle of bound.triangles) {
          const hit = ray.intersectTriangle({
            p0: new Vector3().copyFrom(triangle.p0).applyMatrix(geometry.matrix),
            p1: new Vector3().copyFrom(triangle.p1).applyMatrix(geometry.matrix),
            p2: new Vector3().copyFrom(triangle.p2).applyMatrix(geometry.matrix),
          }, new Vector3(), bound.backfaceCulling);

          if (hit && (!position || ray.origin.distanceSquared(hit) < ray.origin.distanceSquared(position))) { position = hit; }
        }

        break;
      case GizmoBoundsType.sphere: {
        const center = geometry.matrix.projectPoint(bound.center ?? Vector3.ZERO, new Vector3());

        if (geometry.projection) {
          const vp = geometry.projection.clone().multiply(camera.getViewMatrix());
          const screenCenter = vp.projectPoint(center, new Vector3());
          const up = camera.getInverseViewMatrix().transformNormal(new Vector3(0, 1, 0)).multiply(bound.radius);
          const screenEdge = vp.projectPoint(center.clone().add(up), new Vector3());
          const { x: width, y: height } = viewportSize;
          const delta = point.clone().subtract(screenCenter.toVector2());
          const edge = screenEdge.toVector2().subtract(screenCenter.toVector2());

          delta.set(delta.x * width / 2, delta.y * height / 2);
          edge.set(edge.x * width / 2, edge.y * height / 2);
          if (delta.length() < edge.length() * 1.2) {
            position = center;
            viewDepth = -camera.getViewMatrix().projectPoint(center, new Vector3()).z;
          }
        } else {
          const inverse = geometry.matrix.clone().invert();
          const localRay = new Ray(inverse.projectPoint(ray.origin, new Vector3()), inverse.transformNormal(ray.direction));
          const hit = localRay.intersectSphere({ center: bound.center ?? Vector3.ZERO, radius: bound.radius }, new Vector3());

          if (hit) { position = geometry.matrix.projectPoint(hit, new Vector3()); }
        }

        break;
      }
      case GizmoBoundsType.box: {
        const inverse = geometry.matrix.clone().invert();
        const localRay = new Ray(inverse.projectPoint(ray.origin, new Vector3()), inverse.transformNormal(ray.direction));
        const center = bound.center ?? Vector3.ZERO;
        const half = bound.size.clone().multiply(0.5);
        const hit = localRay.intersectBox({ min: center.clone().subtract(half), max: center.clone().add(half) }, new Vector3());

        if (hit) { position = geometry.matrix.projectPoint(hit, new Vector3()); }

        break;
      }
    }
    const depth = position && (viewDepth ?? ray.origin.distanceSquared(position));

    if (position && (pixelDistance !== undefined ? pixelDistance < screenDistance : depth! < distance)) {
      distance = depth!;
      screenDistance = pixelDistance ?? Infinity;
      nearest = { key, position };
    }
  }

  return nearest;
}

/**
 * 线条包围盒射线检测算法
 * @param out - 射线与包围盒交点位置
 * @param pointInCanvas - 归一化的画布交互点坐标
 * @param points - 线条包围盒两端点位置
 * @param radius - 线条包围盒辐射半径
 * @param camera - 相机对象
 * @returns 射线与包围盒交点位置 | undefined
 */
function intersectRayLine (
  out: math.Vector3,
  pointInCanvas: math.Vector2,
  points: [p0: math.Vector3, p1: math.Vector3],
  radius: number,
  worldMat4: math.Matrix4,
  camera: Camera,
): math.Vector3 | undefined {
  // 构造一个辐射半径边缘的点 radiusPoint
  const up = new Vector3(
    worldMat4.elements[1],
    worldMat4.elements[5],
    worldMat4.elements[9],
  ).normalize();

  const radiusPoint = up.clone().multiply(radius);

  radiusPoint.add(points[0]);

  // 计算 start、end、radius 在屏幕空间上的投影
  const mvpMat4 = camera.getModelViewProjection(new math.Matrix4(), worldMat4);

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
