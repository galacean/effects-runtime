import type * as spec from '@galacean/effects-specification';
import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export type ForceTargetModuleData = {
  curve: spec.NumberExpression | number,
  target: vec3,
};

/**
 * 力目标模块。将 shader 中的 FINAL_TARGET mix 搬到 CPU。
 *
 * 读取 finalOffset（已含 translation + orbital + linearMove），
 * 应用 mix(currentPos, target, curve(life))，写回 finalOffset。
 */
export class ForceTargetModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private curve!: ValueGetter<number>;
  private target!: vec3;

  override fromJSON (data: ForceTargetModuleData): void {
    this.curve = createValueGetter(data.curve);
    this.target = data.target;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const { curve, target } = this;
    const tx = target[0] ?? 0;
    const ty = target[1] ?? 0;
    const tz = target[2] ?? 0;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i3 = i * 3;
      const time = db.age[i];

      if (time <= 0) {
        continue;
      }

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
