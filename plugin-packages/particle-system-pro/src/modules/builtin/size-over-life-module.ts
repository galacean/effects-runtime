import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProCurveFloat } from '../../curves/pro-curve-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpSize: [number, number] = [0, 0];

/**
 * 尺寸随生命周期变化：size = initialSize * [sizeCurveX.evaluate(t), sizeCurveY.evaluate(t)]。
 *
 * 默认曲线 linear(1, 0)，等价于原来从初始大小缩放到 0。
 * 与 ScaleSizeBySpeed 互不冲突——可以同时挂。
 */
export class ProSizeOverLifeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  sizeCurveX: ProCurveFloat = ProCurveFloat.linear(1, 0);
  sizeCurveY: ProCurveFloat = ProCurveFloat.linear(1, 0);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

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

      a.initialSize.get(dataBuffer, i, tmpSize);
      a.size.set(
        dataBuffer, i,
        tmpSize[0] * this.sizeCurveX.evaluate(t),
        tmpSize[1] * this.sizeCurveY.evaluate(t),
      );
    }
  }
}
