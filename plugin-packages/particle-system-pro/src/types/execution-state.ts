/**
 * Emitter / System 执行状态。
 *
 * - Active：正常 spawn 与 update
 * - Inactive：停止 spawn，但仍 update 现有粒子直到耗尽
 * - InactiveClear：立刻清空所有粒子并转为 Inactive
 * - Complete：已完成，等待销毁
 */
export enum ProExecutionState {
  Active = 'active',
  Inactive = 'inactive',
  InactiveClear = 'inactiveClear',
  Complete = 'complete',
}
