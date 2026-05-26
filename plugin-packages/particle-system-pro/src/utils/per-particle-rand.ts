/**
 * Per-particle 子随机生成。
 *
 * 给定一个 spawn 时写入 Particle.RandomSeed 的 [0,1) 值，配合一个 32-bit salt
 * 衍生出多个独立子随机 — 让同一粒子的不同属性（rate / radius / phase 等）拿到
 * 互不相关的随机偏移，而不是共享同一个 random 形成强相关。
 *
 * 替代旧版 `(i * GOLDEN_RATIO_FRAC) % 1` slot-index hash 的缺陷：
 * - slot 复用：同一 slot 不同生命周期粒子拿相同 rand
 * - i=0 永远 pRand=0：第一个粒子永远在 distribution 下界
 * - reseed 完全无效
 * - 多属性共享一个 rand → 完全相关
 *
 * 实现：整数 LCG 风格 — `(seedAsInt ^ salt) * 1664525 + 1013904223`，
 * 截取低 24 位归一到 [0,1)。比 sin-based 浮点 hash 更稳，无 NaN / 精度坑
 */
export function hashSeed (seed: number, salt: number): number {
  const x = (Math.floor(seed * 0x1000000) ^ salt) >>> 0;
  const y = (Math.imul(x, 1664525) + 1013904223) >>> 0;

  return (y & 0xffffff) / 0x1000000;
}

/** 常用 salt 集合 — 给同一模块的多个属性用，避免每个模块自己挑魔数 */
export const ParticleRandSalts = {
  Rate: 0x9e3779b1,
  Radius: 0x85ebca77,
  Phase: 0xc2b2ae3d,
  ScaleX: 0x27d4eb2f,
  ScaleY: 0x165667b1,
  Color: 0xd3a2646c,
  Speed: 0xfd7046c5,
  Generic: 0xb55a4f09,
} as const;
