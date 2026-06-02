import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import type { Burst } from './burst';
import { SpawnRateModule } from './spawn-rate-module';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleModuleContext, ParticleModuleStage, ParticleSpawnContext, SpawnInfo } from './particle-module';
import type { ParticleModule } from './particle-module';
import type { ParticleSystemRenderer } from './particle-system-renderer';
import type { Transform } from '../../transform';

type TrailConfig = {
  lifetime: ValueGetter<number>,
  dieWithParticles: boolean,
  sizeAffectsWidth: boolean,
  sizeAffectsLifetime: boolean,
  inheritParticleColor: boolean,
  parentAffectsPosition: boolean,
};

type SpawnGeneratorOptions = {
  total: number,
  index: number,
  burstIndex: number,
  burstCount: number,
};

export class ParticleEmitter {
  // --- Mutable state ---
  time = 0;
  loopStartTime = 0;
  started = false;
  ended = false;
  frozen = false;
  emissionStopped = false;
  aliveCount = 0;
  nextSlotIndex = 0;
  generatedCount = 0;
  upDirectionWorld: Vector3 | null = null;
  spawnInfos: SpawnInfo[] = [];

  // --- Config (set after setup) ---
  basicTransform: { position: Vector3, path?: any } = { position: new Vector3() };
  componentTransform: Transform;
  itemDuration = 1;
  endBehaviorValue = 0;

  // --- Modules ---
  private modules: ParticleModule[] = [];
  private spawnRateRef: SpawnRateModule | null = null;

  // --- Spawn transient state (set per-batch before particleSpawn stage) ---
  private spawnGenerators: SpawnGeneratorOptions[] = [];

  // --- Shared refs (set during setup) ---
  private dataBuffer: ParticleDataBuffer;
  private renderer: ParticleSystemRenderer;
  private options: { maxCount: number, looping?: boolean, gravity: vec3, gravityModifier: ValueGetter<number>, speedOverLifetime?: ValueGetter<number>, forceTarget?: any, particleFollowParent?: boolean, linearVelOverLifetime?: any, orbitalVelOverLifetime?: any };
  private emission: { rateOverTime: ValueGetter<number>, bursts: Burst[], burstOffsets: Record<string, vec3[] | null> };
  private trails?: TrailConfig;
  private getPointPositionF64: (index: number) => Vector3;

  setup (opts: {
    dataBuffer: ParticleDataBuffer,
    renderer: ParticleSystemRenderer,
    options: ParticleEmitter['options'],
    emission: ParticleEmitter['emission'],
    modules: ParticleModule[],
    trails?: TrailConfig,
    getPointPositionF64: (index: number) => Vector3,
  }): void {
    this.dataBuffer = opts.dataBuffer;
    this.renderer = opts.renderer;
    this.options = opts.options;
    this.emission = opts.emission;
    this.modules = opts.modules;
    this.spawnRateRef = opts.modules.find(m => m instanceof SpawnRateModule) as SpawnRateModule ?? null;
    this.trails = opts.trails;
    this.getPointPositionF64 = opts.getPointPositionF64;
  }

  fullReset (): void {
    this.time = 0;
    this.loopStartTime = 0;
    this.ended = false;
    this.frozen = false;
    this.aliveCount = 0;
    this.nextSlotIndex = 0;
    this.generatedCount = 0;
    this.upDirectionWorld = null;
    this.trailUpdated = false;
    this.spawnInfos.length = 0;
    this.spawnRateRef?.reset(this.emission.rateOverTime);
  }

  commitSpawnRate (timePassed: number): void {
    this.spawnRateRef?.commitEmit(timePassed);
  }

  adjustForLoop (duration: number): void {
    this.spawnRateRef?.adjustForLoop(duration);
  }

  runStage (stage: ParticleModuleStage, ctx: ParticleModuleContext): void {
    for (const module of this.modules) {
      if (module.enabled && module.stage === stage) {
        module.execute(ctx);
      }
    }
  }

  getSpawnGenerator (idx: number): SpawnGeneratorOptions {
    return this.spawnGenerators[idx];
  }

  // ========================
  // Stage 1: Emitter Update
  // ========================

  get timePassed (): number {
    return this.time - this.loopStartTime;
  }

  get emitterLifetime (): number {
    return this.itemDuration > 0 ? this.timePassed / this.itemDuration : 0;
  }

  get parentTransformPosition (): Vector3 | null {
    return this.componentTransform?.parentTransform?.position.clone() ?? null;
  }

  tick (delta: number): void {
    if (!this.started) {
      return;
    }
    this.time += delta / 1000;
    this.upDirectionWorld = null;
    this.trailUpdated = false;
    this.renderer.updateTime(this.time, delta);

    this.particleUpdateAndSync(delta);

    if (!this.ended) {
      if (this.timePassed < this.itemDuration) {
        this.updateEmitterTransform(this.timePassed);
        this.emitterUpdateAndSpawn(delta);
      } else if (this.options.looping) {
        this.updateTrails();
        this.handleLoop(this.itemDuration);
      } else {
        this.ended = true;
        if (this.endBehaviorValue === 5) {
          this.frozen = true;
        }
      }
    }
    this.updateTrails();
  }

  private particleUpdateAndSync (delta: number): void {
    const db = this.dataBuffer;

    if (db.activeCount === 0) {
      return;
    }
    this.runStage('particleUpdate', this.buildModuleContext(delta));
    this.renderer.syncParticleData(db);
  }

  private emitterUpdateAndSpawn (delta: number): void {
    const db = this.dataBuffer;
    const maxCount = this.options.maxCount;

    this.spawnInfos.length = 0;
    this.runStage('emitterUpdate', this.buildModuleContext(delta / 1000));

    for (const info of this.spawnInfos) {
      if (info.isBurst) {
        this.executeBurstSpawn(db, maxCount, info);
      } else {
        this.particleSpawn(db, maxCount, info);
      }
    }
  }

  // ========================
  // Stage 3: Particle Spawn
  // ========================

  /**
   * 预分配 slot 列表。对齐 Pro 的 availableSpawnSlots 预计算：
   * 1. 优先使用 free slots (nextSlotIndex++)
   * 2. 超出后收集 expired slots（按 expiry 升序，匹配 findOldestSlot 行为）
   */
  private preAllocateSlots (db: ParticleDataBuffer, maxCount: number, requestedCount: number): number[] {
    if (this.emissionStopped || requestedCount <= 0) {
      return [];
    }
    const slots: number[] = [];

    // free slots
    while (slots.length < requestedCount && this.nextSlotIndex < maxCount) {
      slots.push(this.nextSlotIndex++);
    }
    if (slots.length >= requestedCount) {
      return slots;
    }

    // recyclable expired slots (sorted by expiry asc, index desc for tie-break)
    const expired: number[] = [];

    for (let s = 0; s < db.maxCount; s++) {
      if (db.alive[s] && (db.expiry[s] - this.loopStartTime) <= this.timePassed) {
        expired.push(s);
      }
    }
    expired.sort((a, b) => {
      const diff = db.expiry[a] - db.expiry[b];

      return diff !== 0 ? diff : b - a;
    });

    const remaining = requestedCount - slots.length;

    for (let i = 0; i < Math.min(remaining, expired.length); i++) {
      slots.push(expired[i]);
    }

    return slots;
  }

  private particleSpawn (
    db: ParticleDataBuffer,
    maxCount: number,
    spawnInfo: SpawnInfo,
  ): void {
    const worldMatrix = this.getWorldMatrix();
    const requestedCount = Math.min(spawnInfo.count, maxCount);
    const timeDelta = spawnInfo.timeDelta;
    const meshTime = this.time;

    const slotIndices = this.preAllocateSlots(db, maxCount, requestedCount);

    if (slotIndices.length === 0) {
      return;
    }

    this.spawnGenerators = [];
    for (let i = 0; i < slotIndices.length; i++) {
      this.spawnGenerators.push({
        total: this.emission.rateOverTime.getValue(this.emitterLifetime),
        index: this.generatedCount + i,
        burstIndex: 0,
        burstCount: 0,
      });
    }
    this.generatedCount += slotIndices.length;

    const spawnCtx: ParticleSpawnContext = {
      ...this.buildModuleContext(0),
      worldMatrix,
      slotIndices,
    };

    this.runStage('particleSpawn', spawnCtx);

    for (let i = 0; i < slotIndices.length; i++) {
      const slotIdx = slotIndices[i];

      db.delay[slotIdx] += meshTime + i * timeDelta;
      db.delayF64[slotIdx] += meshTime + i * timeDelta;
      this.commitParticle(slotIdx, maxCount, db);
    }
    this.commitSpawnRate(this.timePassed);
  }

  private hasAvailableSlots (db: ParticleDataBuffer, maxCount: number): boolean {
    if (this.emissionStopped) {
      return false;
    }
    if (this.nextSlotIndex < maxCount) {
      return true;
    }
    for (let s = 0; s < db.maxCount; s++) {
      if (db.alive[s] && (db.expiry[s] - this.loopStartTime) <= this.timePassed) {
        return true;
      }
    }

    return false;
  }

  /**
   * 处理单个 burst SpawnInfo。
   * 先确认有可用 slot，再调 getGeneratorOptions 消耗 burst 状态。
   * 无可用 slot 时不消耗状态，保留给下一帧。
   */
  private executeBurstSpawn (db: ParticleDataBuffer, maxCount: number, info: SpawnInfo): void {
    if (!this.hasAvailableSlots(db, maxCount)) {
      return;
    }
    const emission = this.emission;
    const j = info.burstIndex ?? 0;
    const burst = emission.bursts[j];

    if (!burst) {
      return;
    }

    const opts = burst.getGeneratorOptions(this.timePassed, this.emitterLifetime);

    if (!opts) {
      return;
    }

    const offsets = emission.burstOffsets[j];
    const burstOffset = (offsets && offsets[opts.cycleIndex]) || ORIGIN_VEC;

    if (burst.once) {
      emission.burstOffsets[j] = null;
      emission.bursts.splice(j, 1);
    }

    const worldMatrix = this.getWorldMatrix();
    const meshTime = this.time;
    const burstCount = opts.count;
    const slotIndices = this.preAllocateSlots(db, maxCount, burstCount);

    if (slotIndices.length === 0) {
      return;
    }

    this.spawnGenerators = [];
    for (let i = 0; i < slotIndices.length; i++) {
      this.spawnGenerators.push({
        total: opts.total,
        index: opts.index,
        burstIndex: i,
        burstCount,
      });
    }

    const spawnCtx: ParticleSpawnContext = {
      ...this.buildModuleContext(0),
      worldMatrix,
      slotIndices,
    };

    this.runStage('particleSpawn', spawnCtx);

    for (let i = 0; i < slotIndices.length; i++) {
      const slotIdx = slotIndices[i];
      const si3 = slotIdx * 3;

      db.delay[slotIdx] += meshTime;
      db.delayF64[slotIdx] += meshTime;
      db.position[si3] += burstOffset[0];
      db.position[si3 + 1] += burstOffset[1];
      db.position[si3 + 2] += burstOffset[2];
      db.positionF64[si3] += burstOffset[0];
      db.positionF64[si3 + 1] += burstOffset[1];
      db.positionF64[si3 + 2] += burstOffset[2];
      this.commitParticle(slotIdx, maxCount, db);
    }
  }

  // ========================
  // Trail Update
  // ========================

  private trailUpdated = false;

  private updateTrails (): void {
    if (this.trailUpdated || !this.trails) {
      return;
    }
    this.trailUpdated = true;
    this.renderer.updateTrailData({
      db: this.dataBuffer,
      timePassed: this.timePassed,
      emitterLifetime: this.emitterLifetime,
      trails: this.trails,
      getPointPositionF64: this.getPointPositionF64,
      parentTransformPosition: this.parentTransformPosition,
    });
  }

  private getWorldMatrix (): Matrix4 {
    return this.options.particleFollowParent ? Matrix4.IDENTITY : this.componentTransform.getWorldMatrix();
  }

  private updateEmitterTransform (time: number): void {
    const { path, position } = this.basicTransform;
    const selfPos = position.clone();

    if (path) {
      selfPos.add(path.getValue(time / this.itemDuration));
    }
    this.componentTransform.setPosition(selfPos.x, selfPos.y, selfPos.z);

    if (this.options.particleFollowParent) {
      this.renderer.updateWorldMatrix(this.componentTransform.getWorldMatrix());
    }
  }

  private handleLoop (duration: number): void {
    this.loopStartTime = this.time - duration;
    this.adjustForLoop(duration);
    this.time -= duration;
    this.emission.bursts.forEach(b => b.reset());
    const db = this.dataBuffer;

    for (let li = 0; li < db.activeCount; li++) {
      if (db.alive[li]) {
        db.expiry[li] -= duration;
        db.delay[li] -= duration;
        db.delayF64[li] -= duration;
      }
    }
    this.renderer.minusTimeForLoop(duration);
  }

  // ========================
  // Helpers
  // ========================

  private buildModuleContext (deltaTime: number): ParticleModuleContext {
    return {
      deltaTime,
      currentTime: this.time,
      emitterLifetime: this.emitterLifetime,
      duration: this.itemDuration,
      dataBuffer: this.dataBuffer,
      emitter: this,
      firstIndex: 0,
      lastIndex: this.dataBuffer.activeCount,
    };
  }

  private commitParticle (slotIndex: number, maxCount: number, db: ParticleDataBuffer): void {
    db.alive[slotIndex] = 1;
    db.expiry[slotIndex] = db.delayF64[slotIndex] + db.lifetimeF64[slotIndex];
    this.aliveCount = Math.min(this.aliveCount + 1, maxCount);

    db.seed[slotIndex] = Math.random();
    this.renderer.particleMesh.setPointFromBuffer(slotIndex, db);
    if (this.trails?.dieWithParticles) {
      this.renderer.clearTrail(slotIndex);
    }
    if (this.parentTransformPosition) {
      this.renderer.setTrailStartPosition(slotIndex, this.parentTransformPosition.clone());
    }
  }
}

const ORIGIN_VEC: vec3 = [0, 0, 0];
