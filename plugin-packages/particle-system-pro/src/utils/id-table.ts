import type { ProParticleId } from '../types/particle-id';

/**
 * 粒子持久 ID 分配表。
 *
 * 维护一个 free-list 与一个 acquireTag 计数器。释放后的 index 会被回收，
 * 但每次新分配会用新的 acquireTag，因此调用方仍能识别旧 ID 是否过期。
 *
 * Phase 1 只提供 acquire / release / reset 基础能力；GPU readback / 跨帧
 * 持久 ID 表的复杂同步留到后续 Phase。
 */
export class ProIdTable {
  private freeList: number[] = [];
  private nextIndex = 0;
  private acquireTag = 0;

  acquire (): ProParticleId {
    const tag = ++this.acquireTag;
    const index = this.freeList.length > 0
      ? this.freeList.pop() as number
      : this.nextIndex++;

    return { index, acquireTag: tag };
  }

  release (id: ProParticleId): void {
    if (id.index < 0) {
      return;
    }
    this.freeList.push(id.index);
  }

  reset (): void {
    this.freeList.length = 0;
    this.nextIndex = 0;
    this.acquireTag = 0;
  }

  /**
   * 已分配过的最大 index + 1。可用于上限校验。
   */
  get capacity (): number {
    return this.nextIndex;
  }
}
