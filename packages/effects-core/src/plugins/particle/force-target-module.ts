import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ForceTargetModuleData } from './parse-spec';

/**
 * 力目标模块。将 shader 中的 FINAL_TARGET mix 搬到 CPU。
 *
 * 读取 finalOffset（已含 translation + orbital + linearMove），
 * 应用 mix(currentPos, target, curve(life))，写回 finalOffset。
 */
export class ForceTargetModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private data: ForceTargetModuleData;

  constructor (data: ForceTargetModuleData) {
    super();
    this.data = data;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const currentTime = ctx.currentTime;
    const { curve, target } = this.data;
    const tx = target[0] ?? 0;
    const ty = target[1] ?? 0;
    const tz = target[2] ?? 0;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i3 = i * 3;
      const delay = db.delay[i];

      if (delay >= currentTime) {
        continue;
      }

      const time = currentTime - delay;
      const duration = db.lifetime[i];
      const life = Math.min(Math.max(time / duration, 0), 1);
      const force = curve.getValue(life);
      const dl = 1 - force;

      const px = db.finalOffset[i3];
      const py = db.finalOffset[i3 + 1];
      const pz = db.finalOffset[i3 + 2];

      db.finalOffset[i3] = px * dl + tx * force;
      db.finalOffset[i3 + 1] = py * dl + ty * force;
      db.finalOffset[i3 + 2] = pz * dl + tz * force;
    }
  }
}
