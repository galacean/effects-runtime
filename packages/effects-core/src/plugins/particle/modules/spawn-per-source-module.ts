import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext, SourceDependentModule } from '../core/particle-module';
import type { ParticleEmitter } from '../emitter/particle-emitter';

export interface SourceAssignment {
  srcIdx: number,
  count: number,
  uniqueID: number,
}

export type SpawnPerSourceModuleData = {
  dieWithParticles: boolean,
};

/**
 * trail 产点模块（无抑制 spawn 模型）。
 *
 * 每个 age>0 的 source 粒子每帧固定产 1 个 trail 点；不按距离阈值抑制 spawn。
 * trail 头随 source 移动靠「每帧新点 position = source 当前 position」天然跟随，
 * 无需钉头补丁。点数密度由渲染侧 MinSegmentLength 抽取控制（跳过太近的 segment）；
 * 点数总量由 trail 粒子 lifetime 自然回收 + 分配策略（AutomaticEstimate 扩容）兜底。
 */
export class SpawnPerSourceParticleModule extends ParticleModule implements SourceDependentModule {
  override readonly stage = ParticleModuleStage.EmitterUpdate;

  readonly sourceAssignments: SourceAssignment[] = [];
  readonly aliveSourceIds = new Set<number>();
  dieWithParticles = true;

  // source emitter 由 setSource 在构造后注入
  private sourceEmitter!: ParticleEmitter;

  override fromJSON (data: SpawnPerSourceModuleData): void {
    this.dieWithParticles = data.dieWithParticles;
  }

  setSource (source: ParticleEmitter): void {
    this.sourceEmitter = source;
  }

  override execute (ctx: ParticleModuleContext): void {
    this.sourceAssignments.length = 0;
    this.aliveSourceIds.clear();

    const sourceDb = this.sourceEmitter.dataBuffer;

    if (sourceDb.numInstances === 0) {
      return;
    }

    let totalCount = 0;

    for (let i = 0; i < sourceDb.numInstances; i++) {
      if (sourceDb.age[i] <= 0) {
        continue;
      }
      const uid = sourceDb.uniqueId[i];

      this.aliveSourceIds.add(uid);
      this.sourceAssignments.push({ srcIdx: i, count: 1, uniqueID: uid });
      totalCount++;
    }

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
}
