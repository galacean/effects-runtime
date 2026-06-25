import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext, SourceDependentModule } from '../core/particle-module';
import type { ParticleEmitter } from '../emitter/particle-emitter';

export type SpawnPerSourceModuleData = {
};

/**
 * trail 产点模块（无抑制 spawn 模型）。
 *
 * 每个 age>0 的 source 粒子每帧固定产 1 个 trail 点。本模块只决定「本帧产多少点」
 * （=存活 source 数），具体「每个新点采哪个 source」由 SampleFromSource 在 particleSpawn
 * 阶段现场 Sequential 决定（第 k 个新点采第 k 个存活 source），不预存绑定列表。
 *
 * source 死亡→trail 同步击杀的判定不再由本模块产中间产物，改由 KillBySource 现场读
 * source.aliveUniqueIds（source emitter 自己维护的存活 ID 集）。
 *
 * trail 头随 source 移动靠「每帧新点 position = source 当前 position」天然跟随，无需
 * 钉头补丁。点数密度由渲染侧 MinSegmentLength 抽取控制；总量由 lifetime 回收 +
 * 分配策略（AutomaticEstimate 扩容）兜底。
 */
export class SpawnPerSourceParticleModule extends ParticleModule implements SourceDependentModule {
  override readonly stage = ParticleModuleStage.EmitterUpdate;

  // source emitter 由 setSource 在构造后注入
  private sourceEmitter!: ParticleEmitter;

  override fromJSON (_data: SpawnPerSourceModuleData): void {
    // 无配置项；dieWithParticles 在 KillBySourceModuleData。
  }

  setSource (source: ParticleEmitter): void {
    this.sourceEmitter = source;
  }

  override execute (ctx: ParticleModuleContext): void {
    const sourceDb = this.sourceEmitter.dataBuffer;

    if (sourceDb.numInstances === 0) {
      return;
    }

    let totalCount = 0;

    for (let i = 0; i < sourceDb.numInstances; i++) {
      if (sourceDb.age[i] <= 0) {
        continue;
      }
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
