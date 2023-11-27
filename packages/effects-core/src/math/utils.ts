import * as spec from '@galacean/effects-specification';
import type { vec2, vec3, vec4 } from '@galacean/effects-specification';
import type { TriangleLike } from '@galacean/effects-math/es/core/index';
import { Vector3, Ray } from '@galacean/effects-math/es/core/index';
import type { Camera } from '../camera';

export type vec = number[];

export function ensureVec3 (num?: any): vec3 {
  return Array.isArray(num) ? [num[0], num[1], num[2]] : [0, 0, 0];
}

export function vecFill<T extends vec | vec3 | vec4 | vec2> (out: T | number[], number: number): T {
  for (let i = 0, len = out.length; i < len; i++) {
    out[i] = number;
  }

  return out as T;
}

export function vecAssign<T extends vec | vec3 | vec4 | vec2> (out: T | number[] | Float32Array, a: T, count: number, start = 0): T {
  for (let i = 0; i < count; i++) {
    out[i] = a[i + start];
  }

  return out as T;
}

export function vecNormalize<T extends vec | vec2 | vec3 | vec4> (
  out: T | number[],
  a?: T | number[],
): T {
  if (arguments.length === 1) {
    a = out;
    out = [];
  }
  const ap = a!;
  const sum = Math.hypot(...ap);

  if (sum === 0) {
    return vecAssign(out, ap, ap.length) as T;
  }
  for (let i = 0; i < ap.length; i++) {
    out[i] = ap[i] / sum;
  }

  return out as T;
}

export function vecMulCombine<T extends vec | vec3 | vec4 | vec2> (out: T | number[] | Float32Array, a?: T, b?: T): T {
  if (a && b) {
    for (let i = 0, len = a.length; i < len; i++) {
      out[i] = a[i] * b[i];
    }
  } else if (a) {
    if (out !== a) {
      for (let i = 0; i < a.length; i++) {
        out[i] = a[i];
      }
    }
  } else if (b) {
    if (out !== b) {
      for (let i = 0; i < b.length; i++) {
        out[i] = b[i];
      }
    }
  }

  return out as T;
}

export const particleOriginTranslateMap: Record<number, vec2> = {
  [spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER]: [0, 0],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_BOTTOM]: [0, -0.5],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_CENTER_TOP]: [0, 0.5],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_TOP]: [-0.5, 0.5],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_CENTER]: [-0.5, 0],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_LEFT_BOTTOM]: [-0.5, -0.5],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_CENTER]: [0.5, 0],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_BOTTOM]: [0.5, -0.5],
  [spec.ParticleOrigin.PARTICLE_ORIGIN_RIGHT_TOP]: [0.5, 0.5],
};

/**
 * 提取并转换 JSON 数据中的 anchor 值
 */
export function convertAnchor (anchor?: vec2, particleOrigin?: spec.ParticleOrigin): vec2 {
  if (anchor) {
    return [anchor[0] - 0.5, 0.5 - anchor[1]];
  } else if (particleOrigin) {
    return particleOriginTranslateMap[particleOrigin];
  } else {
    return [0, 0];
  }
}

export function nearestPowerOfTwo (value: number): number {
  return 2 ** Math.round(Math.log(value) / Math.LN2);
}

export function setRayFromCamera (x: number, y: number, camera: Camera) {
  const origin = camera.position;
  const direction = new Vector3(x, y, 0);
  const dir = new Vector3();

  const mat = camera.getInverseViewProjectionMatrix();

  mat.projectPoint(direction, dir);
  dir.subtract(origin);

  return new Ray(origin, dir);
}

export function trianglesFromRect (position: Vector3, halfWidth: number, halfHeight: number): TriangleLike[] {
  const { x, y, z } = position;
  const p0 = new Vector3(x - halfWidth, y + halfHeight, z);
  const p1 = new Vector3(x - halfWidth, y - halfHeight, z);
  const p2 = new Vector3(x + halfWidth, y - halfHeight, z);
  const p3 = new Vector3(x + halfWidth, y + halfHeight, z);

  return [
    { p0, p1, p2 },
    { p0: p0.clone(), p1: p2.clone(), p2: p3 },
  ];
}
