import type { vec2, vec3 } from '@galacean/effects-specification';
import type { Camera } from '../camera';
import { vec3Cross, vec3MulMat4, vecAdd, vecDot, vecMinus, vecMulScalar, vecNormalize, vecSquareDistance } from './vec';

const tmp = [0, 0, 0];

export type Triangle = [p0: vec3, p1: vec3, p2: vec3];

export interface Ray {
  center: vec3,
  direction: vec3,
}

export function setRayFromCamera (x: number, y: number, camera: Camera) {
  const origin: vec3 = camera.position ?? [0, 0, 0];
  const direction: vec3 = [x, y, 0];
  const dir: vec3 = [0, 0, 0];

  vec3MulMat4(dir, direction, camera.getInverseViewProjectionMatrix());
  vecMinus(dir, dir, origin);

  return {
    center: origin,
    direction: vecNormalize([], dir),
  };
}

export function intersectRaySphere (out: vec3 | number[], origin: vec3, direction: vec3, center: vec3, radius: number): vec3 | null {
  vecMinus(tmp, center, origin);
  const len = vecDot(direction, tmp);

  if (len < 0) { // sphere is behind ray
    return null;
  }
  vecMulScalar(tmp, direction, len);
  vecAdd(tmp, origin, tmp);

  const dSq = vecSquareDistance(center, tmp);
  const rSq = radius * radius;

  if (dSq > rSq) {
    return null;
  }
  vecMulScalar(out, direction, len - Math.sqrt(rSq - dSq));

  return vecAdd(out as vec3, out as vec3, origin);
}

export function intersectRayBox (out: vec3 | number[], origin: vec3, direction: vec3, center: vec3, size: vec3): vec3 | null {
  const [dx, dy, dz] = direction;
  const [ox, oy, oz] = origin;
  const bxmin = center[0] - size[0] / 2,
    bxmax = center[0] + size[0] / 2,
    bymin = center[1] - size[1] / 2,
    bymax = center[1] + size[1] / 2,
    bzmin = center[2] - size[2] / 2,
    bzmax = center[2] + size[2] / 2;
  let tmin, tmax, tymin, tymax, tzmin, tzmax;
  const invdirx = 1 / dx, invdiry = 1 / dy, invdirz = 1 / dz;

  if (invdirx >= 0) {
    tmin = (bxmin - ox) * invdirx;
    tmax = (bxmax - ox) * invdirx;
  } else {
    tmin = (bxmax - ox) * invdirx;
    tmax = (bxmin - ox) * invdirx;
  }
  if (invdiry >= 0) {
    tymin = (bymin - oy) * invdiry;
    tymax = (bymax - oy) * invdiry;
  } else {
    tymin = (bymax - oy) * invdiry;
    tymax = (bymin - oy) * invdiry;
  }
  if ((tmin > tymax) || (tymin > tmax)) {
    return null;
  }
  if (tymin > tmin || tmin !== tmin) {
    tmin = tymin;
  }
  if (tymax < tmax || tmax !== tmax) {
    tmax = tymax;
  }
  if (tymin > tmin || tmin !== tmin) {
    tmin = tymin;
  }
  if (tymax < tmax || tmax !== tmax) {
    tmax = tymax;
  }
  if (invdirz >= 0) {
    tzmin = (bzmin - oz) * invdirz;
    tzmax = (bzmax - oz) * invdirz;
  } else {
    tzmin = (bzmax - oz) * invdirz;
    tzmax = (bzmin - oz) * invdirz;
  }
  if ((tmin > tzmax) || (tzmin > tmax)) {
    return null;
  }
  if (tzmin > tmin || tmin !== tmin) {
    tmin = tzmin;
  }
  if (tzmax < tmax || tmax !== tmax) {
    tmax = tzmax;
  }
  if (tmax < 0) {
    return null;
  }
  tmin >= 0 ? vecMulScalar(out, origin, tmin) : vecMulScalar(out, origin, tmax);

  return vecAdd(out as vec3, out as vec3, origin);

}

const edge1: vec3 = [0, 0, 0], edge2: vec3 = [0, 0, 0], normal: vec3 = [0, 0, 0], diff: vec3 = [0, 0, 0];

export function trianglesFromRect (position: vec3, halfWidth: number, halfHeight: number): Triangle[] {
  const [x, y, z] = position;
  const p0 = [x - halfWidth, y + halfHeight, z] as vec3;
  const p1 = [x - halfWidth, y - halfHeight, z] as vec3;
  const p2 = [x + halfWidth, y - halfHeight, z] as vec3;
  const p3 = [x + halfWidth, y + halfHeight, z] as vec3;

  return [
    [p0, p1, p2],
    [p0.slice() as vec3, p2.slice() as vec3, p3],
  ];
}

export function intersectRayTriangle (out: vec3 | number[], origin: vec3, direction: vec3, triangle: Triangle, backfaceCulling?: boolean): vec3 | null {
  let sign: number, DdN: number, DdQxE2: number, DdE1xQ: number, QdN: number;
  let temp: vec3 = direction;

  vecMinus(edge1, triangle[1], triangle[0]);
  vecMinus(edge2, triangle[2], triangle[0]);
  vecMinus(diff, origin, triangle[0]);
  vec3Cross(normal, edge1, edge2);

  DdN = vecDot(temp, normal);
  if (DdN > 0) {
    if (backfaceCulling) {
      return null;
    }
    sign = 1;
  } else if (DdN < 0) {
    sign = -1;
    DdN = -DdN;
  } else {
    return null;
  }
  vec3Cross(edge2, diff, edge2);
  temp = direction;
  DdQxE2 = vecDot(temp, edge2);
  DdQxE2 = sign * DdQxE2;
  if (DdQxE2 < 0) {
    return null;
  }

  vec3Cross(edge1, edge1, diff);
  temp = direction;
  DdE1xQ = vecDot(temp, edge1);
  DdE1xQ = sign * DdE1xQ;
  if (DdE1xQ < 0) {
    return null;
  }

  if (DdQxE2 + DdE1xQ > DdN) {
    return null;
  }

  QdN = vecDot(diff, normal);
  QdN = -sign * QdN;
  if (QdN < 0) {
    return null;
  }

  vecMulScalar(out, direction, QdN / DdN,);

  return vecAdd(out as vec3, out as vec3, origin);

}

const e0: vec2 = [0, 0], e1: vec2 = [0, 0], e2: vec2 = [0, 0];

export function dotInTriangle (out: boolean, dot: vec2, triangle: Triangle): boolean {
  const [p0, p1, p2] = triangle;
  const a = [p0[0], p0[1]], b = [p1[0], p1[1]], c = [p2[0], p2[1]];

  vecMinus(e0, c, a);
  vecMinus(e1, b, a);
  vecMinus(e2, dot, a);

  const dot00 = vecDot(e0, e0);
  const dot01 = vecDot(e0, e1);
  const dot02 = vecDot(e0, e2);
  const dot11 = vecDot(e1, e1);
  const dot12 = vecDot(e1, e2);

  const denom = (dot00 * dot11 - dot01 * dot01);

  if (denom === 0) {
    out = false;

    return out;
  }
  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  out = (1 - u - v >= 0) && (v >= 0) && ((1 - u) <= 1);

  return out;
}

