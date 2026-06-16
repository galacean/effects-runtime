import type * as spec from '@galacean/effects-specification';
import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { ParticleModule, ParticleModuleStage } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export type GravityForceModuleData = {
  gravity: vec3,
  gravityModifier: spec.NumberExpression | number,
};

/**
 * 重力模块。对齐 Pro 的 ProGravityForceModule。
 *
 * 每帧：velocity += gravity * gravityModifier(life) * dt
 */
export class GravityForceModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  private gravity!: vec3;
  private gravityModifier!: ValueGetter<number>;

  override fromJSON (data: GravityForceModuleData): void {
    this.gravity = data.gravity;
    this.gravityModifier = createValueGetter(data.gravityModifier);
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const dtSec = ctx.deltaTime;
    const gx = this.gravity[0];
    const gy = this.gravity[1];
    const gz = this.gravity[2];

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const age = db.age[i];

      if (age <= 0) {
        continue;
      }

      const i3 = i * 3;
      const life = age / db.lifetime[i];
      const gMod = this.gravityModifier.getValue(life);

      db.velocity[i3] += gx * gMod * dtSec;
      db.velocity[i3 + 1] += gy * gMod * dtSec;
      db.velocity[i3 + 2] += gz * gMod * dtSec;
    }
  }
}
