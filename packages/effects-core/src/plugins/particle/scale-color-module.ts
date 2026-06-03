import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { ScaleColorModuleData } from './parse-spec';
import { colorStopsFromGradient, interpolateColor } from '../../utils/color';

type ColorStop = { time: number, color: { toArray: () => number[] } };

/**
 * Color / Opacity over lifetime 模块。对齐 Pro 的 ScaleColorModule。
 *
 * 每帧计算 colorScale = gradientColor(life) * opacity(life)，
 * 写入 db.colorScale。shader 读 aColorScale 替代 GPU texture 采样 + 曲线求值。
 */
export class ScaleColorModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private data: ScaleColorModuleData;
  private gradientStops: ColorStop[] | null = null;

  constructor (data: ScaleColorModuleData) {
    super();
    this.data = data;
    if (data.color) {
      this.gradientStops = colorStopsFromGradient(data.color);
    }
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const currentTime = ctx.currentTime;
    const { opacity } = this.data;
    const stops = this.gradientStops;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i4 = i * 4;
      const delay = db.delay[i];

      if (delay > currentTime) {
        db.colorScale[i4] = 0;
        db.colorScale[i4 + 1] = 0;
        db.colorScale[i4 + 2] = 0;
        db.colorScale[i4 + 3] = 0;

        continue;
      }

      const time = currentTime - delay;
      const duration = db.lifetime[i];
      const life = Math.min(Math.max(time / duration, 0), 1);

      let r = 1, g = 1, b = 1, a = 1;

      if (stops && stops.length > 0) {
        const color = this.sampleGradient(stops, life);

        r = color[0] / 255;
        g = color[1] / 255;
        b = color[2] / 255;
        a = color[3] / 255;
      }

      if (opacity) {
        a *= Math.min(Math.max(opacity.getValue(life), 0), 1);
      }

      db.colorScale[i4] = r;
      db.colorScale[i4 + 1] = g;
      db.colorScale[i4 + 2] = b;
      db.colorScale[i4 + 3] = a;
    }
  }

  private sampleGradient (stops: ColorStop[], t: number): number[] {
    if (t <= stops[0].time) {
      return stops[0].color.toArray();
    }
    if (t >= stops[stops.length - 1].time) {
      return stops[stops.length - 1].color.toArray();
    }
    for (let j = 0; j < stops.length - 1; j++) {
      const s0 = stops[j];
      const s1 = stops[j + 1];

      if (s0.time <= t && s1.time > t) {
        return interpolateColor(s0.color.toArray(), s1.color.toArray(), (t - s0.time) / (s1.time - s0.time));
      }
    }

    return [255, 255, 255, 255];
  }
}
