import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { ProDataBuffer } from '../data/data-buffer';
import type { ProDataSetLayout } from '../data/data-set-layout';
import { ProDataSet } from '../data/data-set';
import type { ProModule } from '../modules/module';
import type { ProModuleContext } from '../modules/module-context';
import { ProModuleStage } from '../modules/stage';
import { ProParameterStore } from '../parameters/parameter-store';
import { ProExecutionState } from '../types/execution-state';
import type { ProSpawnInfo } from '../types/spawn-info';
import { ProIdTable } from '../utils/id-table';
import { ProRandomStream } from '../utils/random-stream';
import { ProStandardAccessors } from '../builtin/standard-accessors';
import type { ProSystemInstance } from './system-instance';

export type ProSimulationSpace = 'local' | 'world';

/**
 * 一个 emitter 实例的运行时状态。
 *
 * 一个 System 可以有多个 Emitter；每个 Emitter 各自维护 DataSet、
 * ParameterStore、模块列表、随机流、SpawnInfo 列表与执行状态。
 *
 * Tick 的整体流程参考 Niagara 的 FNiagaraEmitterInstanceImpl::Tick：
 *   1. handleCompletion
 *   2. runStage('emitterUpdate') 计算 SpawnInfo
 *   3. beginSimulate + allocate
 *   4. runStage('particleUpdate') 推进现有粒子
 *   5. runStage('particleSpawn')   初始化新粒子
 *   6. endSimulate
 *   7. postTick (compaction 已在 module 内通过 killInstance 完成)
 */
export class ProEmitterInstance {
  readonly parentSystemInstance: ProSystemInstance;
  readonly parameterStore = new ProParameterStore();
  readonly idTable = new ProIdTable();
  readonly randomStream: ProRandomStream;

  particleDataSet: ProDataSet | null = null;

  modules: ProModule[] = [];
  spawnInfos: ProSpawnInfo[] = [];

  emitterAge = 0;
  tickCount = 0;
  totalSpawnedParticles = 0;
  executionState: ProExecutionState = ProExecutionState.Active;

  maxInstanceCount = 1024;

  // 生命周期 — 由 EmitterPropertiesModule (EmitterSpawn 阶段) 写入
  // duration <= 0 视为永久循环；loopBehavior='infinite' 时不限制循环次数
  duration = 0;
  loopBehavior: 'infinite' | 'once' | 'multiple' = 'infinite';
  loopCount = 1;
  loopDelay = 0;

  currentLoop = 0;
  loopAge = 0;
  delayRemaining = 0;

  // Simulation Space — local：粒子位置在 emitter 局部空间，渲染时乘 worldMatrix；
  // world：粒子位置在世界空间，spawn 时烘焙 transform，渲染时用 identity
  simulationSpace: ProSimulationSpace = 'local';

  // 由 ProParticleSystemComponent 在 tick 前推入；world 模式 spawn 烘焙用
  worldMatrix: Matrix4 = new Matrix4().identity();

  // Warmup — 首次 tick 时按 warmupTickDelta 拆成多 sub-tick 跑完 warmupTime
  warmupTime = 0;
  warmupTickDelta = 1 / 30;
  private warmupConsumed = false;

  // 由 EmitterPropertiesModule 写入；变化时重置 randomStream
  private appliedRandomSeed: number | null = null;

  constructor (parentSystemInstance: ProSystemInstance, randomSeed: number) {
    this.parentSystemInstance = parentSystemInstance;
    this.randomStream = new ProRandomStream(randomSeed);
  }

  initParticleDataSet (layout: ProDataSetLayout): void {
    this.particleDataSet = new ProDataSet(layout);
    this.particleDataSet.init();
  }

  addModule (module: ProModule): void {
    this.modules.push(module);
  }

  removeModule (module: ProModule): void {
    const idx = this.modules.indexOf(module);

    if (idx >= 0) {
      this.modules.splice(idx, 1);
    }
  }

  reorderModule (module: ProModule, newIndex: number): void {
    const oldIdx = this.modules.indexOf(module);

    if (oldIdx < 0) {
      return;
    }
    this.modules.splice(oldIdx, 1);
    this.modules.splice(Math.min(newIndex, this.modules.length), 0, module);
  }

  clearModules (): void {
    this.modules.length = 0;
  }

  reset (killExisting = true): void {
    if (killExisting && this.particleDataSet) {
      this.particleDataSet.resetBuffers();
      this.particleDataSet.init();
    }
    this.idTable.reset();
    this.parameterStore.reset();
    this.emitterAge = 0;
    this.tickCount = 0;
    this.totalSpawnedParticles = 0;
    this.executionState = ProExecutionState.Active;
    this.spawnInfos.length = 0;
    this.currentLoop = 0;
    this.loopAge = 0;
    this.delayRemaining = 0;
    this.warmupConsumed = false;
    this.appliedRandomSeed = null;
  }

  /**
   * 由 EmitterPropertiesModule 调用。同一个种子只 reseed 一次，避免每帧重置。
   */
  applyRandomSeed (seed: number): void {
    if (this.appliedRandomSeed === seed) {
      return;
    }
    this.appliedRandomSeed = seed;
    this.randomStream.reseed(seed);
  }

  preTick (): void {
    // TODO Phase 2: rapid iteration parameter binding refresh
  }

  tick (deltaTime: number): void {
    if (this.handleCompletion()) {
      return;
    }

    // 首帧执行 EmitterSpawn — 让 EmitterPropertiesModule 写入 duration/loop/capacity 等
    if (this.tickCount === 0) {
      this.runStage(ProModuleStage.EmitterSpawn, deltaTime, null, 0, 0);

      // EmitterSpawn 之后才知道 warmupTime，按 warmupTickDelta 拆分预跑
      if (!this.warmupConsumed && this.warmupTime > 0) {
        this.warmupConsumed = true;
        const sub = Math.max(this.warmupTickDelta, 1 / 240);
        let remaining = this.warmupTime;

        while (remaining > 1e-6) {
          const dt = Math.min(sub, remaining);

          this.tickInner(dt);
          remaining -= dt;
          if (this.executionState === ProExecutionState.Complete) {
            return;
          }
        }
      }
    }

    this.tickInner(deltaTime);
  }

  private tickInner (deltaTime: number): void {
    this.emitterAge += deltaTime;
    this.tickCount++;

    if (this.executionState === ProExecutionState.InactiveClear) {
      this.particleDataSet?.resetBuffers();
      this.particleDataSet?.init();
      this.executionState = ProExecutionState.Inactive;

      return;
    }

    // 推进 loop 状态机；可能把 executionState 切到 Inactive
    this.advanceLoopState(deltaTime);

    if (!this.particleDataSet) {
      return;
    }

    // 1. 跑 emitterUpdate 让 module 写入 SpawnInfo / 控制状态
    this.spawnInfos.length = 0;
    this.runStage(ProModuleStage.EmitterUpdate, deltaTime, null, 0, 0);

    const allowSpawn = this.executionState === ProExecutionState.Active;
    let spawnTotal = 0;

    if (allowSpawn) {
      for (const info of this.spawnInfos) {
        if (info.count > 0) {
          spawnTotal += info.count;
        }
      }
    }

    const current = this.particleDataSet.getCurrentData();
    const origNum = current ? current.numInstances : 0;
    const required = Math.min(origNum + spawnTotal, this.maxInstanceCount);

    const dest = this.particleDataSet.beginSimulate(true);

    this.particleDataSet.allocate(required, false);

    // 2. 把现有粒子从 current 拷贝到 destination，再跑 particleUpdate
    if (current && origNum > 0) {
      this.copyExistingParticles(current, dest, origNum);
      dest.setNumInstances(origNum);
      this.runStage(ProModuleStage.ParticleUpdate, deltaTime, dest, 0, dest.numInstances);
    }

    // 3. 在 destination 末尾追加新粒子
    if (spawnTotal > 0) {
      const spawnStart = dest.numInstances;
      const spawnEnd = Math.min(spawnStart + spawnTotal, this.maxInstanceCount);
      const actualSpawn = spawnEnd - spawnStart;

      if (actualSpawn > 0) {
        dest.setNumInstances(spawnEnd);
        dest.setNumSpawnedInstances(actualSpawn);
        this.runStage(ProModuleStage.ParticleSpawn, deltaTime, dest, spawnStart, spawnEnd);
        this.totalSpawnedParticles += actualSpawn;

        // World space：把新粒子的 position/velocity 从局部空间烘焙到世界空间
        if (this.simulationSpace === 'world') {
          this.bakeNewParticlesToWorld(dest, spawnStart, spawnEnd);
        }
      }
    }

    this.particleDataSet.endSimulate(true);
    this.postTick();
  }

  private bakeNewParticlesToWorld (dest: ProDataBuffer, first: number, last: number): void {
    const layout = this.particleDataSet?.layout;

    if (!layout) {
      return;
    }
    const a = new ProStandardAccessors(layout);
    const m = this.worldMatrix.elements;
    const tmp: [number, number, number] = [0, 0, 0];

    for (let i = first; i < last; i++) {
      a.position.get(dest, i, tmp);
      const x = tmp[0], y = tmp[1], z = tmp[2];

      a.position.set(
        dest, i,
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      );
      a.velocity.get(dest, i, tmp);
      const vx = tmp[0], vy = tmp[1], vz = tmp[2];

      a.velocity.set(
        dest, i,
        m[0] * vx + m[4] * vy + m[8] * vz,
        m[1] * vx + m[5] * vy + m[9] * vz,
        m[2] * vx + m[6] * vy + m[10] * vz,
      );
    }
  }

  postTick (): void {
    // Inactive 且粒子已耗尽 → Complete
    if (this.executionState === ProExecutionState.Inactive && this.isParticleDrained()) {
      this.executionState = ProExecutionState.Complete;
    }
  }

  setExecutionState (state: ProExecutionState): void {
    this.executionState = state;
  }

  /**
   * 当前 buffer 中是否已经没有活粒子。
   */
  isParticleDrained (): boolean {
    const buf = this.particleDataSet?.getCurrentData();

    return !buf || buf.numInstances === 0;
  }

  private handleCompletion (force = false): boolean {
    if (this.executionState === ProExecutionState.Complete || force) {
      this.particleDataSet?.resetBuffers();

      return true;
    }

    return false;
  }

  /**
   * 推进 loop 状态。duration<=0 或 loopBehavior='infinite' 时永不结束；
   * once 跑一次后转 Inactive；multiple 跑 loopCount 次。
   *
   * loopDelay 期间也算 Inactive（不 spawn）。
   */
  private advanceLoopState (deltaTime: number): void {
    if (this.executionState !== ProExecutionState.Active &&
        this.executionState !== ProExecutionState.Inactive) {
      return;
    }
    if (this.duration <= 0 || this.loopBehavior === 'infinite') {
      return;
    }

    if (this.delayRemaining > 0) {
      this.delayRemaining -= deltaTime;
      if (this.delayRemaining > 0) {
        return;
      }
      // 延迟结束 → 启动下一轮
      this.loopAge = -this.delayRemaining;
      this.delayRemaining = 0;
      this.executionState = ProExecutionState.Active;

      return;
    }

    this.loopAge += deltaTime;
    if (this.loopAge < this.duration) {
      return;
    }

    // 本轮结束
    this.currentLoop++;
    const maxLoops = this.loopBehavior === 'once' ? 1 : Math.max(1, Math.floor(this.loopCount));

    if (this.currentLoop >= maxLoops) {
      // 所有循环跑完 → Inactive，等粒子耗尽后 postTick 转 Complete
      this.executionState = ProExecutionState.Inactive;

      return;
    }

    // 还有循环，进入 delay 期
    if (this.loopDelay > 0) {
      this.delayRemaining = this.loopDelay;
      this.executionState = ProExecutionState.Inactive;
    } else {
      this.loopAge -= this.duration;
    }
  }

  private runStage (
    stage: ProModuleStage,
    deltaTime: number,
    dataBuffer: ProDataBuffer | null,
    firstInstance: number,
    lastInstance: number,
  ): void {
    const ctx: ProModuleContext = {
      deltaTime,
      systemInstance: this.parentSystemInstance,
      emitterInstance: this,
      dataBuffer,
      firstInstance,
      lastInstance,
      randomStream: this.randomStream,
    };

    for (const module of this.modules) {
      if (module.enabled && module.stage === stage) {
        module.execute(ctx);
      }
    }
  }

  private copyExistingParticles (
    src: ProDataBuffer,
    dst: ProDataBuffer,
    count: number,
  ): void {
    const layout = this.particleDataSet!.layout;
    const srcFloat = src.getFloatData();
    const dstFloat = dst.getFloatData();
    const srcFloatStride = src.floatStride;
    const dstFloatStride = dst.floatStride;

    for (let c = 0; c < layout.totalFloatComponents; c++) {
      const srcBase = c * srcFloatStride;
      const dstBase = c * dstFloatStride;

      for (let i = 0; i < count; i++) {
        dstFloat[dstBase + i] = srcFloat[srcBase + i];
      }
    }
    const srcInt32 = src.getInt32Data();
    const dstInt32 = dst.getInt32Data();
    const srcInt32Stride = src.int32Stride;
    const dstInt32Stride = dst.int32Stride;

    for (let c = 0; c < layout.totalInt32Components; c++) {
      const srcBase = c * srcInt32Stride;
      const dstBase = c * dstInt32Stride;

      for (let i = 0; i < count; i++) {
        dstInt32[dstBase + i] = srcInt32[srcBase + i];
      }
    }
  }
}
