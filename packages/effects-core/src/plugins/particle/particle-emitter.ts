import { Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import type { Burst } from './burst';
import type { InitializeParticleModule } from './initialize-particle-module';
import { SpawnRateModule } from './spawn-rate-module';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleModuleContext, ParticleModuleStage, SpawnInfo } from './particle-module';
import type { ParticleModule } from './particle-module';
import type { ParticleSystemRenderer } from './particle-system-renderer';
import type { ShapeGenerator } from '../../shape';
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
  upDirectionWorld: Vector3 | null = null;
  spawnInfos: SpawnInfo[] = [];

  // --- Config (set after setup) ---
  basicTransform: { position: Vector3, path?: any } = { position: new Vector3() };
  componentTransform: Transform;
  itemDuration = 1;
  endBehaviorValue = 0;

  // --- Modules ---
  initParticleModule: InitializeParticleModule;
  private modules: ParticleModule[] = [];
  private spawnRateRef: SpawnRateModule | null = null;

  // --- Shared refs (set during setup) ---
  private dataBuffer: ParticleDataBuffer;
  private renderer: ParticleSystemRenderer;
  private options: { maxCount: number, looping?: boolean, gravity: vec3, gravityModifier: ValueGetter<number>, speedOverLifetime?: ValueGetter<number>, forceTarget?: any, particleFollowParent?: boolean, linearVelOverLifetime?: any, orbitalVelOverLifetime?: any };
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
    modules: ParticleModule[],
    trails?: TrailConfig,
    getPointPositionF64: (index: number) => Vector3,
  }): void {
    this.dataBuffer = opts.dataBuffer;
    this.renderer = opts.renderer;
    this.options = opts.options;
    this.emission = opts.emission;
    this.shape = opts.shape;
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
    this.syncToGeometry(db);
  }

  private emitterUpdateAndSpawn (delta: number): void {
    const db = this.dataBuffer;
    const maxCount = this.options.maxCount;

    this.spawnInfos.length = 0;
    this.runStage('emitterUpdate', this.buildModuleContext(delta / 1000));

    for (const info of this.spawnInfos) {
      this.particleSpawn(db, maxCount, info);
    }
    this.burstSpawn(db, maxCount);
  }

  // ========================
  // Stage 3: Sync to Geometry
  // ========================

  private syncToGeometry (db: ParticleDataBuffer): void {
    if (db.activeCount === 0) {
      return;
    }
    const geo = this.renderer.particleMesh.geometry;

    this.expandToQuad(geo, 'aTranslation', db.translation, db.activeCount, 3);
    this.expandToQuad(geo, 'aLinearMove', db.linearMove, db.activeCount, 3);
    this.expandToQuad(geo, 'aRotation0', db.rotMatrix, db.activeCount, 9);
  }

  private expandToQuad (geo: any, attr: string, src: Float32Array, count: number, stride: number): void {
    const dst = geo.getAttributeData(attr) as Float32Array;
    const n = Math.min(count, Math.floor(dst.length / (stride * 4)));

    for (let i = 0; i < n; i++) {
      const si = i * stride;
      const di = i * stride * 4;

      for (let v = 0; v < 4; v++) {
        const vo = di + v * stride;

        for (let c = 0; c < stride; c++) {
          dst[vo + c] = src[si + c];
        }
      }
    }
    geo.setAttributeData(attr, dst);
  }

  // ========================
  // Stage 4: Particle Spawn
  // ========================

  private particleSpawn (
    db: ParticleDataBuffer,
    maxCount: number,
    spawnInfo: SpawnInfo,
  ): void {
    const worldMatrix = this.getWorldMatrix();
    const maxEmissionCount = spawnInfo.count;
    const timeDelta = spawnInfo.timeDelta;
    const meshTime = this.time;

    for (let i = 0; i < maxEmissionCount && i < maxCount; i++) {
      if (this.shouldSkipGenerate(db, maxCount)) {
        break;
      }
      const slotIdx = this.allocateSlot(maxCount);
      const generator = {
        total: this.emission.rateOverTime.getValue(this.emitterLifetime),
        index: this.generatedCount,
        burstIndex: 0,
        burstCount: 0,
      };

      this.generatedCount++;
      const result = this.initParticleModule.initializeToBuffer(
        this.shape.generate(generator), this.emitterLifetime, worldMatrix, this.componentTransform, this.upDirectionWorld, slotIdx, db,
      );

      this.upDirectionWorld = result.upDirectionWorld;

      db.delay[slotIdx] += meshTime + i * timeDelta;
      db.delayF64[slotIdx] += meshTime + i * timeDelta;
      this.commitParticle(slotIdx, maxCount, db);
      this.commitSpawnRate(this.timePassed);
    }

  }

  private burstSpawn (db: ParticleDataBuffer, maxCount: number): void {
    const emission = this.emission;
    const worldMatrix = this.getWorldMatrix();
    const meshTime = this.time;
    const bursts = emission.bursts;

    for (let j = bursts?.length - 1, cursor = 0; j >= 0 && cursor < maxCount; j--) {
      if (this.shouldSkipGenerate(db, maxCount)) {
        break;
      }
      const burst = bursts[j];
      const opts = !burst.disabled && burst.getGeneratorOptions(this.timePassed, this.emitterLifetime);

      if (opts) {
        const offsets = emission.burstOffsets[j];
        const burstOffset = (offsets && offsets[opts.cycleIndex]) || ORIGIN_VEC;

        if (burst.once) {
          emission.burstOffsets[j] = null;
          emission.bursts.splice(j, 1);
        }

        for (let i = 0; i < opts.count && cursor < maxCount; i++) {
          if (this.shouldSkipGenerate(db, maxCount)) {
            break;
          }
          const slotIdx = this.allocateSlot(maxCount);
          const result = this.initParticleModule.initializeToBuffer(
            this.shape.generate({
              total: opts.total,
              index: opts.index,
              burstIndex: i,
              burstCount: opts.count,
            }), this.emitterLifetime, worldMatrix, this.componentTransform, this.upDirectionWorld, slotIdx, db,
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
          this.commitParticle(slotIdx, maxCount, db);
        }
      }
    }
  }

  // ========================
  // Stage 5: Trail Update
  // ========================

  private trailUpdated = false;

  private updateTrails (): void {
    if (this.trailUpdated || !this.trails) {
      return;
    }
    this.trailUpdated = true;
    const db = this.dataBuffer;

    for (let ti = 0; ti < db.activeCount; ti++) {
      if (!db.alive[ti]) {
        continue;
      }
      if (db.expiry[ti] < this.timePassed) {
        if (this.trails.dieWithParticles) {
          this.renderer.clearTrail(ti);
        }
      } else if (this.timePassed > db.delayF64[ti]) {
        const position = this.getPointPositionF64(ti);
        const color = this.trails.inheritParticleColor ? this.renderer.getParticlePointColor(ti) : [1, 1, 1, 1];
        const si2 = ti * 2;
        const size: vec3 = [db.sizeF64[si2], db.sizeF64[si2 + 1], 1];

        let width = 1;
        let lifetime = this.trails.lifetime.getValue(this.emitterLifetime);

        if (this.trails.sizeAffectsWidth) {
          width *= size[0];
        }
        if (this.trails.sizeAffectsLifetime) {
          lifetime *= size[0];
        }
        if (this.trails.parentAffectsPosition && this.parentTransformPosition) {
          position.add(this.parentTransformPosition);
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

  private shouldSkipGenerate (db: ParticleDataBuffer, maxCount: number): boolean {
    if (this.emissionStopped) {
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

    return (minExp - this.loopStartTime) > this.timePassed;
  }

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
