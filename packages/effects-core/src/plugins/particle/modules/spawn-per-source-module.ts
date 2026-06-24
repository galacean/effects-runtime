import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext, SourceDependentModule } from '../core/particle-module';
import type { ParticleDataBuffer } from '../core/particle-data-buffer';
import type { ParticleEmitter } from '../emitter/particle-emitter';

export interface SourceAssignment {
  srcIdx: number,
  count: number,
  uniqueID: number,
}

export type SpawnPerSourceModuleData = {
  minimumDistSq: number,
  dieWithParticles: boolean,
};

export class SpawnPerSourceParticleModule extends ParticleModule implements SourceDependentModule {
  override readonly stage = ParticleModuleStage.EmitterUpdate;

  readonly sourceAssignments: SourceAssignment[] = [];
  readonly aliveSourceIds = new Set<number>();
  dieWithParticles = true;

  // source emitter 由 setSource 在构造后注入；dataBuffer 经 getter 实时读取
  private sourceEmitter!: ParticleEmitter;
  private minimumDistSq = 0;

  /**
   * 每条 ribbon 当前头槽（该 ribbon 内 alive、age>0、ribbonLinkOrder 最大的 slot）。
   * execute 开头一次 O(buffer) 分桶重建，updateRibbonHead 查表钉头，
   * 取代原先每个 source 扫描整个 buffer 的 O(source × buffer)。
   */
  private readonly ribbonHeads = new Map<number, number>();

  override fromJSON (data: SpawnPerSourceModuleData): void {
    this.minimumDistSq = data.minimumDistSq;
    this.dieWithParticles = data.dieWithParticles;
  }

  setSource (source: ParticleEmitter): void {
    this.sourceEmitter = source;
  }

  private get checkDistance (): boolean {
    return this.minimumDistSq > 0;
  }

  private lastPositions = new Map<number, [number, number, number]>();

  override execute (ctx: ParticleModuleContext): void {
    this.sourceAssignments.length = 0;
    this.aliveSourceIds.clear();

    const sourceDb = this.sourceEmitter.dataBuffer;

    if (sourceDb.numInstances === 0) {
      return;
    }

    // O(buffer) 一次分桶：建立 ribbonId → 头槽（alive、age>0、最大 ribbonLinkOrder）。
    // 与原 updateRibbonHead 内层扫描判据逐 bez 一致，钉的槽不变。
    const db = ctx.dataBuffer;

    this.ribbonHeads.clear();
    for (let i = 0; i < db.numInstances; i++) {
      if (!db.alive[i] || db.age[i] <= 0) {
        continue;
      }
      const rid = db.ribbonId[i];
      const cur = this.ribbonHeads.get(rid);

      if (cur === undefined || db.ribbonLinkOrder[i] > db.ribbonLinkOrder[cur]) {
        this.ribbonHeads.set(rid, i);
      }
    }

    let totalCount = 0;

    for (let i = 0; i < sourceDb.numInstances; i++) {
      if (sourceDb.age[i] <= 0) {
        continue;
      }

      const uid = sourceDb.uniqueId[i];

      this.aliveSourceIds.add(uid);

      const i3 = i * 3;
      const x = sourceDb.position[i3];
      const y = sourceDb.position[i3 + 1];
      const z = sourceDb.position[i3 + 2];

      this.updateRibbonHead(db, uid, x, y, z);

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
    // 头槽由 execute 开头的分桶表给出（与原内层扫描判据一致）。无 age>0 头时表中无项，不钉头。
    const bestSlot = this.ribbonHeads.get(ribbonId);

    if (bestSlot === undefined) {
      return;
    }
    const h3 = bestSlot * 3;

    db.position[h3] = x;
    db.position[h3 + 1] = y;
    db.position[h3 + 2] = z;
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
