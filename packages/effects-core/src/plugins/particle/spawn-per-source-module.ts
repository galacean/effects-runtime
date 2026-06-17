import { ParticleModule, ParticleModuleStage } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ParticleDataBuffer } from './particle-data-buffer';

export interface SourceAssignment {
  srcIdx: number,
  count: number,
  uniqueID: number,
}

export class SpawnPerSourceParticleModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.EmitterUpdate;

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
      if (!sourceDb.alive[i] || sourceDb.age[i] <= 0) {
        continue;
      }

      const uid = sourceDb.uniqueId[i];

      this.aliveSourceIds.add(uid);

      const i3 = i * 3;
      const x = sourceDb.position[i3];
      const y = sourceDb.position[i3 + 1];
      const z = sourceDb.position[i3 + 2];

      this.updateRibbonHead(ctx.dataBuffer, uid, x, y, z);

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
        count: totalCount,
        timeDelta: 0,
        positionOffset: null,
        generator: {
          total: totalCount,
          index: 0,
          useGeneratedCountIndex: true,
          burstCount: 0,
        },
      });
    }
  }

  private updateRibbonHead (db: ParticleDataBuffer, ribbonId: number, x: number, y: number, z: number): void {
    let bestSlot = -1;
    let bestOrder = -1;

    for (let i = 0; i < db.activeCount; i++) {
      if (db.alive[i] && db.ribbonId[i] === ribbonId && db.age[i] > 0 && db.ribbonLinkOrder[i] > bestOrder) {
        bestOrder = db.ribbonLinkOrder[i];
        bestSlot = i;
      }
    }
    if (bestSlot >= 0) {
      const h3 = bestSlot * 3;

      db.position[h3] = x;
      db.position[h3 + 1] = y;
      db.position[h3 + 2] = z;
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
