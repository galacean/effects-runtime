import type { ProModule } from '../modules/module';
import type { ProModuleContext } from '../modules/module-context';
import { ProModuleStage } from '../modules/stage';
import { ProParameterStore } from '../parameters/parameter-store';
import { ProExecutionState } from '../types/execution-state';
import { ProRandomStream } from '../utils/random-stream';
import type { ProEmitterInstance } from './emitter-instance';

/**
 * 一个粒子 system 的运行时实例。
 *
 * 持有若干 emitter 与 system 级 parameter store。tick 顺序固定为：
 * systemUpdate → 每个 emitter 的 preTick/tick/postTick。
 *
 * 与 Niagara 的 FNiagaraSystemInstance 对应（但不包含 GPU dispatch、
 * world manager 注册等多余细节）。
 */
export class ProSystemInstance {
  readonly systemParameterStore = new ProParameterStore();
  readonly randomStream = new ProRandomStream(0x9E3779B9);

  emitters: ProEmitterInstance[] = [];
  modules: ProModule[] = [];

  age = 0;
  tickCount = 0;
  executionState: ProExecutionState = ProExecutionState.Active;

  addModule (module: ProModule): void {
    this.modules.push(module);
  }

  removeModule (module: ProModule): void {
    const idx = this.modules.indexOf(module);

    if (idx >= 0) {
      this.modules.splice(idx, 1);
    }
  }

  addEmitter (emitter: ProEmitterInstance): void {
    this.emitters.push(emitter);
  }

  removeEmitter (emitter: ProEmitterInstance): void {
    const idx = this.emitters.indexOf(emitter);

    if (idx >= 0) {
      emitter.reset(true);
      this.emitters.splice(idx, 1);
    }
  }

  reset (killExisting = true): void {
    this.age = 0;
    this.tickCount = 0;
    this.executionState = ProExecutionState.Active;
    this.systemParameterStore.reset();
    for (const emitter of this.emitters) {
      emitter.reset(killExisting);
    }
  }

  tick (deltaTime: number): void {
    if (this.executionState === ProExecutionState.Complete) {
      return;
    }
    if (this.executionState === ProExecutionState.InactiveClear) {
      for (const emitter of this.emitters) {
        emitter.setExecutionState(ProExecutionState.InactiveClear);
      }
      this.executionState = ProExecutionState.Inactive;
    }

    // 首帧执行 SystemSpawn
    if (this.tickCount === 0) {
      this.runSystemStage(ProModuleStage.SystemSpawn, deltaTime);
    }

    this.age += deltaTime;
    this.tickCount++;

    // 每帧执行 SystemUpdate
    this.runSystemStage(ProModuleStage.SystemUpdate, deltaTime);

    for (const emitter of this.emitters) {
      emitter.preTick();
    }
    for (const emitter of this.emitters) {
      emitter.tick(deltaTime);
    }

    // 所有 emitter 都 Complete → System 整体 Complete
    if (this.emitters.length > 0 && this.emitters.every(e => e.executionState === ProExecutionState.Complete)) {
      this.executionState = ProExecutionState.Complete;
    }
  }

  dispose (): void {
    for (const emitter of this.emitters) {
      emitter.reset(true);
    }
    this.emitters.length = 0;
    this.modules.length = 0;
  }

  /**
   * 跑 system 级 module。System stage 没有 emitter / dataBuffer 上下文，
   * 我们传入第一个 emitter 占位（system module 不应读 particle 数据）。
   */
  private runSystemStage (stage: ProModuleStage, deltaTime: number): void {
    if (this.modules.length === 0 || this.emitters.length === 0) {
      return;
    }
    const ctx: ProModuleContext = {
      deltaTime,
      systemInstance: this,
      emitterInstance: this.emitters[0],
      dataBuffer: null,
      firstInstance: 0,
      lastInstance: 0,
      randomStream: this.randomStream,
    };

    for (const module of this.modules) {
      if (module.enabled && module.stage === stage) {
        module.execute(ctx);
      }
    }
  }
}
