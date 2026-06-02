import type { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import type { Burst } from './burst';
import type { InitializeParticleModule } from './initialize-particle-module';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleModuleContext } from './particle-module';
import type { ParticleSystemRenderer } from './particle-system-renderer';
import type { ShapeGenerator } from '../../shape';
import type { SolveLinearMoveModule } from './solve-linear-move-module';
import type { SolveRotationModule } from './solve-rotation-module';
import type { SolveVelocityModule } from './solve-velocity-module';
import type { SpawnRateModule } from './spawn-rate-module';
import type { Transform } from '../../transform';

type TrailConfig = {
  lifetime: ValueGetter<number>,
  dieWithParticles: boolean,
  sizeAffectsWidth: boolean,
  sizeAffectsLifetime: boolean,
  inheritParticleColor: boolean,
  parentAffectsPosition: boolean,
};

export type TickContext = {
  deltaTime: number,
  currentTime: number,
  emitterLifetime: number,
  timePassed: number,
  duration: number,
  loopStartTime: number,
  worldMatrix: Matrix4,
  emitterTransform: Transform,
  emissionStopped: boolean,
  parentTransformPosition: Vector3 | null,
};

export class ParticleEmitter {
  // --- Mutable state ---
  aliveCount = 0;
  nextSlotIndex = 0;
  generatedCount = 0;
  upDirectionWorld: Vector3 | null = null;

  // --- Modules ---
  spawnRateModule: SpawnRateModule;
  initParticleModule: InitializeParticleModule;
  solveVelocityModule: SolveVelocityModule | null = null;
  solveRotationModule: SolveRotationModule | null = null;
  solveLinearMoveModule: SolveLinearMoveModule | null = null;

  // --- Shared refs (set during setup) ---
  private dataBuffer: ParticleDataBuffer;
  private renderer: ParticleSystemRenderer;
  private options: { maxCount: number, gravity: vec3, gravityModifier: ValueGetter<number>, speedOverLifetime?: ValueGetter<number>, forceTarget?: any, particleFollowParent?: boolean, linearVelOverLifetime?: any, orbitalVelOverLifetime?: any };
  private emission: { rateOverTime: ValueGetter<number>, bursts: Burst[], burstOffsets: Record<string, vec3[] | null> };
  private shape: ShapeGenerator;
  private trails?: TrailConfig;
  private getPointPositionF64: (index: number) => Vector3;

  setup (opts: {
    dataBuffer: ParticleDataBuffer,
    renderer: ParticleSystemRenderer,
    options: ParticleEmitter['options'],
    emission: ParticleEmitter['emission'],
    shape: ShapeGenerator,
    trails?: TrailConfig,
    getPointPositionF64: (index: number) => Vector3,
  }): void {
    this.dataBuffer = opts.dataBuffer;
    this.renderer = opts.renderer;
    this.options = opts.options;
    this.emission = opts.emission;
    this.shape = opts.shape;
    this.trails = opts.trails;
    this.getPointPositionF64 = opts.getPointPositionF64;
  }

  reset (): void {
    this.aliveCount = 0;
    this.nextSlotIndex = 0;
    this.generatedCount = 0;
    this.upDirectionWorld = null;
  }

  // ========================
  // Stage 1: Emitter Update
  // ========================

  particleUpdateAndSync (ctx: TickContext): void {
    const db = this.dataBuffer;

    this.particleUpdate(ctx, db);
    this.syncToGeometry(db);
  }

  emitterUpdateAndSpawn (ctx: TickContext): void {
    const db = this.dataBuffer;
    const maxCount = this.options.maxCount;
    const spawnResult = this.spawnRateModule.compute(ctx.timePassed, ctx.emitterLifetime);

    this.particleSpawn(ctx, db, maxCount, spawnResult);
  }

  // ========================
  // Stage 2: Particle Update
  // ========================

  private particleUpdate (ctx: TickContext, db: ParticleDataBuffer): void {
    if (db.activeCount === 0) {
      return;
    }

    const moduleCtx: ParticleModuleContext = {
      deltaTime: ctx.deltaTime,
      currentTime: ctx.currentTime,
      emitterLifetime: ctx.emitterLifetime,
      duration: ctx.duration,
      dataBuffer: db,
      firstIndex: 0,
      lastIndex: db.activeCount,
    };

    this.solveVelocityModule?.execute(moduleCtx);
    this.solveRotationModule?.execute(moduleCtx);
    this.solveLinearMoveModule?.execute(moduleCtx);
  }

  // ========================
  // Stage 3: Sync to Geometry
  // ========================

  private syncToGeometry (db: ParticleDataBuffer): void {
    if (db.activeCount === 0) {
      return;
    }
    const geometry = this.renderer.particleMesh.geometry;

    const aTranslation = geometry.getAttributeData('aTranslation') as Float32Array;
    const count = Math.min(db.activeCount, Math.floor(aTranslation.length / 12));

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const gOff = i * 12;
      const tx = db.translation[i3];
      const ty = db.translation[i3 + 1];
      const tz = db.translation[i3 + 2];

      for (let v = 0; v < 4; v++) {
        const vOff = gOff + v * 3;

        aTranslation[vOff] = tx;
        aTranslation[vOff + 1] = ty;
        aTranslation[vOff + 2] = tz;
      }
    }
    geometry.setAttributeData('aTranslation', aTranslation);

    const aRotation0 = geometry.getAttributeData('aRotation0') as Float32Array;
    const rotCount = Math.min(db.activeCount, Math.floor(aRotation0.length / 36));

    for (let i = 0; i < rotCount; i++) {
      const i9 = i * 9;
      const gOff = i * 36;

      for (let v = 0; v < 4; v++) {
        const vOff = gOff + v * 9;

        for (let c = 0; c < 9; c++) {
          aRotation0[vOff + c] = db.rotMatrix[i9 + c];
        }
      }
    }
    geometry.setAttributeData('aRotation0', aRotation0);

    const aLinearMove = geometry.getAttributeData('aLinearMove') as Float32Array;
    const lmCount = Math.min(db.activeCount, Math.floor(aLinearMove.length / 12));

    for (let i = 0; i < lmCount; i++) {
      const i3 = i * 3;
      const gOff = i * 12;
      const mx = db.linearMove[i3];
      const my = db.linearMove[i3 + 1];
      const mz = db.linearMove[i3 + 2];

      for (let v = 0; v < 4; v++) {
        const vOff = gOff + v * 3;

        aLinearMove[vOff] = mx;
        aLinearMove[vOff + 1] = my;
        aLinearMove[vOff + 2] = mz;
      }
    }
    geometry.setAttributeData('aLinearMove', aLinearMove);
  }

  // ========================
  // Stage 4: Particle Spawn
  // ========================

  private particleSpawn (
    ctx: TickContext,
    db: ParticleDataBuffer,
    maxCount: number,
    spawnResult: { pointCount: number, timeDelta: number },
  ): void {
    const emission = this.emission;
    const worldMatrix = ctx.worldMatrix;
    const maxEmissionCount = spawnResult.pointCount;
    const timeDelta = spawnResult.timeDelta;
    const meshTime = ctx.currentTime;

    const shouldSkipGenerate = () => {
      if (ctx.emissionStopped) {
        return true;
      }
      if (this.aliveCount < maxCount) {
        return false;
      }
      let minExp = Infinity;

      for (let s = 0; s < db.maxCount; s++) {
        if (db.alive[s] && db.expiry[s] < minExp) {
          minExp = db.expiry[s];
        }
      }

      return (minExp - ctx.loopStartTime) > ctx.timePassed;
    };

    // Rate-based spawning
    for (let i = 0; i < maxEmissionCount && i < maxCount; i++) {
      if (shouldSkipGenerate()) {
        break;
      }
      const slotIdx = this.allocateSlot(maxCount);
      const generator = {
        total: emission.rateOverTime.getValue(ctx.emitterLifetime),
        index: this.generatedCount,
        burstIndex: 0,
        burstCount: 0,
      };

      this.generatedCount++;
      const result = this.initParticleModule.initializeToBuffer(
        this.shape.generate(generator), ctx.emitterLifetime, worldMatrix, ctx.emitterTransform, this.upDirectionWorld, slotIdx, db,
      );

      this.upDirectionWorld = result.upDirectionWorld;

      db.delay[slotIdx] += meshTime + i * timeDelta;
      db.delayF64[slotIdx] += meshTime + i * timeDelta;
      this.commitParticle(slotIdx, maxCount, db, ctx.parentTransformPosition);
      this.spawnRateModule.commitEmit(ctx.timePassed);
    }

    // Burst spawning
    const bursts = emission.bursts;

    for (let j = bursts?.length - 1, cursor = 0; j >= 0 && cursor < maxCount; j--) {
      if (shouldSkipGenerate()) {
        break;
      }
      const burst = bursts[j];
      const opts = !burst.disabled && burst.getGeneratorOptions(ctx.timePassed, ctx.emitterLifetime);

      if (opts) {
        const originVec = [0, 0, 0] as vec3;
        const offsets = emission.burstOffsets[j];
        const burstOffset = (offsets && offsets[opts.cycleIndex]) || originVec;

        if (burst.once) {
          emission.burstOffsets[j] = null;
          emission.bursts.splice(j, 1);
        }

        for (let i = 0; i < opts.count && cursor < maxCount; i++) {
          if (shouldSkipGenerate()) {
            break;
          }
          const slotIdx = this.allocateSlot(maxCount);
          const result = this.initParticleModule.initializeToBuffer(
            this.shape.generate({
              total: opts.total,
              index: opts.index,
              burstIndex: i,
              burstCount: opts.count,
            }), ctx.emitterLifetime, worldMatrix, ctx.emitterTransform, this.upDirectionWorld, slotIdx, db,
          );

          this.upDirectionWorld = result.upDirectionWorld;
          const si3 = slotIdx * 3;

          db.delay[slotIdx] += meshTime;
          db.delayF64[slotIdx] += meshTime;
          db.position[si3] += burstOffset[0];
          db.position[si3 + 1] += burstOffset[1];
          db.position[si3 + 2] += burstOffset[2];
          db.positionF64[si3] += burstOffset[0];
          db.positionF64[si3 + 1] += burstOffset[1];
          db.positionF64[si3 + 2] += burstOffset[2];
          cursor++;
          this.commitParticle(slotIdx, maxCount, db, ctx.parentTransformPosition);
        }
      }
    }
  }

  // ========================
  // Stage 5: Trail Update
  // ========================

  trailUpdate (ctx: TickContext, db?: ParticleDataBuffer): void {
    db = db ?? this.dataBuffer;
    if (!this.trails || !db) {
      return;
    }

    for (let ti = 0; ti < db.activeCount; ti++) {
      if (!db.alive[ti]) {
        continue;
      }
      if (db.expiry[ti] < ctx.timePassed) {
        if (this.trails.dieWithParticles) {
          this.renderer.clearTrail(ti);
        }
      } else if (ctx.timePassed > db.delayF64[ti]) {
        const position = this.getPointPositionF64(ti);
        const color = this.trails.inheritParticleColor ? this.renderer.getParticlePointColor(ti) : [1, 1, 1, 1];
        const si2 = ti * 2;
        const size: vec3 = [db.sizeF64[si2], db.sizeF64[si2 + 1], 1];

        let width = 1;
        let lifetime = this.trails.lifetime.getValue(ctx.emitterLifetime);

        if (this.trails.sizeAffectsWidth) {
          width *= size[0];
        }
        if (this.trails.sizeAffectsLifetime) {
          lifetime *= size[0];
        }
        if (this.trails.parentAffectsPosition && ctx.parentTransformPosition) {
          position.add(ctx.parentTransformPosition);
          const pos = this.renderer.getTrailStartPosition(ti);

          if (pos) {
            position.subtract(pos);
          }
        }
        this.renderer.addTrailPoint(ti, position, {
          color,
          lifetime,
          size: width,
          time: db.delayF64[ti],
        });
      }
    }
  }

  // ========================
  // Helpers
  // ========================

  private allocateSlot (maxCount: number): number {
    if (this.nextSlotIndex < maxCount) {
      return this.nextSlotIndex++;
    }

    return this.findOldestSlot();
  }

  private findOldestSlot (): number {
    const db = this.dataBuffer;
    let minIdx = 0;
    let minExpiry = Infinity;

    for (let i = 0; i < db.maxCount; i++) {
      if (db.alive[i] && db.expiry[i] <= minExpiry) {
        minExpiry = db.expiry[i];
        minIdx = i;
      }
    }

    return minIdx;
  }

  private commitParticle (slotIndex: number, maxCount: number, db: ParticleDataBuffer, parentTransformPosition: Vector3 | null): void {
    db.alive[slotIndex] = 1;
    db.expiry[slotIndex] = db.delayF64[slotIndex] + db.lifetimeF64[slotIndex];
    this.aliveCount = Math.min(this.aliveCount + 1, maxCount);

    db.seed[slotIndex] = Math.random();
    this.renderer.particleMesh.setPointFromBuffer(slotIndex, db);
    if (this.trails?.dieWithParticles) {
      this.renderer.clearTrail(slotIndex);
    }
    if (parentTransformPosition) {
      this.renderer.setTrailStartPosition(slotIndex, parentTransformPosition.clone());
    }
  }
}
