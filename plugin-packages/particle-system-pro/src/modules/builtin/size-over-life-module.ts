import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProCurveFloat } from '../../curves/pro-curve-float';
import type { ProCurveFloatData } from '../../curves/pro-curve-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProSizeOverLifeModuleProps extends ProModuleProps {
  sizeCurveX: ProCurveFloatData,
  sizeCurveY: ProCurveFloatData,
}

const tmpSize: [number, number] = [0, 0];

/**
 * 尺寸随生命周期变化：size = initialSize * [sizeCurveX.evaluate(t), sizeCurveY.evaluate(t)]。
 *
 * 默认曲线 linear(1, 0)，等价于原来从初始大小缩放到 0。
 * 与 ScaleSizeBySpeed 互不冲突——可以同时挂。
 *
 * **非 UE Stateless 模块** — UE 用 `ScaleSpriteSize` 的 Vec2 Curve 模式完成等价
 * 效果。保留本模块作为"曲线快捷方式"：X / Y 是两条独立 ProCurveFloat，比
 * UE 的"单条 Vec2 keyframe"更灵活（X 与 Y 可以走完全不同的曲线形状），
 * 也不需要 per-particle 随机维度。需要 per-particle randomness 改用
 * `ProScaleSpriteSizeModule`。
 */
export class ProSizeOverLifeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  sizeCurveX: ProCurveFloat = ProCurveFloat.linear(1, 0);
  sizeCurveY: ProCurveFloat = ProCurveFloat.linear(1, 0);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProSizeOverLifeModuleProps {
    return {
      sizeCurveX: this.sizeCurveX.toJSON(),
      sizeCurveY: this.sizeCurveY.toJSON(),
    };
  }

  override fromJSON (data: ProSizeOverLifeModuleProps): void {
    if (data.sizeCurveX) {
      this.sizeCurveX = ProCurveFloat.fromJSON(data.sizeCurveX);
    }
    if (data.sizeCurveY) {
      this.sizeCurveY = ProCurveFloat.fromJSON(data.sizeCurveY);
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

      a.initialSize.get(dataBuffer, i, tmpSize);
      a.size.set(
        dataBuffer, i,
        tmpSize[0] * this.sizeCurveX.evaluate(t),
        tmpSize[1] * this.sizeCurveY.evaluate(t),
      );
    }
  }
}
