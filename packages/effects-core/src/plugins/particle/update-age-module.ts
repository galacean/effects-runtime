import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export class UpdateAgeModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const dt = ctx.deltaTime;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      db.age[i] += dt;
    }
  }
}
