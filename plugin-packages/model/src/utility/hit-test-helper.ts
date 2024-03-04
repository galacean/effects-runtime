import type { Composition, Region, spec, math } from '@galacean/effects';
import type { Ray, Matrix4 } from '../runtime/math';
import { Vector3 } from '../runtime/math';
import type { ModelItemBounding, ModelItemBoundingBox } from '../index';
import { VFX_ITEM_TYPE_3D } from '../plugin/const';
import type { ModelVFXItem } from '../plugin/model-vfx-item';
import type { PMesh } from '../runtime';
import { PObjectType } from '../runtime/common';

type Ray = math.Ray;

// 射线与带旋转的包围盒求交
function transformDirection (m: Matrix4, direction: Vector3) {
  const x = direction.x;
  const y = direction.y;
  const z = direction.z;
  const me = m.elements;
  const result = new Vector3();

  result.x = me[0] * x + me[4] * y + me[8] * z;
  result.y = me[1] * x + me[5] * y + me[9] * z;
  result.z = me[2] * x + me[6] * y + me[10] * z;

  return result.normalize();

}

/**
 * 带旋转的射线与包围盒求交
 * @param ray - 射线
 * @param matrixData - 矩阵
 * @param bounding - 包围盒
 * @returns 交点列表或者 undefined
 */
function RayIntersectsBoxWithRotation (ray: Ray, matrixData: Matrix4, bounding: ModelItemBounding) {
  const local2World = matrixData;
  const world2Local = local2World.clone().invert();

  const newRay = ray.clone().applyMatrix(world2Local);
  const boxCenter = Vector3.fromArray(bounding.center!);
  const boxHalfSize = Vector3.fromArray((bounding as ModelItemBoundingBox).size!).multiply(0.5);
  const boxMin = boxCenter.clone().subtract(boxHalfSize);
  const boxMax = boxCenter.clone().add(boxHalfSize);
  const intersetPoint = newRay.intersectBox({ min: boxMin, max: boxMax }, new Vector3());

  if (intersetPoint !== undefined) {
    const insersetPointInWorld = local2World.transformPoint(intersetPoint);

    return [insersetPointInWorld];
  } else {
    return;
  }
}

/**
 * 射线与包围盒求交
 * @param ro - 射线原点
 * @param rd - 射线方向
 * @param bmin - 包围盒左下点
 * @param bmax - 包围盒右上点
 * @returns 交点参数或者 undefined
 */
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

/**
 * 射线与三角形求交
 * @param ro - 射线原点
 * @param rd - 射线方向
 * @param a - 三角形点
 * @param b - 三角形点
 * @param c - 三角形点
 * @param backfaceCulling - 是否剔除背面
 * @returns 交点参数或者 undefined
 */
function RayTriangleTesting (ro: Vector3, rd: Vector3, a: Vector3, b: Vector3, c: Vector3, backfaceCulling: boolean): number | undefined {
  // Compute the offset origin, edges, and normal.
  // from https://github.com/pmjoniak/GeometricTools/blob/master/GTEngine/Include/Mathematics/GteIntrRay3Triangle3.h
  edge1.subtractVectors(b, a);
  edge2.subtractVectors(c, a);
  normal.crossVectors(edge1, edge2);
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

  diff.subtractVectors(ro, a);

  edge2.crossVectors(diff, edge2);
  const DdQxE2 = sign * rd.dot(edge2); // b1 < 0, no intersection

  if (DdQxE2 < 0) {
    return;
  }

  edge1.crossVectors(edge1, diff);
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

/**
 * 合成点击测试，支持获取多个交点，并按照远近排序
 * @param composition - 合成
 * @param x - 点击 x 坐标
 * @param y - 点击 y 坐标
 * @returns 点击信息列表
 */
function CompositionHitTest (composition: Composition, x: number, y: number): Region[] {
  const regions = composition.hitTest(x, y, true);
  const ray = composition.getHitTestRay(x, y);

  if (regions.length <= 0) {
    return [];
  }

  const o = ray.origin;
  const d = ray.direction;
  const nums = regions.map((region, index) => {
    const p = region.position;
    //const p = (region.hitPositions as vec3[]) [index];
    const t: spec.vec3 = [0, 0, 0];

    for (let i = 0; i < 3; i++) {
      t[i] = (p.getElement(i) - o.getElement(i)) / d.getElement(i);
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

/**
 * 切换 3D Mesh 元素的包围盒显示标志
 * @param composition - 合成
 * @param itemId - 元素 id
 */
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
