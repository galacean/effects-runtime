import { Transform, math, type Camera, type Engine, type Renderer, type Texture } from '@galacean/effects';
import type { GizmoSubType } from '../define';
import type { MeshOption } from '../geometry';
import { BoundingType, type GizmoItemBounding } from '../gizmo-bounds';
import { createGizmoGeometry, type GizmoGeometryData } from '../mesh';
import { intersectRayLine } from '../raycast';

const { Matrix4, Vector3, Ray } = math;

export interface GizmoGeometryHit {
  key: string,
  position: math.Vector3,
}

/** Geometry, materials and picking bounds owned by a gizmo rather than a scene item. */
export class GizmoGeometry {
  readonly bounds = new Map<string, GizmoItemBounding>();
  readonly matrix = new Matrix4();
  readonly parts: { data: GizmoGeometryData, local: Transform, matrix: math.Matrix4 }[];
  projection?: math.Matrix4;

  constructor (engine: Engine, type: GizmoSubType, options: MeshOption, icons?: Map<string, Texture>) {
    const data = createGizmoGeometry(engine, type, this.bounds, icons, options);
    const contents = data instanceof Map ? data : new Map([[data, new Transform()]]);

    this.parts = Array.from(contents, ([data, local]) => ({ data, local, matrix: new Matrix4() }));
  }

  updateMatrix (matrix: math.Matrix4): void {
    this.matrix.copyFrom(matrix);
    for (const part of this.parts) { part.matrix.copyFrom(matrix).multiply(part.local.getWorldMatrix()); }
  }

  draw (renderer: Renderer): void {
    for (const { data: { geometry, material }, matrix } of this.parts) {
      material.setMatrix('u_model', matrix);
      if (this.projection) { material.setMatrix('_MatrixP', this.projection); }
      renderer.drawGeometry(geometry, matrix, material);
    }
  }

  hit (ray: math.Ray, point: math.Vector2, camera: Camera): GizmoGeometryHit | undefined {
    let nearest: GizmoGeometryHit | undefined;
    let distance = Infinity;

    for (const [key, bound] of this.bounds) {
      let position: math.Vector3 | undefined;

      switch (bound.type) {
        case BoundingType.line:
          position = intersectRayLine(new Vector3(), point, bound.points, bound.width / 2, this.matrix, camera);

          break;
        case BoundingType.triangle:
          for (const triangle of bound.triangles) {
            const hit = ray.intersectTriangle({
              p0: new Vector3().copyFrom(triangle.p0).applyMatrix(this.matrix),
              p1: new Vector3().copyFrom(triangle.p1).applyMatrix(this.matrix),
              p2: new Vector3().copyFrom(triangle.p2).applyMatrix(this.matrix),
            }, new Vector3(), bound.backfaceCulling);

            if (hit && (!position || ray.origin.distanceSquared(hit) < ray.origin.distanceSquared(position))) { position = hit; }
          }

          break;
        case BoundingType.sphere: {
          const center = this.matrix.projectPoint(bound.center ?? Vector3.ZERO, new Vector3());

          if (this.projection) {
            const vp = this.projection.clone().multiply(camera.getViewMatrix());
            const screenCenter = vp.projectPoint(center, new Vector3());
            const up = camera.getInverseViewMatrix().transformNormal(new Vector3(0, 1, 0)).multiply(bound.radius);
            const screenEdge = vp.projectPoint(center.clone().add(up), new Vector3());
            const radius = screenCenter.toVector2().distance(screenEdge.toVector2());

            if (point.distance(screenCenter.toVector2()) < radius * 1.2) { position = center; }
          } else {
            position = ray.intersectSphere({ center, radius: bound.radius }, new Vector3());
          }

          break;
        }
        case BoundingType.box: {
          const inverse = this.matrix.clone().invert();
          const localRay = new Ray(inverse.projectPoint(ray.origin, new Vector3()), inverse.transformNormal(ray.direction));
          const center = bound.center ?? Vector3.ZERO;
          const half = bound.size.clone().multiply(0.5);
          const hit = localRay.intersectBox({ min: center.clone().subtract(half), max: center.clone().add(half) }, new Vector3());

          if (hit) { position = this.matrix.projectPoint(hit, new Vector3()); }

          break;
        }
      }
      if (position && ray.origin.distanceSquared(position) < distance) {
        distance = ray.origin.distanceSquared(position);
        nearest = { key, position };
      }
    }

    return nearest;
  }

  dispose (): void {
    for (const { data } of this.parts) {
      data.geometry.dispose();
      data.material.dispose();
    }
    this.parts.length = 0;
    this.bounds.clear();
  }
}
