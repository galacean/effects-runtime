import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ScaleSizeModuleData } from './parse-spec';

/**
 * Size over lifetime 模块。对齐 Pro 的 ScaleSpriteSizeModule。
 *
 * 每帧计算 sizeScale = sizeOverLifetime.getValue(life)，
 * 写入 db.sizeScale。shader 读 aSize 替代 GPU 曲线求值。
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
        db.sizeScale[i2] = 0;
        db.sizeScale[i2 + 1] = 0;

        continue;
      }

      const duration = db.lifetime[i];
      const life = Math.min(Math.max(time / duration, 0), 1);

      const sx = x.getValue(life);

      db.sizeScale[i2] = sx;
      db.sizeScale[i2 + 1] = separateAxes && y ? y.getValue(life) : sx;
    }
  }
}
