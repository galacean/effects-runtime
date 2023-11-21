import * as spec from '@galacean/effects-specification';

export const particleOriginTranslateMap: Record<number, spec.vec2> = {
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

export function clamp (v: number, min: number, max: number): number {
  return v > max ? max : (v < min ? min : v);
}

export function nearestPowerOfTwo (value: number): number {
  return 2 ** Math.round(Math.log(value) / Math.LN2);
}

/**
 * 提取并转换 JSON 数据中的 anchor 值
 */
export function convertAnchor (anchor?: spec.vec2, particleOrigin?: spec.ParticleOrigin): spec.vec2 {
  if (anchor) {
    return [anchor[0] - 0.5, 0.5 - anchor[1]];
  } else if (particleOrigin) {
    return particleOriginTranslateMap[particleOrigin];
  } else {
    return [0, 0];
  }
}

