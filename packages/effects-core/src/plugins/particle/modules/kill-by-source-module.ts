import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext } from '../core/particle-module';
import type { SpawnPerSourceParticleModule } from './spawn-per-source-module';

export class KillBySourceModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  constructor (private readonly spawnModule: SpawnPerSourceParticleModule) {
    super();
  }

  override execute (ctx: ParticleModuleContext): void {
    if (!this.spawnModule.dieWithParticles) {
      return;
    }
    const db = ctx.dataBuffer;
    const alive = this.spawnModule.aliveSourceIds;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      if (db.age[i] > 0 && !alive.has(db.ribbonId[i])) {
        // 源粒子已死，标记 trail 粒子死亡，由 compactDead 压缩移除
        db.alive[i] = 0;
      }
    }
  }
}
