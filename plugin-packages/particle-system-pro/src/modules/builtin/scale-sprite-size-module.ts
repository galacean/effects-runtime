import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpInit: [number, number] = [0, 0];

const GOLDEN_RATIO_FRAC = 0.6180339887498949;

/**
 * 尺寸缩放：size = initialSize * scale.sampleAtTime(perParticleRand, normalizedAge)。
 *
 * 与 SizeOverLife（Curve 驱动 X/Y 双曲线，所有粒子相同）的关系：
 * - ScaleSpriteSize 用 ProDistributionFloat，uniform 缩放 X/Y
 * - Range 模式：每个粒子拿到独立 random scale，做出大小不一的爆破/烟花
 * - Curve 模式：随 normalizedAge 缩放，所有粒子同曲线
 *
 * 简化于 UE Niagara Stateless ScaleSpriteSize（UE 用 DistributionVector2 可 X/Y 独立）。
 * 这里用 Float 覆盖 90% 用例；后续需要 X/Y 独立时可扩展为 DistributionVector2。
 */
export class ProScaleSpriteSizeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  scale: ProDistributionFloat = ProDistributionFloat.fromConstant(1);

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
      const pRand = (i * GOLDEN_RATIO_FRAC) % 1;
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;
      const s = this.scale.sampleAtTime(pRand, t);

      a.initialSize.get(dataBuffer, i, tmpInit);
      a.size.set(dataBuffer, i, tmpInit[0] * s, tmpInit[1] * s);
    }
  }
}
