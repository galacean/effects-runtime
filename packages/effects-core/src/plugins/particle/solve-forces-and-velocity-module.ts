import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter } from '../../math';
import { ParticleModule, ParticleModuleStage } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export type SolveForcesAndVelocityModuleData = {
  speedOverLifetime?: spec.NumberExpression | number,
};

/**
 * 位置积分模块。对齐 Pro 的 ProSolveForcesAndVelocityModule。
 *
 * position += velocity * dt
 *
 * 若配置了 speedOverLifetime，则对初始速度分量应用缩放：
 * effectiveVelocity = initialVelocity * speed + (velocity - initialVelocity)
 */
export class SolveForcesAndVelocityModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  private speedOverLifetime?: ValueGetter<number>;

  override fromJSON (data: SolveForcesAndVelocityModuleData): void {
    this.speedOverLifetime = data.speedOverLifetime ? createValueGetter(data.speedOverLifetime) : undefined;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const dtSec = ctx.deltaTime;
    const sol = this.speedOverLifetime;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const age = db.age[i];

      if (age <= 0) {
        continue;
      }

      const i3 = i * 3;

      let vx = db.velocity[i3];
      let vy = db.velocity[i3 + 1];
      let vz = db.velocity[i3 + 2];

      if (sol) {
        const life = age / db.lifetime[i];
        const speed = sol.getValue(life);

        vx = db.initialVelocity[i3] * speed + (vx - db.initialVelocity[i3]);
        vy = db.initialVelocity[i3 + 1] * speed + (vy - db.initialVelocity[i3 + 1]);
        vz = db.initialVelocity[i3 + 2] * speed + (vz - db.initialVelocity[i3 + 2]);
      }

      db.simulatedPosition[i3] += vx * dtSec;
      db.simulatedPosition[i3 + 1] += vy * dtSec;
      db.simulatedPosition[i3 + 2] += vz * dtSec;
    }
  }
}
