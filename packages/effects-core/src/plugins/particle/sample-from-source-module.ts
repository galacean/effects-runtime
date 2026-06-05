import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleEmitter } from './particle-emitter';
import type { SpawnPerSourceParticleModule } from './spawn-per-source-module';
import type { ValueGetter } from '../../math';

export interface SampleFromSourceConfig {
  inheritParticleColor: boolean,
  sizeAffectsWidth: boolean,
}

export class SampleFromSourceModule extends ParticleModule {
  override readonly stage = 'particleSpawn' as const;

  constructor (
    private readonly sourceEmitter: ParticleEmitter,
    private readonly spawnModule: SpawnPerSourceParticleModule,
    private readonly trailLifetime: ValueGetter<number>,
    private readonly config: SampleFromSourceConfig,
  ) {
    super();
  }

  private get sourceDb (): ParticleDataBuffer {
    return this.sourceEmitter.dataBuffer;
  }

  override execute (ctx: ParticleModuleContext): void {
    if (!ctx.spawnBatch || ctx.spawnBatch.slotIndices.length === 0) {
      return;
    }
    const { slotIndices } = ctx.spawnBatch;
    const db = ctx.dataBuffer;
    const assignments = this.spawnModule.sourceAssignments;

    if (assignments.length === 0) {
      return;
    }

    let cursor = 0;

    for (const assignment of assignments) {
      for (let k = 0; k < assignment.count && cursor < slotIndices.length; k++, cursor++) {
        const slot = slotIndices[cursor];
        const src = assignment.srcIdx;

        this.initTrailParticle(db, slot, src, assignment.uniqueID, ctx);
      }
    }

    db.activeCount = Math.max(db.activeCount, slotIndices[slotIndices.length - 1] + 1);
  }

  private initTrailParticle (
    db: ParticleDataBuffer, slot: number, src: number,
    ribbonId: number, ctx: ParticleModuleContext,
  ): void {
    const sourceDb = this.sourceDb;
    const s3 = src * 3;
    const d3 = slot * 3;

    db.position[d3] = sourceDb.finalOffset[s3];
    db.position[d3 + 1] = sourceDb.finalOffset[s3 + 1];
    db.position[d3 + 2] = sourceDb.finalOffset[s3 + 2];

    db.ribbonId[slot] = ribbonId;
    db.ribbonLinkOrder[slot] = ctx.emitter.generatedCount + slot;
    db.lifetime[slot] = this.trailLifetime.getValue(ctx.emitterLifetime);
    db.age[slot] = 0;
    db.alive[slot] = 1;
    db.seed[slot] = Math.random();
    db.uniqueId[slot] = ctx.emitter.uniqueIdCounter++;
    db.linearMove[d3] = this.sourceEmitter.emitterAge - sourceDb.age[src];

    const s4 = src * 4;
    const d4 = slot * 4;

    if (this.config.inheritParticleColor) {
      db.color[d4] = sourceDb.color[s4];
      db.color[d4 + 1] = sourceDb.color[s4 + 1];
      db.color[d4 + 2] = sourceDb.color[s4 + 2];
      db.color[d4 + 3] = sourceDb.color[s4 + 3];
    } else {
      db.color[d4] = 1; db.color[d4 + 1] = 1;
      db.color[d4 + 2] = 1; db.color[d4 + 3] = 1;
    }

    const d2 = slot * 2;

    if (this.config.sizeAffectsWidth) {
      db.size[d2] = sourceDb.size[src * 2];
      db.size[d2 + 1] = db.size[d2];
    } else {
      db.size[d2] = 1; db.size[d2 + 1] = 1;
    }
  }
}
