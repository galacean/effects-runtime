import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext, SourceDependentModule } from '../core/particle-module';
import type { ParticleEmitter } from '../emitter/particle-emitter';

export type KillBySourceModuleData = {
  dieWithParticles: boolean,
};

/**
 * source 死亡同步击杀 trail 模块（现场读 source 存活集）。
 *
 * 对每个 trail 粒子，现场查其 ribbonId 对应的 source 是否仍在 source emitter 的
 * aliveUniqueIds 集中。不在（source 已死，被 compact 移除时从集合删除）→ 标记 trail
 * 死亡（compactDead 压缩移除）。因同 ribbon 的 trail 共享同一个 source ribbonId，
 * source 一死则整条 ribbon 同帧被杀——即「整条 trail 随 source 消失」。
 *
 * 对齐成熟实现 by 粒子 ID 反查 source 存活表的范式。dieWithParticles 关闭时空跑。
 */
export class KillBySourceModule extends ParticleModule implements SourceDependentModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  private dieWithParticles = true;
  // source emitter 由 setSource 在构造后注入
  private sourceEmitter!: ParticleEmitter;

  override fromJSON (data: KillBySourceModuleData): void {
    this.dieWithParticles = data.dieWithParticles;
  }

  setSource (source: ParticleEmitter): void {
    this.sourceEmitter = source;
  }

  override execute (ctx: ParticleModuleContext): void {
    if (!this.dieWithParticles) {
      return;
    }
    const db = ctx.dataBuffer;
    const alive = this.sourceEmitter.aliveUniqueIds;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      if (db.age[i] > 0 && !alive.has(db.ribbonId[i])) {
        // 源粒子已死，标记 trail 粒子死亡，由 compactDead 压缩移除
        db.alive[i] = 0;
      }
    }
  }
}
