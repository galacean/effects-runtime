import * as spec from '@galacean/effects-specification';
import type { vec2, vec3, vec4 } from '@galacean/effects-specification';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Ray } from '@galacean/effects-math/es/core/ray';
import type { TriangleLike } from '@galacean/effects-math/es/core/type';
import type { Camera } from '../camera';
import type { Vector2 } from '@galacean/effects-math/es/core/vector2';

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

/**
 * 最小最大值结果
 */
export interface MinMaxResult {
  /** 最小值向量 */
  minimum: Vector3,
  /** 最大值向量 */
  maximum: Vector3,
}

/**
 * 从位置数组中提取最小和最大值
 * @param positions - 位置数据数组
 * @param start - 起始索引
 * @param count - 要处理的顶点数量
 * @param bias - 可选的偏移值
 * @param stride - 步长（默认为 3，即 x, y, z）
 * @returns 包含 minimum 和 maximum Vector3 的对象
 */
export function extractMinAndMax (positions: number[] | Float32Array, start: number, count: number, bias: Vector2 | null = null, stride?: number): MinMaxResult {
  const minimum = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
  const maximum = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

  if (!stride) {
    stride = 3;
  }

  for (let index = start, offset = start * stride; index < start + count; index++, offset += stride) {
    const x = positions[offset];
    const y = positions[offset + 1];
    const z = positions[offset + 2];

    minimum.x = Math.min(minimum.x, x);
    minimum.y = Math.min(minimum.y, y);
    minimum.z = Math.min(minimum.z, z);
    maximum.x = Math.max(maximum.x, x);
    maximum.y = Math.max(maximum.y, y);
    maximum.z = Math.max(maximum.z, z);
  }

  if (bias) {
    minimum.x -= minimum.x * bias.x + bias.y;
    minimum.y -= minimum.y * bias.x + bias.y;
    minimum.z -= minimum.z * bias.x + bias.y;
    maximum.x += maximum.x * bias.x + bias.y;
    maximum.y += maximum.y * bias.x + bias.y;
    maximum.z += maximum.z * bias.x + bias.y;
  }

  return {
    minimum,
    maximum,
  };
}