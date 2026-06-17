import type { Ray } from '@galacean/effects-math/es/core/index';
import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { ShapeGeneratorOptions } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { ParticleDataBuffer as ParticleDataBufferImpl } from './particle-data-buffer';
import { ParticleModuleStage, isSourceDependent } from './particle-module';
import type { ParticleModuleContext, SpawnInfo } from './particle-module';
import type { ParticleModule } from './particle-module';
import type { ParsedModuleData, SpriteModuleData, TrailModuleData } from './parse-spec';
import { BurstSpawnModule } from './burst-spawn-module';
import { ForceTargetModule } from './force-target-module';
import { InitializeParticleModule } from './initialize-particle-module';
import { ScaleColorModule } from './scale-color-module';
import { ScaleSizeModule } from './scale-size-module';
import { GravityForceModule } from './gravity-force-module';
import { SolveForcesAndVelocityModule } from './solve-forces-and-velocity-module';
import { OrbitalAndLinearMoveModule } from './orbital-and-linear-move-module';
import { SolveRotationModule } from './solve-rotation-module';
import { SpawnRateModule } from './spawn-rate-module';
import { UpdateAgeModule } from './update-age-module';
import { SpawnPerSourceParticleModule } from './spawn-per-source-module';
import { SampleFromSourceModule } from './sample-from-source-module';
import { KillBySourceModule } from './kill-by-source-module';
import { EmitterState, EmitterExecutionState } from './emitter-state';
import type { ParticleSystemRenderer } from './particle-system-renderer';

export type EmitterData = {
  maxCount: number,
  looping: boolean,
  particleFollowParent: boolean,
  alignSpeedDirection: boolean,
  /** 0 = sprite emitter；>0 = trail emitter，限制每条 ribbon 的点数 */
  pointCountPerTrail: number,
  modules: ParsedModuleData,
};

export class ParticleEmitter {
  // --- Lifecycle state machine ---
  readonly state = new EmitterState();

  // --- Config (set during setup, immutable after) ---
  maxCount = 0;
  particleFollowParent = false;
  private alignSpeedDirection = false;
  private pointCountPerTrail = 0;

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

  // --- Internal refs (set during setup) ---
  private _dataBuffer: ParticleDataBuffer;
  private renderer: ParticleSystemRenderer | null = null;

  get dataBuffer (): ParticleDataBuffer {
    return this._dataBuffer;
  }

  fromJSON (data: EmitterData, renderer: ParticleSystemRenderer): void {
    this.maxCount = data.maxCount;
    this.state.looping = data.looping;
    this.particleFollowParent = data.particleFollowParent;
    this.alignSpeedDirection = data.alignSpeedDirection;
    this.pointCountPerTrail = data.pointCountPerTrail;
    this.renderer = renderer;
    this._dataBuffer = new ParticleDataBufferImpl(data.maxCount);
    this.modules = this.buildModules(data.modules);
  }

  /**
   * 绑定 source emitter，解析 trail 模块的跨 emitter 依赖。
   *
   * 对齐 Niagara：跨 emitter 引用在构造之后由独立的 binding resolve 步骤注入
   * （InitPerInstanceData → EmitterBinding.Resolve）。
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
    this.renderer?.reset();
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
    //    粒子标记为 alive[i] = 0
    if (this._dataBuffer.numInstances > 0) {
      const ctx = this.buildModuleContext(dt);

      this.runStage(ParticleModuleStage.ParticleUpdate, ctx);
    }

    // 3. trim ribbons（trail emitter 限制每条 ribbon 的点数，超额标记 alive = 0）
    if (this.pointCountPerTrail > 0) {
      this.trimRibbons(this._dataBuffer);
    }

    // 4. compact dead particles（swap-copy 压缩，使 [0, numInstances) 保持紧凑）
    this._dataBuffer.compactDead();

    // 5. spawn (only if state allows)
    if (this.state.isSpawningAllowed()) {
      this.doSpawn(dt);
    }

    // 6. handle completion
    this.state.handleCompletion(this._dataBuffer.numInstances);

    // 7. render（仅 sprite emitter 自渲染；trail 的 ribbon 由 particle-system 外部生成）
    if (this.pointCountPerTrail === 0 && this._dataBuffer.numInstances > 0 && this.renderer) {
      this.renderer.generateSpriteData(this);
    }
  }

  private doSpawn (dt: number): void {
    this.spawnInfos.length = 0;
    const ctx = this.buildModuleContext(dt);

    this.runStage(ParticleModuleStage.EmitterUpdate, ctx);

    const oldNumInstances = this._dataBuffer.numInstances;

    for (const info of this.spawnInfos) {
      this.particleSpawn(this._dataBuffer, this.maxCount, info);
    }

    // 首帧更新：一次 runStage 批量处理本帧新生粒子 [oldNumInstances, numInstances)
    if (this._dataBuffer.numInstances > oldNumInstances) {
      const firstFrameCtx: ParticleModuleContext = {
        ...ctx,
        deltaTime: 0,
        firstIndex: oldNumInstances,
        lastIndex: this._dataBuffer.numInstances,
      };

      this.runStage(ParticleModuleStage.ParticleUpdate, firstFrameCtx);
    }
  }

  // ========================
  // Particle Spawn
  // ========================

  private preAllocateSlots (db: ParticleDataBuffer, maxCount: number, requestedCount: number): number[] {
    if (this.state.emissionStopped || requestedCount <= 0) {
      return [];
    }

    // 紧凑布局：新粒子总是追加在 [numInstances, maxCount) 区间
    const available = maxCount - db.numInstances;
    const count = Math.min(requestedCount, available);

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
    maxCount: number,
    spawnInfo: SpawnInfo,
  ): void {
    const { count, generator, positionOffset } = spawnInfo;

    const worldMatrix = this.getWorldMatrix();
    const requestedCount = Math.min(count, maxCount);
    const isRateSource = generator.useGeneratedCountIndex;

    const slotIndices = this.preAllocateSlots(db, maxCount, requestedCount);

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
    };
  }

  private trimRibbons (db: ParticleDataBuffer): void {
    const cap = this.pointCountPerTrail;
    const ribbonSlots = new Map<number, number[]>();

    for (let i = 0; i < db.numInstances; i++) {
      if (!db.alive[i]) { continue; }
      const rid = db.ribbonId[i];
      let arr = ribbonSlots.get(rid);

      if (!arr) {
        arr = [];
        ribbonSlots.set(rid, arr);
      }
      arr.push(i);
    }

    for (const slots of ribbonSlots.values()) {
      if (slots.length <= cap) { continue; }
      slots.sort((a, b) => db.ribbonLinkOrder[a] - db.ribbonLinkOrder[b]);
      const excess = slots.length - cap;

      for (let i = 0; i < excess; i++) {
        // 标记死亡，由 compactDead 压缩移除
        db.alive[slots[i]] = 0;
      }
    }
  }

}

const tempPos = new Vector3();
const tempVel = new Vector3();
const tmpDirX = new Vector3();
const tmpDirY = new Vector3();
