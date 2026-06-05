import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { SpawnPerSourceParticleModule } from './spawn-per-source-module';

export class KillBySourceModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

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
      if (db.alive[i] && db.age[i] > 0 && !alive.has(db.ribbonId[i])) {
        db.lifetime[i] = 0;
      }
    }
  }
}
