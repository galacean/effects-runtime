import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ParticleDataBuffer } from './particle-data-buffer';

export interface SourceAssignment {
  srcIdx: number,
  count: number,
  uniqueID: number,
}

export class SpawnPerSourceParticleModule extends ParticleModule {
  override readonly stage = 'emitterUpdate' as const;

  readonly sourceAssignments: SourceAssignment[] = [];
  readonly aliveSourceIds = new Set<number>();
  dieWithParticles = true;

  constructor (
    private readonly sourceDataBuffer: ParticleDataBuffer,
    private readonly minimumDistSq: number,
  ) {
    super();
  }

  private get checkDistance (): boolean {
    return this.minimumDistSq > 0;
  }

  private lastPositions = new Map<number, [number, number, number]>();

  override execute (ctx: ParticleModuleContext): void {
    this.sourceAssignments.length = 0;
    this.aliveSourceIds.clear();

    const sourceDb = this.sourceDataBuffer;

    if (sourceDb.activeCount === 0) {
      return;
    }

    let totalCount = 0;

    for (let i = 0; i < sourceDb.activeCount; i++) {
      if (!sourceDb.alive[i] || sourceDb.age[i] >= sourceDb.lifetime[i] || sourceDb.age[i] <= 0) {
        continue;
      }

      const uid = sourceDb.uniqueId[i];

      this.aliveSourceIds.add(uid);

      const i3 = i * 3;
      const x = sourceDb.finalOffset[i3];
      const y = sourceDb.finalOffset[i3 + 1];
      const z = sourceDb.finalOffset[i3 + 2];

      if (this.checkDistance) {
        const last = this.lastPositions.get(uid);

        if (last) {
          const dx = x - last[0], dy = y - last[1], dz = z - last[2];

          if (dx * dx + dy * dy + dz * dz < this.minimumDistSq) {
            continue;
          }
        }
        this.lastPositions.set(uid, [x, y, z]);
      }

      this.sourceAssignments.push({ srcIdx: i, count: 1, uniqueID: uid });
      totalCount++;
    }

    this.gcDeadEntries();

    if (totalCount > 0) {
      ctx.emitter.spawnInfos.push({
        kind: 'rate',
        count: totalCount,
        timeDelta: 0,
        generator: {
          total: totalCount,
          index: 0,
          useGeneratedCountIndex: true,
          burstCount: 0,
        },
      });
    }
  }

  private gcDeadEntries (): void {
    if (this.lastPositions.size > this.aliveSourceIds.size) {
      for (const uid of this.lastPositions.keys()) {
        if (!this.aliveSourceIds.has(uid)) {
          this.lastPositions.delete(uid);
        }
      }
    }
  }
}
