import type { Ray } from '@galacean/effects-math/es/core/index';
import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { ShapeGeneratorOptions } from '../../../shape';
import type { ParticleDataBuffer } from '../core/particle-data-buffer';
import { ParticleDataBuffer as ParticleDataBufferImpl } from '../core/particle-data-buffer';
import { ParticleModuleStage, isSourceDependent } from '../core/particle-module';
import type { ParticleModuleContext, SpawnInfo } from '../core/particle-module';
import type { ParticleModule } from '../core/particle-module';
import { AllocationMode, AllocationPolicy } from '../core/allocation-mode';
import type { ParsedModuleData, SpriteModuleData, TrailModuleData } from '../system/parse-spec';
import { BurstSpawnModule } from '../modules/burst-spawn-module';
import { ForceTargetModule } from '../modules/force-target-module';
import { InitializeParticleModule } from '../modules/initialize-particle-module';
import { ScaleColorModule } from '../modules/scale-color-module';
import { ScaleSizeModule } from '../modules/scale-size-module';
import { GravityForceModule } from '../modules/gravity-force-module';
import { SolveForcesAndVelocityModule } from '../modules/solve-forces-and-velocity-module';
import { OrbitalAndLinearMoveModule } from '../modules/orbital-and-linear-move-module';
import { SolveRotationModule } from '../modules/solve-rotation-module';
import { SpawnRateModule } from '../modules/spawn-rate-module';
import { UpdateAgeModule } from '../modules/update-age-module';
import { SpawnPerSourceParticleModule } from '../modules/spawn-per-source-module';
import { SampleFromSourceModule } from '../modules/sample-from-source-module';
import { KillBySourceModule } from '../modules/kill-by-source-module';
import { EmitterState, EmitterExecutionState } from './emitter-state';

export type EmitterData = {
  maxCount: number,
  looping: boolean,
  particleFollowParent: boolean,
  alignSpeedDirection: boolean,
  modules: ParsedModuleData,
  /** 分配策略；不传则默认 FixedCount，等价旧固定上限行为 */
  allocationMode?: AllocationMode,
  /** 预分配容量；不传则取 maxCount */
  preAllocationCount?: number,
};

export class ParticleEmitter {
  // --- Lifecycle state machine ---
  readonly state = new EmitterState();

  // --- Config (set during setup, immutable after) ---
  maxCount = 0;
  particleFollowParent = false;
  private alignSpeedDirection = false;

  // --- Per-frame external input ---
  worldMatrix: Matrix4 = Matrix4.IDENTITY;

  // --- Spawn state (reset on fullReset / loop) ---
  totalSpawnedParticles = 0;
  uniqueIndexOffset = 0;
  spawnFraction = 1;
  spawnInfos: SpawnInfo[] = [];

  // --- Query state ---
  lastRaycastHitIndex = -1;

  // --- Modules ---
  private modules: ParticleModule[] = [];

  // --- Allocation ---
  private policy = new AllocationPolicy({
    mode: AllocationMode.FixedCount,
    preAllocationCount: 0,
  });

  // --- Internal refs (set during setup) ---
  private _dataBuffer: ParticleDataBuffer;

  get dataBuffer (): ParticleDataBuffer {
    return this._dataBuffer;
  }

  fromJSON (data: EmitterData): void {
    this.maxCount = data.maxCount;
    this.state.looping = data.looping;
    this.particleFollowParent = data.particleFollowParent;
    this.alignSpeedDirection = data.alignSpeedDirection;
    this.policy = new AllocationPolicy({
      mode: data.allocationMode ?? AllocationMode.FixedCount,
      preAllocationCount: data.preAllocationCount ?? data.maxCount,
    });
    this._dataBuffer = new ParticleDataBufferImpl(data.maxCount);
    this.modules = this.buildModules(data.modules);
  }

  /**
   * 绑定 source emitter，解析 trail 模块的跨 emitter 依赖。
   *
   * 跨 emitter 引用在构造之后由这一独立的 binding resolve 步骤注入。
   */
  setSource (source: ParticleEmitter): void {
    for (const module of this.modules) {
      if (isSourceDependent(module)) {
        module.setSource(source);
      }
    }
  }

  private buildModules (data: ParsedModuleData): ParticleModule[] {
    return data.kind === 'trail' ? this.buildTrailModules(data) : this.buildSpriteModules(data);
  }

  private buildTrailModules (data: TrailModuleData): ParticleModule[] {
    const spawnModule = new SpawnPerSourceParticleModule();

    spawnModule.fromJSON(data.spawnPerSource);

    const sampleModule = new SampleFromSourceModule(spawnModule);

    sampleModule.fromJSON(data.sampleFromSource);

    // 顺序：updateAge → killBySource（particleUpdate 阶段）。ribbon 长度由 trail 粒子
    // lifetime 自然回收控制；点数密度由渲染侧 MinSegmentLength 抽取控制。
    return [spawnModule, sampleModule, new UpdateAgeModule(), new KillBySourceModule(spawnModule)];
  }

  private buildSpriteModules (data: SpriteModuleData): ParticleModule[] {
    const modules: ParticleModule[] = [];

    if (data.spawnRate) {
      const spawnRate = new SpawnRateModule();

      spawnRate.fromJSON(data.spawnRate);
      modules.push(spawnRate);
    }

    const burst = new BurstSpawnModule();

    burst.fromJSON(data.burst);

    const init = new InitializeParticleModule();

    init.fromJSON(data.initialize);

    const gravityForce = new GravityForceModule();

    gravityForce.fromJSON(data.gravityForce);

    const solveForcesAndVelocity = new SolveForcesAndVelocityModule();

    solveForcesAndVelocity.fromJSON(data.solveForcesAndVelocity);

    const solveRotation = new SolveRotationModule();

    solveRotation.fromJSON(data.solveRotation);

    const orbitalAndLinearMove = new OrbitalAndLinearMoveModule();

    orbitalAndLinearMove.fromJSON(data.orbitalAndLinearMove);

    modules.push(burst, init, new UpdateAgeModule(), gravityForce, solveForcesAndVelocity, solveRotation, orbitalAndLinearMove);

    if (data.forceTarget) {
      const forceTarget = new ForceTargetModule();

      forceTarget.fromJSON(data.forceTarget);
      modules.push(forceTarget);
    }

    const scaleSize = new ScaleSizeModule();

    scaleSize.fromJSON(data.scaleSize);

    const scaleColor = new ScaleColorModule();

    scaleColor.fromJSON(data.scaleColor);
    modules.push(scaleSize, scaleColor);

    return modules;
  }

  fullReset (): void {
    this.state.reset();
    this.totalSpawnedParticles = 0;
    this.spawnFraction = 1;
    this.uniqueIndexOffset = 0;
    this.spawnInfos.length = 0;
    this._dataBuffer?.clear();
  }

  runStage (stage: ParticleModuleStage, ctx: ParticleModuleContext): void {
    for (const module of this.modules) {
      if (module.enabled && module.stage === stage) {
        module.execute(ctx);
      }
    }
  }

  // ========================
  // Tick
  // ========================

  get timePassed (): number {
    return this.state.timePassed;
  }

  tick (delta: number): void {
    const dt = delta / 1000;

    this.state.emitterAge += dt;

    if (this.state.executionState === EmitterExecutionState.Complete) {
      return;
    }

    // 1. advance loop state machine
    const looped = this.state.advance(dt);

    if (looped) {
      this.spawnFraction = 1;
    }

    // 2. particleUpdate (existing particles)。模块在此将自然死亡 / 主动击杀的
    //    粒子标记为 alive[i] = 0；trail 的 ribbon 长度裁剪也作为 module 在此完成
    if (this._dataBuffer.numInstances > 0) {
      const ctx = this.buildModuleContext(dt);

      this.runStage(ParticleModuleStage.ParticleUpdate, ctx);
    }

    // 3. compact dead particles（swap-copy 压缩，使 [0, numInstances) 保持紧凑）
    this._dataBuffer.compactDead();

    // 4. spawn (only if state allows)
    if (this.state.isSpawningAllowed()) {
      this.doSpawn(dt);
    }

    // 5. handle completion
    this.state.handleCompletion(this._dataBuffer.numInstances);
  }

  private doSpawn (dt: number): void {
    this.spawnInfos.length = 0;
    const ctx = this.buildModuleContext(dt);

    this.runStage(ParticleModuleStage.EmitterUpdate, ctx);

    const oldNumInstances = this._dataBuffer.numInstances;

    for (const info of this.spawnInfos) {
      this.particleSpawn(this._dataBuffer, info);
    }

    // 首帧更新：一次 runStage 批量处理本帧新生粒子 [oldNumInstances, numInstances)
    if (this._dataBuffer.numInstances > oldNumInstances) {
      const firstFrameCtx: ParticleModuleContext = {
        ...ctx,
        deltaTime: 0,
        firstIndex: oldNumInstances,
        lastIndex: this._dataBuffer.numInstances,
        isFirstFrameUpdate: true,
      };

      this.runStage(ParticleModuleStage.ParticleUpdate, firstFrameCtx);
    }
  }

  // ========================
  // Particle Spawn
  // ========================

  private preAllocateSlots (db: ParticleDataBuffer, requestedCount: number): number[] {
    if (this.state.emissionStopped || requestedCount <= 0) {
      return [];
    }

    // 紧凑布局：新粒子总是追加在 [numInstances, cap) 区间。容量不足时按分配策略
    // 决定扩容或丢弃：FixedCount 池满丢新（旧固定上限行为）；AutomaticEstimate 扩容。
    const required = db.numInstances + requestedCount;
    const decision = this.policy.resolve(db.maxCount, required);

    if (decision.newCap !== undefined && decision.newCap > db.maxCount) {
      console.warn(`[particle] grow buffer ${db.maxCount} → ${decision.newCap} (mode=${this.policy.mode})`);
      db.grow(decision.newCap);
    }

    const cap = db.maxCount;
    const available = cap - db.numInstances;
    const dropCount = decision.dropCount;
    const count = Math.max(0, Math.min(requestedCount - dropCount, available));

    if (count <= 0) {
      return [];
    }
    const slots: number[] = [];
    const base = db.numInstances;

    for (let i = 0; i < count; i++) {
      slots.push(base + i);
    }
    db.numInstances = base + count;

    return slots;
  }

  private particleSpawn (
    db: ParticleDataBuffer,
    spawnInfo: SpawnInfo,
  ): void {
    const { count, generator, positionOffset } = spawnInfo;

    const worldMatrix = this.getWorldMatrix();
    // requestedCount 按 db 当前容量（可能已 grow）上限 clamp，而非 emitter 初始 maxCount。
    const requestedCount = Math.min(count, db.maxCount);
    const isRateSource = generator.useGeneratedCountIndex;

    const slotIndices = this.preAllocateSlots(db, requestedCount);

    if (slotIndices.length === 0) {
      return;
    }

    const spawnGenerators: ShapeGeneratorOptions[] = [];

    for (let i = 0; i < slotIndices.length; i++) {
      spawnGenerators.push({
        total: generator.total,
        index: isRateSource ? this.totalSpawnedParticles + i : generator.index,
        burstIndex: isRateSource ? 0 : i,
        burstCount: generator.burstCount,
      });
    }
    if (isRateSource) {
      this.totalSpawnedParticles += slotIndices.length;
    }

    const spawnCtx: ParticleModuleContext = {
      ...this.buildModuleContext(0),
      spawnBatch: { slotIndices, spawnGenerators },
    };

    this.runStage(ParticleModuleStage.ParticleSpawn, spawnCtx);

    this.bakeNewParticlesToWorld(slotIndices, worldMatrix, db);

    if (positionOffset) {
      for (const slotIdx of slotIndices) {
        const si3 = slotIdx * 3;

        db.simulatedPosition[si3] += positionOffset[0];
        db.simulatedPosition[si3 + 1] += positionOffset[1];
        db.simulatedPosition[si3 + 2] += positionOffset[2];
      }
    }
  }

  private bakeNewParticlesToWorld (slotIndices: number[], worldMatrix: Matrix4, db: ParticleDataBuffer): void {
    const e = worldMatrix.elements;
    const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
    const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]);

    for (const i of slotIndices) {
      const i3 = i * 3;
      const i2 = i * 2;

      // simulatedPosition: point transform
      worldMatrix.transformPoint(tempPos.set(db.simulatedPosition[i3], db.simulatedPosition[i3 + 1], db.simulatedPosition[i3 + 2]));
      db.simulatedPosition[i3] = tempPos.x;
      db.simulatedPosition[i3 + 1] = tempPos.y;
      db.simulatedPosition[i3 + 2] = tempPos.z;

      // velocity: transform direction to world, preserve original speed (remove scale influence)
      const localSpeed = tempVel.set(db.velocity[i3], db.velocity[i3 + 1], db.velocity[i3 + 2]).length();

      worldMatrix.transformNormal(tempVel);
      if (localSpeed > 0) {
        tempVel.multiply(localSpeed);
      }
      db.velocity[i3] = tempVel.x;
      db.velocity[i3 + 1] = tempVel.y;
      db.velocity[i3 + 2] = tempVel.z;
      db.initialVelocity[i3] = tempVel.x;
      db.initialVelocity[i3 + 1] = tempVel.y;
      db.initialVelocity[i3 + 2] = tempVel.z;

      // dirX/dirY: transform local values to world space (module already computed them)
      if (this.alignSpeedDirection) {
        worldMatrix.transformNormal(tmpDirX.set(db.dirX[i3], db.dirX[i3 + 1], db.dirX[i3 + 2]));
        db.dirX[i3] = tmpDirX.x;
        db.dirX[i3 + 1] = tmpDirX.y;
        db.dirX[i3 + 2] = tmpDirX.z;

        worldMatrix.transformNormal(tmpDirY.set(db.dirY[i3], db.dirY[i3 + 1], db.dirY[i3 + 2]));
        db.dirY[i3] = tmpDirY.x;
        db.dirY[i3 + 1] = tmpDirY.y;
        db.dirY[i3 + 2] = tmpDirY.z;
      }

      // size: scale by world matrix column lengths
      db.size[i2] *= sx;
      db.size[i2 + 1] *= sy;
      db.initialSize[i2] *= sx;
      db.initialSize[i2 + 1] *= sy;
    }
  }

  // ========================
  // Particle Query (position / box / raycast)
  // ========================

  getPointPosition (index: number): Vector3 {
    const db = this._dataBuffer;
    const i3 = index * 3;

    return new Vector3(
      db.position[i3],
      db.position[i3 + 1],
      db.position[i3 + 2],
    );
  }

  getParticleBoxes (): { center: Vector3, size: Vector3 }[] {
    const db = this._dataBuffer;
    const res: { center: Vector3, size: Vector3 }[] = [];

    for (let i = 0; i < db.numInstances; i++) {
      const i2 = i * 2;

      res.push({
        center: this.getPointPosition(i),
        size: new Vector3(db.size[i2], db.size[i2 + 1], 1),
      });
    }

    return res;
  }

  raycast (options: { ray: Ray, radius: number, multiple: boolean }): Vector3[] | undefined {
    const db = this._dataBuffer;

    if (!db) {
      return;
    }
    const hitPositions: Vector3[] = [];
    const temp = new Vector3();

    for (let i = db.numInstances - 1; i >= 0; i--) {
      const pos = this.getPointPosition(i);
      const ray = options.ray;

      if (ray && ray.intersectSphere({ center: pos, radius: options.radius }, temp)) {
        this.lastRaycastHitIndex = i;
        hitPositions.push(pos);
        if (!options.multiple) {
          break;
        }
      }
    }

    return hitPositions;
  }

  killParticle (index: number): void {
    const db = this._dataBuffer;

    if (!db || index < 0 || index >= db.numInstances) {
      return;
    }
    if (!db.alive[index]) {
      return;
    }
    // 标记死亡，由下一帧 tick 的 compactDead 压缩移除
    db.alive[index] = 0;
  }

  private getWorldMatrix (): Matrix4 {
    return this.particleFollowParent ? Matrix4.IDENTITY : this.worldMatrix;
  }

  // ========================
  // Helpers
  // ========================

  private buildModuleContext (deltaTime: number): ParticleModuleContext {
    return {
      deltaTime,
      currentTime: this.state.emitterAge,
      emitterLifetime: this.state.loopLifetime,
      duration: this.state.duration,
      dataBuffer: this._dataBuffer,
      emitter: this,
      firstIndex: 0,
      lastIndex: this._dataBuffer.numInstances,
      isFirstFrameUpdate: false,
    };
  }

}

const tempPos = new Vector3();
const tempVel = new Vector3();
const tmpDirX = new Vector3();
const tmpDirY = new Vector3();
