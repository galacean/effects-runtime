import type { Ray } from '@galacean/effects-math/es/core/index';
import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { ShapeGeneratorOptions } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { ParticleDataBuffer as ParticleDataBufferImpl } from './particle-data-buffer';
import type { ParticleModuleContext, ParticleModuleStage, SpawnInfo, SpawnGenerator } from './particle-module';
import type { ParticleModule } from './particle-module';
import type { EmitterData, ParsedModuleData, ParsedTrailConfig } from './parse-spec';
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
import { UpdateAgeModule } from './update-age-module';
import type { ParticleSystemRenderer } from './particle-system-renderer';

export class ParticleEmitter {
  // --- Mutable state ---
  time = 0;
  loopStartTime = 0;
  started = false;
  ended = false;
  frozen = false;
  emissionStopped = false;
  nextSlotIndex = 0;
  generatedCount = 0;
  lastEmitTime = 0;

  spawnInfos: SpawnInfo[] = [];

  // --- Config (set after setup) ---
  worldMatrix: Matrix4 = Matrix4.IDENTITY;
  itemDuration = 1;
  endBehaviorValue = 0;

  // --- Modules ---
  private modules: ParticleModule[] = [];

  // --- Shared refs (set during setup) ---
  private _dataBuffer: ParticleDataBuffer;
  private renderer: ParticleSystemRenderer;
  private maxCount = 0;
  private looping = false;
  particleFollowParent = false;
  private initialLastEmitTime = 0;
  private alignSpeedDirection = false;
  private trails?: ParsedTrailConfig;

  get dataBuffer (): ParticleDataBuffer {
    return this._dataBuffer;
  }

  setup (data: EmitterData, renderer: ParticleSystemRenderer): void {
    this.maxCount = data.maxCount;
    this.looping = data.looping;
    this.particleFollowParent = data.particleFollowParent;
    this.alignSpeedDirection = data.alignSpeedDirection;
    this.renderer = renderer;
    this.trails = data.trails;
    if (data.trails) {
      renderer.setTrailConfig(data.trails);
    }
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
      new UpdateAgeModule(),
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
    this.nextSlotIndex = 0;
    this.generatedCount = 0;
    this.lastEmitTime = this.initialLastEmitTime;

    this.trailFlushed = false;
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
    return this.time - this.loopStartTime;
  }

  get emitterLifetime (): number {
    return this.itemDuration > 0 ? this.timePassed / this.itemDuration : 0;
  }

  tick (delta: number): void {
    if (!this.started) {
      return;
    }
    this.time += delta / 1000;
    this.trailFlushed = false;
    this.renderer.updateTime(this.time, delta);

    const ctx = this.buildModuleContext(delta / 1000);

    // 1. update existing particles
    if (this._dataBuffer.activeCount > 0) {
      this.runStage('particleUpdate', ctx);
    }

    // 2. spawn + first-frame update for new particles
    if (!this.ended) {
      this.advanceEmitter(ctx);
    }

    // 3. sync to renderer
    if (this._dataBuffer.activeCount > 0) {
      this.renderer.generateDynamicData(this._dataBuffer);
    }
    this.flushTrails();
  }

  private advanceEmitter (ctx: ParticleModuleContext): void {
    if (this.timePassed < this.itemDuration) {
      this.spawnInfos.length = 0;
      this.runStage('emitterUpdate', ctx);

      const spawnedSlots: number[] = [];

      for (const info of this.spawnInfos) {
        this.particleSpawn(this._dataBuffer, this.maxCount, info, spawnedSlots);
      }
      const firstFrameCtx = { ...ctx, deltaTime: 0 };

      for (const slot of spawnedSlots) {
        firstFrameCtx.firstIndex = slot;
        firstFrameCtx.lastIndex = slot + 1;
        this.runStage('particleUpdate', firstFrameCtx);
      }
    } else if (this.looping) {
      this.flushTrails();
      this.handleLoop(this.itemDuration);
    } else {
      this.ended = true;
      if (this.endBehaviorValue === 5) {
        this.frozen = true;
      }
    }
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
      if (db.alive[s] && db.age[s] >= db.lifetime[s]) {
        expired.push(s);
      }
    }
    expired.sort((a, b) => {
      const diff = (db.lifetime[a] - db.age[a]) - (db.lifetime[b] - db.age[b]);

      return diff !== 0 ? diff : b - a;
    });

    const remaining = requestedCount - slots.length;

    for (let i = 0; i < Math.min(remaining, expired.length); i++) {
      const recycled = expired[i];

      if (this.trails?.dieWithParticles) {
        this.renderer.clearTrail(recycled);
      }
      slots.push(recycled);
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
      generator = resolved.generator;
      positionOffset = resolved.positionOffset;
    } else {
      count = spawnInfo.count;
      generator = spawnInfo.generator;
      positionOffset = null;
    }

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
      spawnBatch: { slotIndices, spawnGenerators },
    };

    this.runStage('particleSpawn', spawnCtx);

    this.bakeNewParticlesToWorld(slotIndices, worldMatrix, db);

    if (positionOffset) {
      for (const slotIdx of slotIndices) {
        const si3 = slotIdx * 3;

        db.position[si3] += positionOffset[0];
        db.position[si3 + 1] += positionOffset[1];
        db.position[si3 + 2] += positionOffset[2];
      }
    }
    spawnedSlots.push(...slotIndices);
    if (isRateSource) {
      this.lastEmitTime = this.timePassed;
    }
  }

  private bakeNewParticlesToWorld (slotIndices: number[], worldMatrix: Matrix4, db: ParticleDataBuffer): void {
    const e = worldMatrix.elements;
    const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
    const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]);

    for (const i of slotIndices) {
      const i3 = i * 3;
      const i2 = i * 2;

      // position: point transform
      worldMatrix.transformPoint(tempPos.set(db.position[i3], db.position[i3 + 1], db.position[i3 + 2]));
      db.position[i3] = tempPos.x;
      db.position[i3 + 1] = tempPos.y;
      db.position[i3 + 2] = tempPos.z;

      // velocity: transform direction to world, preserve original speed (remove scale influence)
      const localSpeed = tempVel.set(db.velocity[i3], db.velocity[i3 + 1], db.velocity[i3 + 2]).length();

      worldMatrix.transformNormal(tempVel);
      if (localSpeed > 0) {
        tempVel.multiply(localSpeed);
      }
      db.velocity[i3] = tempVel.x;
      db.velocity[i3 + 1] = tempVel.y;
      db.velocity[i3 + 2] = tempVel.z;

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
      if (db.alive[s] && db.age[s] >= db.lifetime[s]) {
        return true;
      }
    }

    return false;
  }

  // ========================
  // Particle Query (position / box / raycast)
  // ========================

  getPointPosition (index: number): Vector3 {
    const db = this._dataBuffer;
    const i3 = index * 3;

    return new Vector3(
      db.finalOffset[i3],
      db.finalOffset[i3 + 1],
      db.finalOffset[i3 + 2],
    );
  }

  getParticleBoxes (): { center: Vector3, size: Vector3 }[] {
    const db = this._dataBuffer;
    const res: { center: Vector3, size: Vector3 }[] = [];

    for (let i = 0; i < db.activeCount; i++) {
      if (!db.alive[i] || db.age[i] >= db.lifetime[i]) {
        continue;
      }
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

    for (let i = db.activeCount - 1; i >= 0; i--) {
      if (!db.alive[i] || db.age[i] >= db.lifetime[i]) {
        continue;
      }
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

  lastRaycastHitIndex = -1;

  killParticle (index: number): void {
    const db = this._dataBuffer;

    if (!db || index < 0 || index >= db.maxCount) {
      return;
    }
    if (this.trails?.dieWithParticles) {
      this.renderer.clearTrail(index);
    }
    db.lifetime[index] = 0;
  }

  // ========================
  // Trail Update
  // ========================

  private trailFlushed = false;

  private flushTrails (): void {
    if (this.trailFlushed || !this.trails) {
      return;
    }
    this.trailFlushed = true;
    this.renderer.updateTrails(this._dataBuffer, this.timePassed, this.emitterLifetime, this.worldMatrix);
  }

  private getWorldMatrix (): Matrix4 {
    return this.particleFollowParent ? Matrix4.IDENTITY : this.worldMatrix;
  }

  private handleLoop (duration: number): void {
    this.loopStartTime = this.time - duration;
    this.lastEmitTime -= duration;
    this.time -= duration;
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

}

const tempPos = new Vector3();
const tempVel = new Vector3();
const tmpDirX = new Vector3();
const tmpDirY = new Vector3();
