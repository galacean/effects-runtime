import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { SolveVelocityModuleData } from './parse-spec';

/**
 * 速度积分模块。对应老代码 ParticleMesh.applyTranslation。
 *
 * 每帧对所有存活粒子：
 * 1. 读取初始速度 + 重力 + speedOverLifetime 修正
 * 2. 将速度 * dt 累加到 translation 通道
 */
export class SolveVelocityModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private data: SolveVelocityModuleData;

  constructor (data: SolveVelocityModuleData) {
    super();
    this.data = data;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const dtSec = ctx.deltaTime;
    const currentTime = ctx.currentTime;
    const gx = this.data.gravity[0];
    const gy = this.data.gravity[1];
    const gz = this.data.gravity[2];
    const sol = this.data.speedOverLifetime;

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

      const d = this.data.gravityModifier.getIntegrateValue(0, time, duration);
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

      db.position[i3] += vx * dtSec;
      db.position[i3 + 1] += vy * dtSec;
      db.position[i3 + 2] += vz * dtSec;
    }
  }
}
