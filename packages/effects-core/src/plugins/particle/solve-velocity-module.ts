import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

/**
 * 速度积分模块。对应老代码 ParticleMesh.applyTranslation。
 *
 * 每帧对所有存活粒子：
 * 1. 读取初始速度 + 重力 + speedOverLifetime 修正
 * 2. 将速度 * dt 累加到 translation 通道
 */
export class SolveVelocityModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private gravity: vec3;
  private gravityModifier: ValueGetter<number>;
  private speedOverLifetime?: ValueGetter<number>;

  constructor (opts: {
    gravity: vec3,
    gravityModifier: ValueGetter<number>,
    speedOverLifetime?: ValueGetter<number>,
  }) {
    super();
    this.gravity = opts.gravity;
    this.gravityModifier = opts.gravityModifier;
    this.speedOverLifetime = opts.speedOverLifetime;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const dtSec = ctx.deltaTime / 1000;
    const currentTime = ctx.currentTime;
    const gx = this.gravity[0];
    const gy = this.gravity[1];
    const gz = this.gravity[2];
    const sol = this.speedOverLifetime;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const delay = db.delay[i];

      if (delay >= currentTime) {
        continue;
      }

      const i3 = i * 3;
      const time = currentTime - delay;
      const duration = db.lifetime[i];

      let vx = db.velocity[i3];
      let vy = db.velocity[i3 + 1];
      let vz = db.velocity[i3 + 2];

      // 与老代码对齐：始终计算重力+速度修正，即使 gravity=[0,0,0]
      // 老代码 uAcceleration uniform 始终存在，所以此块始终执行
      const d = this.gravityModifier.getIntegrateValue(0, time, duration);
      const ax = gx * d;
      const ay = gy * d;
      const az = gz * d;

      if (sol) {
        const speed = sol.getValue(time / duration);

        vx = vx * speed + ax;
        vy = vy * speed + ay;
        vz = vz * speed + az;
      } else {
        vx += ax;
        vy += ay;
        vz += az;
      }

      db.translation[i3] += vx * dtSec;
      db.translation[i3 + 1] += vy * dtSec;
      db.translation[i3 + 2] += vz * dtSec;
    }
  }
}
