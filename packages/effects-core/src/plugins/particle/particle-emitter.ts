import type { Ray } from '@galacean/effects-math/es/core/index';
import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type * as spec from '@galacean/effects-specification';
import { createValueGetter } from '../../math';
import type { ShapeGeneratorOptions } from '../../shape';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { ParticleDataBuffer as ParticleDataBufferImpl } from './particle-data-buffer';
import type { ParticleModuleContext, ParticleModuleStage, SpawnInfo, SpawnGenerator } from './particle-module';
import type { ParticleModule } from './particle-module';
import type { ParsedModuleData } from './parse-spec';
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
import type { ParticleSystemRenderer } from './particle-system-renderer';

export type ParsedTrailConfig = {
  lifetime: spec.NumberExpression | number,
  dieWithParticles: boolean,
  sizeAffectsWidth: boolean,
  sizeAffectsLifetime: boolean,
  inheritParticleColor: boolean,
  parentAffectsPosition: boolean,
};

export type EmitterData = {
  maxCount: number,
  looping: boolean,
  particleFollowParent: boolean,
  alignSpeedDirection: boolean,
  trails: ParsedTrailConfig | undefined,
  modules: ParsedModuleData,
};

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
  uniqueIdCounter = 0;

  spawnInfos: SpawnInfo[] = [];

  // --- Config (set after setup) ---
  worldMatrix: Matrix4 = Matrix4.IDENTITY;
  itemDuration = 1;
  endBehaviorValue = 0;

  // --- Modules ---
  private modules: ParticleModule[] = [];

  // --- Shared refs (set during setup) ---
  private _dataBuffer: ParticleDataBuffer;
  private renderer: ParticleSystemRenderer | null = null;
  private maxCount = 0;
  private looping = false;
  particleFollowParent = false;
  private initialLastEmitTime = 0;
  private alignSpeedDirection = false;
  private pointCountPerTrail = 0;

  /** 单调递增时间，不受 loop 回退影响（对齐 Pro 的 emitterAge） */
  emitterAge = 0;

  get dataBuffer (): ParticleDataBuffer {
    return this._dataBuffer;
  }

  fromJSON (data: EmitterData, renderer: ParticleSystemRenderer): void {
    this.maxCount = data.maxCount;
    this.looping = data.looping;
    this.particleFollowParent = data.particleFollowParent;
    this.alignSpeedDirection = data.alignSpeedDirection;
    this.renderer = renderer;
    this._dataBuffer = new ParticleDataBufferImpl(data.maxCount);
    const rate = data.modules.spawnRate?.rateOverTime;

    this.initialLastEmitTime = rate ? -1 / createValueGetter(rate).getValue(0) : 0;
    this.lastEmitTime = this.initialLastEmitTime;
    this.modules = this.buildModules(data.modules);
  }

  setupTrailEmitter (maxCount: number, modules: ParticleModule[], pointCountPerTrail: number): void {
    this.maxCount = maxCount;
    this.looping = true;
    this.particleFollowParent = true;
    this.pointCountPerTrail = pointCountPerTrail;
    this._dataBuffer = new ParticleDataBufferImpl(maxCount);
    this.modules = modules;
  }

  private buildModules (data: ParsedModuleData): ParticleModule[] {
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

  setMaxCount (count: number): void {
    this.maxCount = count;
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

    this.emitterAge = 0;
    this.uniqueIdCounter = 0;
    this.spawnInfos.length = 0;
    this._dataBuffer?.clear(); // clears alive, freeSlots, liveIndices
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
    this.emitterAge += delta / 1000;
    this.renderer?.updateTime(this.time);

    const ctx = this.buildModuleContext(delta / 1000);

    // 1. update existing particles (includes KillBySourceModule setting lifetime=0)
    if (this._dataBuffer.activeCount > 0) {
      this.runStage('particleUpdate', ctx);
    }

    // 2. recycle dead particles into free-list (before spawn, so slots are available)
    this.recycleDead();

    // 3. spawn + first-frame update for new particles
    if (!this.ended) {
      this.advanceEmitter(ctx);
    }

    // 4. build live indices + shrink activeCount (after spawn, for renderer)
    this.rebuildLiveIndices();

    // 5. sync to renderer
    if (this._dataBuffer.liveCount > 0 && this.renderer) {
      this.renderer.generateSpriteData(this);
    }
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

    // Phase 1: fresh sequential allocation
    while (slots.length < requestedCount && this.nextSlotIndex < maxCount) {
      slots.push(this.nextSlotIndex++);
    }
    if (slots.length >= requestedCount) {
      return slots;
    }

    // Phase 2: pop from free-list
    const freeSlots = db.freeSlots;
    const remaining = requestedCount - slots.length;
    const toTake = Math.min(remaining, freeSlots.length);

    for (let i = 0; i < toTake; i++) {
      slots.push(freeSlots.pop()!);
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

        db.simulatedPosition[si3] += positionOffset[0];
        db.simulatedPosition[si3 + 1] += positionOffset[1];
        db.simulatedPosition[si3 + 2] += positionOffset[2];
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

  hasAvailableSlots (db: ParticleDataBuffer, maxCount: number): boolean {
    if (this.emissionStopped) {
      return false;
    }

    return this.nextSlotIndex < maxCount || db.freeSlots.length > 0;
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

    for (let i = 0; i < db.activeCount; i++) {
      if (!db.alive[i]) {
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
      if (!db.alive[i]) {
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
    if (!db.alive[index]) {
      return;
    }
    db.alive[index] = 0;
    db.lifetime[index] = 0;
    db.freeSlots.push(index);
  }

  private getWorldMatrix (): Matrix4 {
    return this.particleFollowParent ? Matrix4.IDENTITY : this.worldMatrix;
  }

  private handleLoop (duration: number): void {
    this.loopStartTime = this.time - duration;
    this.lastEmitTime -= duration;
    this.time -= duration;
    this.renderer?.minusTimeForLoop(duration);
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

  private recycleDead (): void {
    const db = this._dataBuffer;

    for (let i = 0; i < db.activeCount; i++) {
      if (db.alive[i] && db.age[i] >= db.lifetime[i]) {
        db.alive[i] = 0;
        db.freeSlots.push(i);
      }
    }

    if (this.pointCountPerTrail > 0) {
      this.trimRibbons(db);
    }
  }

  private trimRibbons (db: ParticleDataBuffer): void {
    const cap = this.pointCountPerTrail;
    const ribbonSlots = new Map<number, number[]>();

    for (let i = 0; i < db.activeCount; i++) {
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
        const slot = slots[i];

        db.alive[slot] = 0;
        db.freeSlots.push(slot);
      }
    }
  }

  private rebuildLiveIndices (): void {
    const db = this._dataBuffer;
    const liveIndices = db.liveIndices;

    liveIndices.length = 0;
    let maxAliveSlot = -1;

    for (let i = 0; i < db.activeCount; i++) {
      if (db.alive[i]) {
        liveIndices.push(i);
        maxAliveSlot = i;
      }
    }
    db.activeCount = maxAliveSlot + 1;
  }

}

const tempPos = new Vector3();
const tempVel = new Vector3();
const tmpDirX = new Vector3();
const tmpDirY = new Vector3();
