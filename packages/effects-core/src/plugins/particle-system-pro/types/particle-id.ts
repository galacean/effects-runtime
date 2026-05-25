/**
 * 粒子持久 ID。
 *
 * index 是 ID 表中的槽位，acquireTag 是分配时的唯一标签。
 * 配合使用可在 index 被回收复用后仍区分出"旧粒子"与"新粒子"。
 */
export interface ProParticleId {
  index: number,
  acquireTag: number,
}

export const PRO_INVALID_PARTICLE_ID: ProParticleId = Object.freeze({
  index: -1,
  acquireTag: -1,
}) as ProParticleId;

export function proParticleIdEquals (a: ProParticleId, b: ProParticleId): boolean {
  return a.index === b.index && a.acquireTag === b.acquireTag;
}

export function isProParticleIdValid (id: ProParticleId): boolean {
  return id.index >= 0 && id.acquireTag >= 0;
}
