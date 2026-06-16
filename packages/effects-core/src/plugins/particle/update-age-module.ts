import { ParticleModule, ParticleModuleStage } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export class UpdateAgeModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const dt = ctx.deltaTime;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      if (!db.alive[i]) { continue; }
      db.age[i] += dt;
    }
  }
}
