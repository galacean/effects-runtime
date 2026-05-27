/**
 * 粒子全局唯一 ID 计数器。
 *
 * 对齐 UE Niagara Stateless `FNiagaraStatelessEmitterInstance::UniqueIndexOffset`：
 * 每个 emitter 维护一个单调递增 counter，spawn 时 ++,永不回收。
 * 仅在 `reset()`(对应 UE `ResetSimulation(bKillExisting=true)`) 重置为 0。
 *
 * 1 起始（0 留作 "未分配" 哨兵），与 UE 计数语义一致。
 */
export class ProIdTable {
  private nextUniqueIndex = 0;

  acquire (): number {
    return ++this.nextUniqueIndex;
  }

  reset (): void {
    this.nextUniqueIndex = 0;
  }
}
