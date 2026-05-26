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
 * 与 Niagara 的 ColorScaleOverLife 行为接近。
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
