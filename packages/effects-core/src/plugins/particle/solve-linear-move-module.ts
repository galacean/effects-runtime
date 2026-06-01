import type { ValueGetter } from '../../math';
import { RandomValue } from '../../math';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

type LinearVelOverLifetimeConfig = {
  asMovement?: boolean,
  enabled?: boolean,
  x?: ValueGetter<number>,
  y?: ValueGetter<number>,
  z?: ValueGetter<number>,
};

/**
 * 线性位移模块。对应老代码 ParticleMesh.applyLinearMove。
 *
 * 每帧对所有存活粒子：
 * 1. 读取 linearVelOverLifetime 配置
 * 2. asMovement 模式：直接取 getValue (位移值)
 *    非 asMovement 模式：取 getIntegrateValue (速度积分)
 * 3. 写入 linearMove 通道
 */
export class SolveLinearMoveModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private linearVelOverLifetime?: LinearVelOverLifetimeConfig;

  constructor (opts: {
    linearVelOverLifetime?: LinearVelOverLifetimeConfig,
  }) {
    super();
    this.linearVelOverLifetime = opts.linearVelOverLifetime;
  }

  override execute (ctx: ParticleModuleContext): void {
    const lv = this.linearVelOverLifetime;

    if (!lv?.enabled) {
      return;
    }

    const db = ctx.dataBuffer;
    const currentTime = ctx.currentTime;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i3 = i * 3;
      const time = currentTime - db.delay[i];
      const duration = db.lifetime[i];
      const lifetime = time / duration;
      const seed = db.seed[i];

      let mx = 0;
      let my = 0;
      let mz = 0;

      if (lv.asMovement) {
        if (lv.x) {
          mx = lv.x instanceof RandomValue ? lv.x.getValue(lifetime, seed) : lv.x.getValue(lifetime);
        }
        if (lv.y) {
          my = lv.y instanceof RandomValue ? lv.y.getValue(lifetime, seed) : lv.y.getValue(lifetime);
        }
        if (lv.z) {
          mz = lv.z instanceof RandomValue ? lv.z.getValue(lifetime, seed) : lv.z.getValue(lifetime);
        }
      } else {
        if (lv.x) {
          mx = lv.x instanceof RandomValue
            ? lv.x.getIntegrateValue(0, time, seed)
            : lv.x.getIntegrateValue(0, time, duration);
        }
        if (lv.y) {
          my = lv.y instanceof RandomValue
            ? lv.y.getIntegrateValue(0, time, seed)
            : lv.y.getIntegrateValue(0, time, duration);
        }
        if (lv.z) {
          mz = lv.z instanceof RandomValue
            ? lv.z.getIntegrateValue(0, time, seed)
            : lv.z.getIntegrateValue(0, time, duration);
        }
      }

      db.linearMove[i3] = mx;
      db.linearMove[i3 + 1] = my;
      db.linearMove[i3 + 2] = mz;
    }
  }
}
