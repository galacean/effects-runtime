import * as spec from '@galacean/effects-specification';
import type { vec2, vec3, vec4 } from '@galacean/effects-specification';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Ray } from '@galacean/effects-math/es/core/ray';
import type { TriangleLike } from '@galacean/effects-math/es/core/type';
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

export function decimalEqual (a: number, b: number, epsilon = 0.000001) {
  return Math.abs(a - b) < epsilon;
}

export function numberToFix (a: number, fixed = 2) {
  const base = Math.pow(10, fixed);

  return Math.floor(a * base) / base;
}
