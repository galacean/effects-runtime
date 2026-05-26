import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProSpriteRotationRateModuleProps extends ProModuleProps {
  rate: ProDistributionFloatData,
}

const GOLDEN_RATIO_FRAC = 0.6180339887498949;

/**
 * Sprite 旋转速率：rotation += rate * dt，rate 用 ProDistributionFloat
 * per-particle 采样（golden-ratio hash 保持每个粒子的速率稳定，避免每帧抖动）。
 *
 * 对应 UE Niagara Stateless SpriteRotationRate 模块。和现有
 * RotationOverLife (常量 angularVelocity) 不同的是：
 * - 这里支持 Distribution（Range / Curve），每个粒子可以有不同速率
 * - 速率单位是 弧度/秒
 */
export class ProSpriteRotationRateModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  rate: ProDistributionFloat = ProDistributionFloat.fromRange(-Math.PI, Math.PI);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProSpriteRotationRateModuleProps {
    return { rate: this.rate.toJSON() };
  }

  override fromJSON (data: ProSpriteRotationRateModuleProps): void {
    if (data.rate) {
      this.rate = ProDistributionFloat.fromJSON(data.rate);
    }
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, deltaTime, firstInstance, lastInstance } = ctx;

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
      const pRand = (i * GOLDEN_RATIO_FRAC) % 1;
      const r = this.rate.sampleAtTime(pRand, 0);

      a.rotation.set(dataBuffer, i, a.rotation.get(dataBuffer, i) + r * deltaTime);
    }
  }
}
