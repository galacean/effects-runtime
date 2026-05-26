import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionColor } from '../../distribution/pro-distribution-color';
import type { ProDistributionColorData } from '../../distribution/pro-distribution-color';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProScaleColorModuleProps extends ProModuleProps {
  scale: ProDistributionColorData,
}

const tmpInit: [number, number, number, number] = [0, 0, 0, 0];
const tmpScale: [number, number, number, number] = [0, 0, 0, 0];

/**
 * 颜色缩放：color = initialColor * scale.sampleAtTime(perParticleRand, normalizedAge)。
 *
 * 与 ColorOverLife（Curve 驱动，所有粒子相同曲线）的关系：
 * - ScaleColor 用 ProDistributionColor，支持 Constant / Range / Curve 三种模式
 * - Range 模式下每个粒子拿到独立的 random scale，per-particle 随机彩色粒子
 * - Curve 模式行为和 ColorOverLife 接近（所有粒子同曲线）
 *
 * 对齐 UE Niagara Stateless ScaleColor 模块。
 */
export class ProScaleColorModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  scale: ProDistributionColor = ProDistributionColor.fromConstant(1, 1, 1, 1);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProScaleColorModuleProps {
    return { scale: this.scale.toJSON() };
  }

  override fromJSON (data: ProScaleColorModuleProps): void {
    if (data.scale) {
      this.scale = ProDistributionColor.fromJSON(data.scale);
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
      const seed = a.randomSeed.get(dataBuffer, i);
      const pRand = hashSeed(seed, ParticleRandSalts.Color);
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;

      a.initialColor.get(dataBuffer, i, tmpInit);
      this.scale.sampleAtTime(pRand, t, tmpScale);
      a.color.set(
        dataBuffer, i,
        tmpInit[0] * tmpScale[0],
        tmpInit[1] * tmpScale[1],
        tmpInit[2] * tmpScale[2],
        tmpInit[3] * tmpScale[3],
      );
    }
  }
}
