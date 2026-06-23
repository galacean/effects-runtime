import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext } from '../core/particle-module';

/**
 * 年龄更新模块。每帧 age += dt，并在 age 达到 lifetime 时将粒子标记为死亡
 * （alive[i] = 0），由 emitter 的 compactDead 统一压缩移除。
 *
 * 自然死亡通过 alive 标记表达，而非独立的回收阶段。
 */
export class UpdateAgeModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const dt = ctx.deltaTime;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      db.age[i] += dt;
      if (db.age[i] >= db.lifetime[i]) {
        db.alive[i] = 0;
      }
    }
  }
}
