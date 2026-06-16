export enum EmitterExecutionState {
  Active = 'active',
  Inactive = 'inactive',
  Complete = 'complete',
}

/**
 * Emitter 生命周期状态机。
 *
 * 对齐 Niagara Stateless 的 TickEmitterState：
 * - emitterAge 单调递增，不受 loop 影响
 * - loopAge 每次 loop 自然归零
 * - 不使用时间回退
 */
export class EmitterState {
  // ── Config（由 particle-system 在 onStart 时设置） ──
  duration = 1;
  looping = false;
  endBehavior = 0;

  // ── Runtime State ──
  executionState: EmitterExecutionState = EmitterExecutionState.Active;
  emissionStopped = false;
  emitterAge = 0;
  loopAge = 0;

  get loopLifetime (): number {
    return this.duration > 0 ? this.loopAge / this.duration : 0;
  }

  get timePassed (): number {
    return this.loopAge;
  }

  /**
   * 每帧推进 loop 状态机。返回是否发生了 loop wrap。
   */
  advance (deltaTime: number): boolean {
    this.loopAge += deltaTime;

    if (this.loopAge >= this.duration) {
      if (this.looping) {
        this.loopAge = this.loopAge % this.duration;

        return true;
      }
      this.executionState = EmitterExecutionState.Inactive;
    }

    return false;
  }

  handleCompletion (activeCount: number): void {
    if (this.executionState === EmitterExecutionState.Inactive && activeCount === 0) {
      this.executionState = EmitterExecutionState.Complete;
    }
  }

  isSpawningAllowed (): boolean {
    return this.executionState === EmitterExecutionState.Active;
  }

  reset (): void {
    this.executionState = EmitterExecutionState.Active;
    this.emissionStopped = false;
    this.emitterAge = 0;
    this.loopAge = 0;
  }
}
