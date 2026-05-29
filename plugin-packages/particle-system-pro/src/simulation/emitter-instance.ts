import { math } from '@galacean/effects';
import type { ProDataBuffer } from '../data/data-buffer';
import { ProDataSetLayout } from '../data/data-set-layout';
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
import type { ProSpawnBatchContext } from '../modules/module-context';

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
 *   7. postTick（延迟 compact / 完成态收尾）
 */
export class ProEmitterInstance {
  readonly parentSystemInstance: ProSystemInstance;
  readonly parameterStore = new ProParameterStore();
  readonly idTable = new ProIdTable();
  readonly randomStream: ProRandomStream;

  /**
   * Emitter 名字。System 内必须唯一才能被 cross-emitter 模块（如
   * SampleParticlesFromOtherEmitter）按名字解析。空字符串视为匿名，无法被引用。
   */
  name = '';

  particleDataSet: ProDataSet | null = null;

  /**
   * 缓存的 ProStandardAccessors 实例，在 rebuildLayout() 时刷新。
   * 避免 captureInitialPositions / savePreviousPositions / bakeNewParticlesToWorld
   * 等每帧调用的方法每次都 new ProStandardAccessors。
   */
  private cachedAccessors: ProStandardAccessors | null = null;

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
  recalculateDurationEachLoop = false;
  recalculateDelayEachLoop = false;
  delayFirstLoopOnly = false;
  inactiveResponse: 'complete' | 'kill' = 'complete';

  durationSampler: (() => number) | null = null;
  delaySampler: (() => number) | null = null;

  currentLoop = 0;
  loopAge = 0;
  delayRemaining = 0;
  /** 进入 delay 时缓存的上轮 overrun（loopAge - duration）；delay 结束后转入新 loopAge */
  private pendingLoopOverrun = 0;

  // Simulation Space — local：粒子位置在 emitter 局部空间，渲染时乘 worldMatrix；
  // world：粒子位置在世界空间，spawn 时烘焙 transform，渲染时用 identity
  simulationSpace: ProSimulationSpace = 'local';

  // 由 ProParticleSystemComponent 在 tick 前推入；world 模式 spawn 烘焙用
  worldMatrix: math.Matrix4 = new math.Matrix4().identity();

  // 发射器自身在世界空间的平移速度（component 每帧从 worldMatrix 平移增量算出）。
  // InheritVelocity 模块据此让 world-space 新粒子继承发射器运动。首帧 / 静止时为 0。
  emitterVelocity: [number, number, number] = [0, 0, 0];

  // Warmup — 首次 tick 时按 warmupTickDelta 拆成多 sub-tick 跑完 warmupTime
  warmupTime = 0;
  warmupTickDelta = 1 / 30;
  private warmupConsumed = false;

  // Bounds — 逐帧从活跃粒子计算的局部空间 AABB
  boundsMin: [number, number, number] = [0, 0, 0];
  boundsMax: [number, number, number] = [0, 0, 0];
  boundsValid = false;
  fixedBounds: [[number, number, number], [number, number, number]] | null = null;

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

  /**
   * 汇总所有模块的变量声明，构建新的 DataSetLayout 并重新初始化 DataSet。
   *
   * 对齐 UE Niagara stateful 编译器的 GatherCompiledParticleAttributes：
   * DataSet Variables = InstanceRead ∪ InstanceWrite（读和写取并集）。
   *
   * 注意：
   * - 会创建全新的 DataSet，清空所有存活粒子（对齐 UE Recompile 行为）
   * - 所有模块无论 enabled 与否都参与变量声明（disable 只影响 execute）
   * - 需要在所有 addModule 调用完成后手动调用
   */
  rebuildLayout (): void {
    const variableMap = new Map<string, import('../types/variable').ProVariable>();

    for (const module of this.modules) {
      for (const decl of module.declareVariables()) {
        variableMap.set(decl.variable.name, decl.variable);
      }
    }
    const layout = new ProDataSetLayout([...variableMap.values()]);

    this.initParticleDataSet(layout);
    this.cachedAccessors = new ProStandardAccessors(layout);
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
    this.pendingLoopOverrun = 0;
    this.warmupConsumed = false;
    this.appliedRandomSeed = null;
    this.boundsValid = false;
    this.emitterVelocity[0] = 0;
    this.emitterVelocity[1] = 0;
    this.emitterVelocity[2] = 0;
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
    const keptExisting = Math.min(origNum, this.maxInstanceCount);

    // 2. 先跑 ParticleUpdate + compact，让本帧死亡的粒子释放槽位，
    //    再计算 availableSpawnSlots——否则稳态下 rate×lifetime ≈ maxCount 时
    //    死粒子占着槽位导致新粒子被错误 clip
    const dest = this.particleDataSet.beginSimulate(true);

    this.particleDataSet.allocate(keptExisting + spawnTotal, false);

    let survivedCount = 0;

    if (current && keptExisting > 0) {
      this.copyExistingParticles(current, dest, keptExisting);
      dest.setNumInstances(keptExisting);
      this.savePreviousPositions(dest, keptExisting);
      this.runStage(ProModuleStage.ParticleUpdate, deltaTime, dest, 0, dest.numInstances);
      dest.compactKilledInstances(0);
      survivedCount = dest.numInstances;
    }

    // 根据 compact 后实际存活数计算可用 spawn 槽位
    const availableSpawnSlots = Math.max(0, this.maxInstanceCount - survivedCount);

    if (allowSpawn && spawnTotal > availableSpawnSlots) {
      let remainingSpawnSlots = availableSpawnSlots;

      for (const info of this.spawnInfos) {
        if (info.count <= 0) {
          continue;
        }
        const allowedCount = Math.min(info.count, remainingSpawnSlots);

        info.count = allowedCount;
        if (info.sourceAssignment) {
          info.sourceAssignment = {
            ...info.sourceAssignment,
            count: allowedCount,
          };
        }
        remainingSpawnSlots -= allowedCount;
      }

      spawnTotal = availableSpawnSlots;
    }

    // 3. 在 destination 末尾追加新粒子
    if (spawnTotal > 0) {
      const spawnStart = dest.numInstances;
      const spawnEnd = Math.min(spawnStart + spawnTotal, this.maxInstanceCount);
      const actualSpawn = spawnEnd - spawnStart;

      if (actualSpawn > 0) {
        dest.setNumInstances(spawnEnd);
        dest.setNumSpawnedInstances(actualSpawn);

        // 按 spawn-info 分段跑 ParticleSpawn — 每段 firstInstance/lastInstance 精确对齐
        // 该 info 的粒子范围。模块 (InitializeParticle / ShapeLocation 等) 在循环里能
        // 看到正确的 [first, last) 区间，不会混批
        let cursor = spawnStart;

        for (const info of this.spawnInfos) {
          if (info.count <= 0 || cursor >= spawnEnd) {
            continue;
          }
          const batchEnd = Math.min(cursor + info.count, spawnEnd);
          const batchCount = batchEnd - cursor;
          const sourceAssignment = info.sourceAssignment
            ? (info.sourceAssignment.count === batchCount
              ? info.sourceAssignment
              : { ...info.sourceAssignment, count: batchCount })
            : null;

          this.runStage(ProModuleStage.ParticleSpawn, deltaTime, dest, cursor, batchEnd, {
            execCountInBatch: batchCount,
            spawnIntervalDt: info.intervalDt,
            interpSpawnStartDt: info.interpStartDt,
            sourceAssignment,
          });
          cursor = batchEnd;
        }
        // 若 spawnInfos 没覆盖完（极少见 — info.count 与 spawnTotal 不一致），剩余部分
        // 用一次性 spawn 兜底，避免漏初始化导致 NaN
        if (cursor < spawnEnd) {
          this.runStage(ProModuleStage.ParticleSpawn, deltaTime, dest, cursor, spawnEnd, {
            execCountInBatch: spawnEnd - cursor,
            spawnIntervalDt: 0,
            interpSpawnStartDt: 0,
            sourceAssignment: null,
          });
        }
        this.totalSpawnedParticles += actualSpawn;

        // World space：把新粒子的 position/velocity 从局部空间烘焙到世界空间
        if (this.simulationSpace === 'world') {
          this.bakeNewParticlesToWorld(dest, spawnStart, spawnEnd);
        }

        // 所有 ParticleSpawn 模块跑完之后 capture InitialPosition — 这时 position 已
        // 被 ShapeLocation / Sample 等模块改成最终值。后续 RotateAroundPoint 等用它
        // 当"轨道基准位置"
        this.captureInitialPositions(dest, spawnStart, spawnEnd);

        // 子帧插值 spawn：把新粒子按 spawnInfo 顺序"复活"到本帧不同子时刻，每个粒子
        // 用自己的 subFrameDt 跑一次 ParticleUpdate。subFrameDt = 0 时仍跑（让 over-life
        // 曲线在 age=0 评估、UpdateAge / SolveForces 内部有 dt<=0 防护）。
        // 对应 UE Niagara interpolated spawn —— SpawnRate 高频下粒子才不会全卡在原点
        this.runInterpolatedSpawnUpdate(dest, spawnStart, spawnEnd);
        dest.compactKilledInstances(spawnStart);
        dest.setNumSpawnedInstances(dest.numInstances - spawnStart);
      }
    }

    this.particleDataSet.endSimulate(true);
    // postTick 由 SystemInstance 在所有 emitter tick 完成之后统一调用 —
    // 保证 cross-emitter sample 模块（在下一帧 ParticleUpdate 跑）看到一致的快照
  }

  /**
   * 所有 ParticleSpawn 模块跑完之后调用，把当前 position 快照到 InitialPosition。
   * 给 RotateAroundPoint 等需要"绝对位置 = 基准 + 偏移"语义的模块用。
   */
  private captureInitialPositions (dest: ProDataBuffer, first: number, last: number): void {
    const a = this.cachedAccessors;

    if (!a) {
      return;
    }
    const tmp: [number, number, number] = [0, 0, 0];

    for (let i = first; i < last; i++) {
      a.position.get(dest, i, tmp);
      a.initialPosition.set(dest, i, tmp[0], tmp[1], tmp[2]);
    }
  }

  /**
   * 子帧插值 spawn 的 update 调度。
   *
   * SpawnRate 高 rate 时同一帧会 spawn 多个粒子；理想情况下它们应该分布在 [t-dt, t]
   * 子帧上，而不是全部在帧末 t 时刻同位置。
   *
   * 我们按 spawnInfo 顺序：每个 info 的粒子按 intervalDt 等距分布在帧内，每个粒子
   * 的 subFrameDt = (batchEnd - 1 - i) * intervalDt（i=batchStart 是最先 spawn 的
   * 最老粒子，subFrameDt 最大）。对它跑一次 ParticleUpdate(subFrameDt)，让
   * SolveForces 推进 position、UpdateAge 写入 age，curve 在正确 normalizedAge 上评估。
   *
   * 单粒子粒度的 runStage 调用代价：modules 数 × spawn 数 — 对典型 batch (10-100) 可接受。
   * SpawnBurst 的 intervalDt=0 → 所有粒子 subFrameDt=0，退化为一次 batch 调用
   */
  private runInterpolatedSpawnUpdate (
    dest: ProDataBuffer,
    spawnStart: number,
    spawnEnd: number,
  ): void {
    let cursor = spawnStart;

    for (const info of this.spawnInfos) {
      if (info.count <= 0 || cursor >= spawnEnd) {
        continue;
      }
      const batchEnd = Math.min(cursor + info.count, spawnEnd);
      const interval = info.intervalDt;
      const interpStart = info.interpStartDt;

      if (interval <= 0 && interpStart <= 0) {
        // Burst：所有粒子 subFrameDt=0，一次 batch 跑完
        this.runStage(ProModuleStage.ParticleUpdate, 0, dest, cursor, batchEnd);
      } else {
        // Interpolated spawn：按 SpawnInfo 的 interpStartDt / intervalDt 统一分配子帧时间
        for (let i = cursor; i < batchEnd; i++) {
          const subDt = interpStart + (batchEnd - 1 - i) * interval;

          this.runStage(ProModuleStage.ParticleUpdate, subDt, dest, i, i + 1);
        }
      }
      cursor = batchEnd;
    }
    if (cursor < spawnEnd) {
      this.runStage(ProModuleStage.ParticleUpdate, 0, dest, cursor, spawnEnd);
    }
  }

  private savePreviousPositions (dest: ProDataBuffer, count: number): void {
    const a = this.cachedAccessors;

    if (!a) {
      return;
    }
    const tmp: [number, number, number] = [0, 0, 0];

    for (let i = 0; i < count; i++) {
      a.position.get(dest, i, tmp);
      a.previousPosition.set(dest, i, tmp[0], tmp[1], tmp[2]);
    }
  }

  private bakeNewParticlesToWorld (dest: ProDataBuffer, first: number, last: number): void {
    const a = this.cachedAccessors;

    if (!a) {
      return;
    }
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
    // Inactive 且粒子已耗尽 → Complete。
    // 但 loop delay 期间（delayRemaining > 0）emitter 也是 Inactive，只是在等下一轮，
    // 此时即使粒子耗尽也不能 Complete——否则 duration < lifetime + loopDelay 的循环
    // emitter（如脉冲冲击波）粒子在 delay 内死光就被误判结束，"闪一下就没了"。
    if (this.executionState === ProExecutionState.Inactive &&
        this.delayRemaining <= 0 &&
        this.isParticleDrained()) {
      this.executionState = ProExecutionState.Complete;
    }
    this.computeBounds();
  }

  computeBounds (): void {
    if (this.fixedBounds) {
      this.boundsMin[0] = this.fixedBounds[0][0];
      this.boundsMin[1] = this.fixedBounds[0][1];
      this.boundsMin[2] = this.fixedBounds[0][2];
      this.boundsMax[0] = this.fixedBounds[1][0];
      this.boundsMax[1] = this.fixedBounds[1][1];
      this.boundsMax[2] = this.fixedBounds[1][2];
      this.boundsValid = true;

      return;
    }
    const dataBuffer = this.particleDataSet?.getCurrentData();

    if (!dataBuffer || dataBuffer.numInstances === 0) {
      this.boundsValid = false;

      return;
    }
    const a = this.cachedAccessors;

    if (!a) {
      this.boundsValid = false;

      return;
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const tmp: [number, number, number] = [0, 0, 0];
    const tmpSize: [number, number] = [0, 0];

    for (let i = 0; i < dataBuffer.numInstances; i++) {
      a.position.get(dataBuffer, i, tmp);
      a.size.get(dataBuffer, i, tmpSize);
      const halfSize = Math.max(tmpSize[0], tmpSize[1]) * 0.5;

      minX = Math.min(minX, tmp[0] - halfSize);
      minY = Math.min(minY, tmp[1] - halfSize);
      minZ = Math.min(minZ, tmp[2] - halfSize);
      maxX = Math.max(maxX, tmp[0] + halfSize);
      maxY = Math.max(maxY, tmp[1] + halfSize);
      maxZ = Math.max(maxZ, tmp[2] + halfSize);
    }
    this.boundsMin[0] = minX; this.boundsMin[1] = minY; this.boundsMin[2] = minZ;
    this.boundsMax[0] = maxX; this.boundsMax[1] = maxY; this.boundsMax[2] = maxZ;
    this.boundsValid = true;
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
   *
   * **大 dt 处理**：用 do-while 而不是单次 if — tab 切换后单帧 dt > 2*duration
   * 时也能正确推进 currentLoop（旧实现只 +1，loopAge 仍 > duration 形成 latent
   * 状态，下一帧 spawn 窗口持续漂移）。
   *
   * **loopDelay overrun**：进入 delay 之前把 (loopAge - duration) 缓存到
   * pendingLoopOverrun，delay 结束后 loopAge = pendingLoopOverrun - delayRemaining，
   * 让上轮过头部分平移到新 loop 起点，避免节奏漂移
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
      // 延迟结束 → 把上轮 overrun 平移过来，再叠加 delay 用尽后的剩余 dt
      // (-delayRemaining 此时 ≥ 0：是 dt 用完 delay 之后多出来的时间)
      this.loopAge = this.pendingLoopOverrun + (-this.delayRemaining);
      this.pendingLoopOverrun = 0;
      this.delayRemaining = 0;
      this.executionState = ProExecutionState.Active;
      // 不 return — 让 fall-through 处理"delay 后还有 deltaTime 又跨过 duration"
    } else {
      this.loopAge += deltaTime;
    }

    const maxLoops = this.loopBehavior === 'once' ? 1 : Math.max(1, Math.floor(this.loopCount));

    // 大 dt 下可能跨多个 loop：do-while 每次扣一个 duration / 进入 delay，直到 loopAge < duration
    while (this.loopAge >= this.duration) {
      this.currentLoop++;
      if (this.currentLoop >= maxLoops) {
        this.executionState = this.inactiveResponse === 'kill'
          ? ProExecutionState.InactiveClear
          : ProExecutionState.Inactive;

        return;
      }

      // 每次进入新 loop 时可重新采样 duration/delay
      if (this.recalculateDurationEachLoop && this.durationSampler) {
        this.loopAge -= this.duration;
        this.duration = this.durationSampler();
      } else {
        this.loopAge -= this.duration;
      }
      if (this.recalculateDelayEachLoop && this.delaySampler) {
        this.loopDelay = this.delaySampler();
      }

      const shouldDelay = this.loopDelay > 0 &&
        !(this.delayFirstLoopOnly && this.currentLoop > 1);

      if (shouldDelay) {
        this.pendingLoopOverrun = this.loopAge;
        this.delayRemaining = this.loopDelay;
        this.executionState = ProExecutionState.Inactive;

        return;
      }
    }
  }

  private runStage (
    stage: ProModuleStage,
    deltaTime: number,
    dataBuffer: ProDataBuffer | null,
    firstInstance: number,
    lastInstance: number,
    spawnBatch: ProSpawnBatchContext | null = null,
  ): void {
    const ctx: ProModuleContext = {
      deltaTime,
      systemInstance: this.parentSystemInstance,
      emitterInstance: this,
      dataBuffer,
      firstInstance,
      lastInstance,
      spawnBatch,
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
