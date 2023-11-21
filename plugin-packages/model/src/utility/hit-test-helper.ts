
import type { Composition, Ray, Region, spec } from '@galacean/effects';
import { intersectRayBox } from '@galacean/effects';
import { Matrix4, Vector3, Vector4 } from '../math';
import type { ModelItemBounding, ModelItemBoundingBox } from '../index';
import { VFX_ITEM_TYPE_3D } from '../plugin/const';
import type { ModelVFXItem } from '../plugin/model-vfx-item';
import type { PMesh } from '../runtime';
import { PObjectType } from '../runtime/common';

// 射线与带旋转的包围盒求交
function transformDirection (m: Matrix4, direction: Vector3) {
  const x = direction.x;
  const y = direction.y;
  const z = direction.z;
  const result = new Vector3();

  result.x = m.data[0] * x + m.data[4] * y + m.data[8] * z;
  result.y = m.data[1] * x + m.data[5] * y + m.data[9] * z;
  result.z = m.data[2] * x + m.data[6] * y + m.data[10] * z;

  return result.normalize();

}

function RayIntersectsBoxWithRotation (ray: Ray, matrixData: spec.mat4, bounding: ModelItemBounding) {
  const local2World = Matrix4.fromArray(matrixData);
  const world2Local = Matrix4.inverse(local2World, new Matrix4());

  const origin = new Vector4(ray.center[0], ray.center[1], ray.center[2], 1.0);
  const direction = new Vector3(ray.direction[0], ray.direction[1], ray.direction[2]);

  const origin2 = Matrix4.multiplyByVector(world2Local, origin, new Vector4());
  const direction2 = transformDirection(world2Local, direction);

  const insersetPoint: any = intersectRayBox([], [origin2.x, origin2.y, origin2.z], [direction2.x, direction2.y, direction2.z], bounding.center as spec.vec3, (bounding as ModelItemBoundingBox).size as spec.vec3);

  if (insersetPoint !== null) {
    const insersetPointInWorld = Matrix4.multiplyByVector(local2World, new Vector4(insersetPoint[0], insersetPoint[1], insersetPoint[2], 1.0), new Vector4());

    return [[insersetPointInWorld.x, insersetPointInWorld.y, insersetPointInWorld.z]];
  } else {
    return;
  }
}

function RayBoxTesting (ro: Vector3, rd: Vector3, bmin: Vector3, bmax: Vector3): number | undefined {
  let tmin = 0, tmax = 0;
  let tymin = 0, tymax = 0;
  let tzmin = 0, tzmax = 0;
  const invdirx = 1 / rd.x;
  const invdiry = 1 / rd.y;
  const invdirz = 1 / rd.z;

  if (invdirx >= 0) {
    tmin = (bmin.x - ro.x) * invdirx;
    tmax = (bmax.x - ro.x) * invdirx;
  } else {
    tmin = (bmax.x - ro.x) * invdirx;
    tmax = (bmin.x - ro.x) * invdirx;
  }

  if (invdiry >= 0) {
    tymin = (bmin.y - ro.y) * invdiry;
    tymax = (bmax.y - ro.y) * invdiry;
  } else {
    tymin = (bmax.y - ro.y) * invdiry;
    tymax = (bmin.y - ro.y) * invdiry;
  }

  // These lines also handle the case where tmin or tmax is NaN
  // (result of 0 * Infinity). x !== x returns true if x is NaN
  if (tmin > tymax || tymin > tmax) {
    return;
  }

  if (tymin > tmin || tmin !== tmin) {
    tmin = tymin;
  }
  if (tymax < tmax || tmax !== tmax) {
    tmax = tymax;
  }

  if (invdirz >= 0) {
    tzmin = (bmin.z - ro.z) * invdirz;
    tzmax = (bmax.z - ro.z) * invdirz;
  } else {
    tzmin = (bmax.z - ro.z) * invdirz;
    tzmax = (bmin.z - ro.z) * invdirz;
  }

  if (tmin > tzmax || tzmin > tmax) {
    return;
  }
  if (tzmin > tmin || tmin !== tmin) {
    tmin = tzmin;
  }
  if (tzmax < tmax || tmax !== tmax) {
    //return point closest to the ray (positive side)
    tmax = tzmax;
  }

  if (tmax < 0) {
    return;
  }

  return tmin >= 0 ? tmin : tmax;
}

const diff = new Vector3();
const edge1 = new Vector3();
const edge2 = new Vector3();
const normal = new Vector3();

function RayTriangleTesting (ro: Vector3, rd: Vector3, a: Vector3, b: Vector3, c: Vector3, backfaceCulling: boolean): number | undefined {
  // Compute the offset origin, edges, and normal.
  // from https://github.com/pmjoniak/GeometricTools/blob/master/GTEngine/Include/Mathematics/GteIntrRay3Triangle3.h
  Vector3.subtract(b, a, edge1);
  Vector3.subtract(c, a, edge2);
  Vector3.cross(edge1, edge2, normal);
  // Solve Q + t*D = b1*E1 + b2*E2 (Q = kDiff, D = ray direction,
  // E1 = kEdge1, E2 = kEdge2, N = Cross(E1,E2)) by
  //	 |Dot(D,N)|*b1 = sign(Dot(D,N))*Dot(D,Cross(Q,E2))
  //	 |Dot(D,N)|*b2 = sign(Dot(D,N))*Dot(D,Cross(E1,Q))
  //	 |Dot(D,N)|*t = -sign(Dot(D,N))*Dot(Q,N)

  let DdN = rd.dot(normal);
  let sign = 0;

  if (DdN > 0) {
    if (backfaceCulling) { return; }
    sign = 1;
  } else if (DdN < 0) {
    sign = -1;
    DdN = -DdN;
  } else {
    return;
  }

  Vector3.subtract(ro, a, diff);

  Vector3.cross(diff, edge2, edge2);
  const DdQxE2 = sign * rd.dot(edge2); // b1 < 0, no intersection

  if (DdQxE2 < 0) {
    return;
  }

  Vector3.cross(edge1, diff, edge1);
  const DdE1xQ = sign * rd.dot(edge1); // b2 < 0, no intersection

  if (DdE1xQ < 0) {
    return;
  } // b1+b2 > 1, no intersection

  if (DdQxE2 + DdE1xQ > DdN) {
    return;
  } // Line intersects triangle, check if ray does.

  const QdN = -sign * diff.dot(normal); // t < 0, no intersection

  if (QdN < 0) {
    return;
  } // Ray intersects triangle.

  return QdN / DdN;
}

function CompositionHitTest (composition: Composition, x: number, y: number): Region[] {
  const regions = composition.hitTest(x, y, true);
  const ray = composition.getHitTestRay(x, y);

  if (regions.length <= 0) {
    return [];
  }

  const o = ray.center;
  const d = ray.direction;
  const nums = regions.map((region, index) => {
    const p = region.position;
    //const p = (region.hitPositions as vec3[]) [index];
    const t: spec.vec3 = [0, 0, 0];

    for (let i = 0; i < 3; i++) {
      t[i] = (p[i] - o[i]) / d[i];
    }

    return [index, Math.max(...t)];
  });

  nums.sort(function (a, b) {
    const a1 = a[1] >= 0 ? a[1] : (a[1] + 1000000000);
    const b1 = b[1] >= 0 ? b[1] : (b[1] + 1000000000);

    return a1 - b1;
  });

  return nums.map(val => {
    return regions[val[0]];
  });
}

function ToggleItemBounding (composition: Composition, itemId: string) {
  composition.items?.forEach(item => {
    if (item.type === VFX_ITEM_TYPE_3D) {
      const modelItem = item as ModelVFXItem;

      if (modelItem.content.type === PObjectType.mesh) {
        const mesh = modelItem.content as PMesh;

        if (modelItem.id === itemId) { mesh.visBoundingBox = true; } else { mesh.visBoundingBox = false; }
      }
    }
  });
}

export { RayIntersectsBoxWithRotation, RayBoxTesting, RayTriangleTesting, ToggleItemBounding, CompositionHitTest };
