import type { Ray } from '@galacean/effects-math/es/core/index';
import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import type { ShapeGeneratorOptions } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { ParticleDataBuffer as ParticleDataBufferImpl } from './particle-data-buffer';
import type { ParticleModuleContext, ParticleModuleStage, SpawnInfo, SpawnGenerator } from './particle-module';
import type { ParticleModule } from './particle-module';
import type { EmitterData, ParsedModuleData } from './parse-spec';
import { BurstSpawnModule } from './burst-spawn-module';
import { ForceTargetModule } from './force-target-module';
import { InitializeParticleModule } from './initialize-particle-module';
import { ScaleColorModule } from './scale-color-module';
import { ScaleSizeModule } from './scale-size-module';
import { SolveLinearMoveModule } from './solve-linear-move-module';
import { SolveOrbitalVelocityModule } from './solve-orbital-velocity-module';
import { SolveRotationModule } from './solve-rotation-module';
import { SolveVelocityModule } from './solve-velocity-module';
import { SpawnRateModule } from './spawn-rate-module';
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
  lastEmitTime = 0;
  upDirectionWorld: Vector3 | null = null;
  spawnInfos: SpawnInfo[] = [];

  // --- Config (set after setup) ---
  basicTransform: { position: Vector3, path?: any } = { position: new Vector3() };
  componentTransform: Transform;
  itemDuration = 1;
  endBehaviorValue = 0;

  // --- Modules ---
  private modules: ParticleModule[] = [];

  // --- Shared refs (set during setup) ---
  private _dataBuffer: ParticleDataBuffer;
  private renderer: ParticleSystemRenderer;
  private maxCount = 0;
  private looping = false;
  private particleFollowParent = false;
  private initialLastEmitTime = 0;
  private trails?: TrailConfig;

  get dataBuffer (): ParticleDataBuffer {
    return this._dataBuffer;
  }

  setup (data: EmitterData, renderer: ParticleSystemRenderer): void {
    this.maxCount = data.maxCount;
    this.looping = data.looping;
    this.particleFollowParent = data.particleFollowParent;
    this.renderer = renderer;
    this.trails = data.trails;
    this._dataBuffer = new ParticleDataBufferImpl(data.maxCount);
    const rate = data.modules.spawnRate?.rateOverTime;

    this.initialLastEmitTime = rate ? -1 / rate.getValue(0) : 0;
    this.lastEmitTime = this.initialLastEmitTime;
    this.modules = this.buildModules(data.modules);
  }

  private buildModules (data: ParsedModuleData): ParticleModule[] {
    const modules: ParticleModule[] = [];

    if (data.spawnRate) {
      modules.push(new SpawnRateModule(data.spawnRate));
    }
    modules.push(
      new BurstSpawnModule(data.burst),
      new InitializeParticleModule(data.initialize),
      new SolveVelocityModule(data.solveVelocity),
      new SolveRotationModule(data.solveRotation),
      new SolveLinearMoveModule(data.solveLinearMove),
      new SolveOrbitalVelocityModule(data.solveOrbital),
    );
    if (data.forceTarget) {
      modules.push(new ForceTargetModule(data.forceTarget));
    }
    modules.push(
      new ScaleSizeModule(data.scaleSize),
      new ScaleColorModule(data.scaleColor),
    );

    return modules;
  }

  setMaxCount (count: number): void {
    this.maxCount = count;
    if (this.renderer?.particleMesh) {
      this.renderer.particleMesh.maxCount = count;
    }
  }

  getMaxCount (): number {
    return this.maxCount;
  }

  fullReset (): void {
    this.time = 0;
    this.loopStartTime = 0;
    this.ended = false;
    this.frozen = false;
    this.aliveCount = 0;
    this.nextSlotIndex = 0;
    this.generatedCount = 0;
    this.lastEmitTime = this.initialLastEmitTime;
    this.upDirectionWorld = null;
    this.trailUpdated = false;
    this.spawnInfos.length = 0;
    this._dataBuffer?.clear();
    this.renderer?.reset();
  }

  initTransform (itemTransformPosition: Vector3, emitterTransformPath: any): void {
    const position = itemTransformPosition.clone();
    let path;

    if (emitterTransformPath) {
      if (emitterTransformPath[0] === 3) { // spec.ValueType.CONSTANT_VEC3
        position.add(emitterTransformPath[1]);
      } else {
        path = createValueGetter(emitterTransformPath);
      }
    }
    this.basicTransform = { position, path };

    const selfPos = position.clone();

    if (path) {
      selfPos.add(path.getValue(0));
    }
    this.componentTransform.setPosition(selfPos.x, selfPos.y, selfPos.z);

    if (this.particleFollowParent) {
      this.renderer.updateWorldMatrix(this.componentTransform.getWorldMatrix());
    }
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

    const dtSec = delta / 1000;
    const ctx = this.buildModuleContext(dtSec);

    if (this._dataBuffer.activeCount > 0) {
      this.runStage('particleUpdate', ctx);
    }

    if (!this.ended) {
      if (this.timePassed < this.itemDuration) {
        this.updateEmitterTransform(this.timePassed);
        const spawnedSlots = this.emitterUpdateAndSpawn(ctx);

        for (const slot of spawnedSlots) {
          ctx.firstIndex = slot;
          ctx.lastIndex = slot + 1;
          this.runStage('particleUpdate', ctx);
        }
      } else if (this.looping) {
        this.updateTrails();
        this.handleLoop(this.itemDuration);
      } else {
        this.ended = true;
        if (this.endBehaviorValue === 5) {
          this.frozen = true;
        }
      }
    }
    if (this._dataBuffer.activeCount > 0) {
      this.renderer.syncParticleData(this._dataBuffer);
    }
    this.updateTrails();
  }

  private emitterUpdateAndSpawn (ctx: ParticleModuleContext): number[] {
    const maxCount = this.maxCount;
    const spawnedSlots: number[] = [];

    this.spawnInfos.length = 0;
    this.runStage('emitterUpdate', ctx);

    for (const info of this.spawnInfos) {
      this.particleSpawn(this._dataBuffer, maxCount, info, spawnedSlots);
    }

    return spawnedSlots;
  }

  // ========================
  // Particle Spawn
  // ========================

  private preAllocateSlots (db: ParticleDataBuffer, maxCount: number, requestedCount: number): number[] {
    if (this.emissionStopped || requestedCount <= 0) {
      return [];
    }
    const slots: number[] = [];

    while (slots.length < requestedCount && this.nextSlotIndex < maxCount) {
      slots.push(this.nextSlotIndex++);
    }
    if (slots.length >= requestedCount) {
      return slots;
    }

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
    spawnedSlots: number[],
  ): void {
    let count: number;
    let timeDelta: number;
    let generator: SpawnGenerator;
    let positionOffset: readonly [number, number, number] | null;

    if (spawnInfo.kind === 'burst') {
      if (!this.hasAvailableSlots(db, maxCount)) {
        return;
      }
      const resolved = spawnInfo.prepare();

      if (!resolved) {
        return;
      }
      count = resolved.count;
      timeDelta = 0;
      generator = resolved.generator;
      positionOffset = resolved.positionOffset;
    } else {
      count = spawnInfo.count;
      timeDelta = spawnInfo.timeDelta;
      generator = spawnInfo.generator;
      positionOffset = null;
    }

    const worldMatrix = this.getWorldMatrix();
    const requestedCount = Math.min(count, maxCount);
    const meshTime = this.time;
    const isRateSource = generator.useGeneratedCountIndex;

    const slotIndices = this.preAllocateSlots(db, maxCount, requestedCount);

    if (slotIndices.length === 0) {
      return;
    }

    const spawnGenerators: ShapeGeneratorOptions[] = [];

    for (let i = 0; i < slotIndices.length; i++) {
      spawnGenerators.push({
        total: generator.total,
        index: isRateSource ? this.generatedCount + i : generator.index,
        burstIndex: isRateSource ? 0 : i,
        burstCount: generator.burstCount,
      });
    }
    if (isRateSource) {
      this.generatedCount += slotIndices.length;
    }

    const spawnCtx: ParticleModuleContext = {
      ...this.buildModuleContext(0),
      worldMatrix,
      slotIndices,
      spawnGenerators,
      positionOffset,
    };

    this.runStage('particleSpawn', spawnCtx);

    for (let i = 0; i < slotIndices.length; i++) {
      const slotIdx = slotIndices[i];

      db.delay[slotIdx] += meshTime + i * timeDelta;
      db.delayF64[slotIdx] += meshTime + i * timeDelta;
      this.commitParticle(slotIdx, maxCount, db);
      spawnedSlots.push(slotIdx);
    }
    if (isRateSource) {
      this.lastEmitTime = this.timePassed;
    }
  }

  hasAvailableSlots (db: ParticleDataBuffer, maxCount: number): boolean {
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

  // ========================
  // Particle Query (position / box / raycast)
  // ========================

  getPointPositionF64 (index: number): Vector3 {
    const db = this._dataBuffer;
    const i3 = index * 3;

    return new Vector3(
      db.positionF64[i3] + db.finalOffset[i3],
      db.positionF64[i3 + 1] + db.finalOffset[i3 + 1],
      db.positionF64[i3 + 2] + db.finalOffset[i3 + 2],
    );
  }

  getPointPositionByIndex (index: number): Vector3 | null {
    const db = this._dataBuffer;

    if (!db || index < 0 || index >= db.activeCount || !db.alive[index]) {
      console.error('Get point error.');

      return null;
    }

    return this.getPointPositionF64(index);
  }

  getParticleBoxes (): { center: Vector3, size: Vector3 }[] {
    const db = this._dataBuffer;
    const res: { center: Vector3, size: Vector3 }[] = [];

    if (!db) {
      return res;
    }
    for (let i = 0; i < db.activeCount; i++) {
      if (!db.alive[i] || db.expiry[i] <= this.timePassed) {
        continue;
      }
      const pos = this.getPointPositionF64(i);
      const bi2 = i * 2;

      res.push({
        center: pos,
        size: new Vector3(db.sizeF64[bi2], db.sizeF64[bi2 + 1], 1),
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

    for (let i = db.activeCount - 1; i >= 0; i--) {
      if (!db.alive[i] || db.expiry[i] <= this.timePassed) {
        continue;
      }
      const pos = this.getPointPositionF64(i);
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

  lastRaycastHitIndex = -1;

  killParticle (index: number): void {
    const db = this._dataBuffer;

    if (!db || index < 0 || index >= db.maxCount) {
      return;
    }
    this.renderer.removeParticlePoint(index);
    if (this.trails?.dieWithParticles) {
      this.renderer.clearTrail(index);
    }
    db.expiry[index] = 0;
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
      db: this._dataBuffer,
      timePassed: this.timePassed,
      emitterLifetime: this.emitterLifetime,
      trails: this.trails,
      getPointPositionF64: i => this.getPointPositionF64(i),
      parentTransformPosition: this.parentTransformPosition,
    });
  }

  private getWorldMatrix (): Matrix4 {
    return this.particleFollowParent ? Matrix4.IDENTITY : this.componentTransform.getWorldMatrix();
  }

  private updateEmitterTransform (time: number): void {
    const { path, position } = this.basicTransform;
    const selfPos = position.clone();

    if (path) {
      selfPos.add(path.getValue(time / this.itemDuration));
    }
    this.componentTransform.setPosition(selfPos.x, selfPos.y, selfPos.z);

    if (this.particleFollowParent) {
      this.renderer.updateWorldMatrix(this.componentTransform.getWorldMatrix());
    }
  }

  private handleLoop (duration: number): void {
    this.loopStartTime = this.time - duration;
    this.lastEmitTime -= duration;
    this.time -= duration;
    const db = this._dataBuffer;

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
      dataBuffer: this._dataBuffer,
      emitter: this,
      firstIndex: 0,
      lastIndex: this._dataBuffer.activeCount,
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
