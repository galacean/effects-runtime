import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProRibbonWidthScaleModuleProps extends ProModuleProps {
  scale: ProDistributionFloatData,
}

/**
 * Over-life 缩放 ribbon 宽度：`RibbonWidth = InitialRibbonWidth * scale_at_age`。
 *
 * 与 ScaleSpriteSize 同构 — 总是从 spawn 时 snapshot 的 InitialRibbonWidth
 * 乘以本帧 scale，避免每帧 `width *= scale` 引起的指数复合（同一个 scale=2.0
 * 跑 60 帧 width 会变 2^60 倍）。
 *
 * 前提：emitter 上必须装 ProRibbonWidthModule 写入 InitialRibbonWidth；
 * 没装的话 InitialRibbonWidth 为 0，本模块输出也是 0，ribbon 不可见。
 *
 * Distribution 模式：
 * - Constant / Range：每个粒子拿到独立 random scale（golden-ratio hash），
 *   做出粗细不一的 trail 集
 * - Curve：随 normalizedAge 缩放，所有粒子同曲线，做 fade-in / fade-out
 *
 * 对应 UE Niagara `RibbonWidthScale`（Update 阶段）。
 */
export class ProRibbonWidthScaleModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  scale: ProDistributionFloat = ProDistributionFloat.fromConstant(1);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: unknown = null;

  override toJSON (): ProRibbonWidthScaleModuleProps {
    return { scale: this.scale.toJSON() };
  }

  override fromJSON (data: ProRibbonWidthScaleModuleProps): void {
    if (data.scale) {
      this.scale = ProDistributionFloat.fromJSON(data.scale);
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
      const pRand = hashSeed(seed, ParticleRandSalts.Generic);
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;
      const s = Math.max(0, this.scale.sampleAtTime(pRand, t));
      const initial = a.initialRibbonWidth.get(dataBuffer, i);

      a.ribbonWidth.set(dataBuffer, i, initial * s);
    }
  }
}
