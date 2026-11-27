import { Transform, math, type Camera, type Engine, type Renderer, type Texture } from '@galacean/effects';
import type { GizmoSubType } from '../define';
import type { MeshOption } from '../geometry';
import { BoundingType, type GizmoItemBounding } from '../gizmo-bounds';
import { createGizmoGeometry, type GizmoGeometryData } from '../mesh';
import { intersectRayLine } from '../raycast';
import { color as palette, gizmoOpacity } from '../constants';

const { Matrix4, Vector2, Vector3, Ray } = math;

export interface GizmoGeometryHit {
  key: string,
  position: math.Vector3,
}

/** Geometry, materials and picking bounds owned by a gizmo rather than a scene item. */
export class GizmoGeometry {
  readonly bounds = new Map<string, GizmoItemBounding>();
  readonly matrix = new Matrix4();
  readonly parts: {
    data: GizmoGeometryData, local: Transform, matrix: math.Matrix4,
    position: math.Vector3, scale: math.Vector3, color: math.Vector3 | null,
  }[];
  projection?: math.Matrix4;

  constructor (private readonly engine: Engine, type: GizmoSubType, options: MeshOption, icons?: Map<string, Texture>) {
    const data = createGizmoGeometry(engine, type, this.bounds, icons, options);
    const contents = data instanceof Map ? data : new Map([[data, new Transform()]]);

    this.parts = Array.from(contents, ([data, local]) => ({
      data, local, matrix: new Matrix4(), position: local.position.clone(), scale: local.scale.clone(),
      color: data.material.getVector3('u_color')?.clone() ?? null,
    }));
  }

  highlight (key?: string, highlightAllAxes = false): void {
    for (const { data, color } of this.parts) {
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

  updateRotation (
    viewRotation: math.Quaternion, active?: string,
    feedback?: { axis: math.Vector3, from: math.Vector3, angle: number },
  ): void {
    const viewNormal = new Vector3(0, 0, 1).applyQuaternion(viewRotation);

    for (const { data, local } of this.parts) {
      if (data.name === 'freeRing' || data.name === 'screenRing') { local.setTransform({ quat: viewRotation }); }
      const axis = ['xAxis', 'yAxis', 'zAxis'].indexOf(data.name);
      const full = data.name === active || axis >= 0 && Math.abs(viewNormal.getElement(axis)) > 0.999;

      data.material.setFloat('u_showFull', full ? 1 : 0);
      if (data.name !== 'rotationSector' && data.name !== 'rotationLines') { continue; }
      if (!feedback) { data.geometry.setDrawCount(0); continue; }
      const vertices = data.geometry.getAttributeData('a_Position') as Float32Array;
      const radius = active === 'screenRing' ? 1.76 : 1.6;
      const from = feedback.from.clone().multiply(radius);
      const to = from.clone().applyQuaternion(new math.Quaternion().setFromAxisAngle(feedback.axis, feedback.angle));

      vertices.fill(0);
      if (data.name === 'rotationLines') {
        vertices.set(from.toArray(), 3);
        vertices.set(to.toArray(), 9);
        data.geometry.setDrawCount(4);
      } else {
        const angle = Math.sign(feedback.angle) * Math.min(Math.abs(feedback.angle), Math.PI * 2);

        for (let i = 0; i <= 64; i++) {
          const point = from.clone().applyQuaternion(new math.Quaternion().setFromAxisAngle(feedback.axis, angle * i / 64));

          vertices.set(point.toArray(), (i + 1) * 3);
        }
        data.geometry.setDrawCount(64 * 3);
      }
      data.geometry.setAttributeData('a_Position', vertices);
    }
    const screenRing = this.bounds.get('screenRing');

    if (screenRing?.type === BoundingType.circle) { screenRing.normal.set(0, 0, 1).applyQuaternion(viewRotation); }
  }

  /** Stretch the axis shafts and move their end caps without enlarging the caps. */
  updateScale (value: math.Vector3): void {
    for (const { data, local, position, scale } of this.parts) {
      const axis = data.name.startsWith('xAxis') ? 0 : data.name.startsWith('yAxis') ? 1 : data.name.startsWith('zAxis') ? 2 : undefined;
      const nextScale = scale.clone();
      const nextPosition = position.clone();

      if (axis !== undefined) {
        const factor = value.getElement(axis);

        nextPosition.multiply(factor);
        if (data.name.endsWith('Line')) { nextScale.x *= Math.abs(factor); }
      }
      local.setTransform({ position: nextPosition, scale: nextScale });
    }
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
    let screenDistance = Infinity;

    for (const [key, bound] of this.bounds) {
      let position: math.Vector3 | undefined;
      let pixelDistance: number | undefined;
      let viewDepth: number | undefined;

      switch (bound.type) {
        case BoundingType.circle: {
          const normal = bound.normal.clone().normalize();
          const u = new Vector3().crossVectors(normal, Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
          const v = new Vector3().crossVectors(normal, u);
          const center = this.matrix.getTranslation(new Vector3());
          const view = camera.worldPosition.clone().subtract(center).normalize();
          const worldNormal = this.matrix.transformNormal(normal).normalize();
          const projection = camera.getViewProjectionMatrix();
          const { width, height } = this.engine.canvas.getBoundingClientRect();
          const screen = (p: math.Vector3) => {
            const ndc = p.clone().applyProjectionMatrix(projection);

            return new math.Vector2(ndc.x * width / 2, ndc.y * height / 2);
          };
          const mouse = new math.Vector2(point.x * width / 2, point.y * height / 2);
          let previous = u.clone().multiply(bound.radius).applyMatrix(this.matrix);

          for (let i = 1; i <= 96; i++) {
            const angle = i * Math.PI * 2 / 96;
            const current = u.clone().multiply(Math.cos(angle)).add(v.clone().multiply(Math.sin(angle))).multiply(bound.radius).applyMatrix(this.matrix);
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
            const { width, height } = this.engine.canvas.getBoundingClientRect();
            const delta = point.clone().subtract(screenCenter.toVector2());
            const edge = screenEdge.toVector2().subtract(screenCenter.toVector2());

            delta.set(delta.x * width / 2, delta.y * height / 2);
            edge.set(edge.x * width / 2, edge.y * height / 2);
            if (delta.length() < edge.length() * 1.2) {
              position = center;
              viewDepth = -camera.getViewMatrix().projectPoint(center, new Vector3()).z;
            }
          } else {
            const inverse = this.matrix.clone().invert();
            const localRay = new Ray(inverse.projectPoint(ray.origin, new Vector3()), inverse.transformNormal(ray.direction));
            const hit = localRay.intersectSphere({ center: bound.center ?? Vector3.ZERO, radius: bound.radius }, new Vector3());

            if (hit) { position = this.matrix.projectPoint(hit, new Vector3()); }
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
      const depth = position && (viewDepth ?? ray.origin.distanceSquared(position));

      if (position && (pixelDistance !== undefined ? pixelDistance < screenDistance : depth! < distance)) {
        distance = depth!;
        screenDistance = pixelDistance ?? Infinity;
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
