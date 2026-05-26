import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProCurveColor } from '../../curves/pro-curve-color';
import type { ProCurveColorData } from '../../curves/pro-curve-color';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProColorOverLifeModuleProps extends ProModuleProps {
  colorCurve: ProCurveColorData,
}

const tmpColor: [number, number, number, number] = [0, 0, 0, 0];
const tmpCurveOut: [number, number, number, number] = [0, 0, 0, 0];

/**
 * 颜色随生命周期变化：color = initialColor * colorCurve.evaluate(normalizedAge)。
 *
 * 默认曲线 linear [1,1,1,1]→[1,1,1,0]，等价于原来 alpha 从 1 fade 到 0。
 *
 * **非 UE Stateless 模块** — UE 用 `ScaleColor` 的 Curve 模式完成等价效果
 * (`scale.sampleAtTime(perParticleRand, normalizedAge)`)。保留本模块作为
 * "曲线快捷方式"：不需要 per-particle 随机维度、只想沿生命曲线 fade 时直接用，
 * 比配 ScaleColor 的 Curve distribution 更直观。需要 per-particle randomness
 * (e.g. 闪烁) 改用 `ProScaleColorModule`。
 */
export class ProColorOverLifeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  colorCurve: ProCurveColor = ProCurveColor.linear([1, 1, 1, 1], [1, 1, 1, 0]);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProColorOverLifeModuleProps {
    return { colorCurve: this.colorCurve.toJSON() };
  }

  override fromJSON (data: ProColorOverLifeModuleProps): void {
    if (data.colorCurve) {
      this.colorCurve = ProCurveColor.fromJSON(data.colorCurve);
    }
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance } = ctx;

    if (!dataBuffer) {
      return;
    }
    const layout = ctx.emitterInstance.particleDataSet?.layout ?? null;

    if (!layout) {
      return;
    }
    if (this.cachedLayout !== layout) {
      this.accessors = new ProStandardAccessors(layout);
      this.cachedLayout = layout;
    }
    const a = this.accessors!;

    for (let i = firstInstance; i < lastInstance; i++) {
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;

      a.initialColor.get(dataBuffer, i, tmpColor);
      this.colorCurve.evaluate(t, tmpCurveOut);
      a.color.set(
        dataBuffer, i,
        tmpColor[0] * tmpCurveOut[0],
        tmpColor[1] * tmpCurveOut[1],
        tmpColor[2] * tmpCurveOut[2],
        tmpColor[3] * tmpCurveOut[3],
      );
    }
  }
}
