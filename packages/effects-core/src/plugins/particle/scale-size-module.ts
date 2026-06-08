import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ScaleSizeModuleData } from './parse-spec';

/**
 * Size over lifetime 模块。对齐 Pro 的 ScaleSpriteSizeModule。
 *
 * 每帧读 initialSize，乘以 sizeOverLifetime 曲线值，覆写 db.size。
 */
export class ScaleSizeModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private data: ScaleSizeModuleData;

  constructor (data: ScaleSizeModuleData) {
    super();
    this.data = data;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const { x, y, separateAxes } = this.data;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i2 = i * 2;
      const time = db.age[i];

      if (time < 0) {
        db.size[i2] = 0;
        db.size[i2 + 1] = 0;

        continue;
      }

      const duration = db.lifetime[i];
      const life = Math.min(Math.max(time / duration, 0), 1);

      const sx = x.getValue(life);
      const sy = separateAxes && y ? y.getValue(life) : sx;

      db.size[i2] = db.initialSize[i2] * sx;
      db.size[i2 + 1] = db.initialSize[i2 + 1] * sy;
    }
  }
}
