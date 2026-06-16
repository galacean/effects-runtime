import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { createValueGetter, RandomValue } from '../../math';
import { ParticleModule, ParticleModuleStage } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

export type ScaleSizeModuleData = {
  x: spec.NumberExpression | number,
  y?: spec.NumberExpression | number,
  separateAxes?: boolean,
};

/**
 * Size over lifetime 模块。对齐 Pro 的 ScaleSpriteSizeModule。
 *
 * 每帧读 initialSize，乘以 sizeOverLifetime 曲线值，覆写 db.size。
 */
export class ScaleSizeModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  private x!: ValueGetter<number>;
  private y?: ValueGetter<number>;
  private separateAxes = false;

  override fromJSON (data: ScaleSizeModuleData): void {
    this.x = createValueGetter(data.x);
    this.y = data.y ? createValueGetter(data.y) : undefined;
    this.separateAxes = !!data.separateAxes;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const { x, y, separateAxes } = this;

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
      const seed = db.seed[i];

      const sx = x instanceof RandomValue ? x.getValue(life, seed) : x.getValue(life);
      const sy = separateAxes && y
        ? (y instanceof RandomValue ? y.getValue(life, seed) : y.getValue(life))
        : sx;

      db.size[i2] = db.initialSize[i2] * sx;
      db.size[i2 + 1] = db.initialSize[i2 + 1] * sy;
    }
  }
}
