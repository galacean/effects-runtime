import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProRibbonWidthModuleProps extends ProModuleProps {
  width: ProDistributionFloatData,
}

/**
 * 给新生粒子写入 Ribbon Width（世界单位）。对应 UE Niagara
 * Ribbon Renderer 的 `RibbonWidthBinding` + Spawn 阶段宽度模块。
 *
 * - 不装本模块：Particle.RibbonWidth 保持 0（哨兵），renderer 走
 *   `Size.x * widthScale` 回退路径
 * - 装了本模块：每个粒子独立 width，可配 Constant / Range / Curve
 *
 * 与 SpriteSize 解耦的好处：sprite 渲染可以同时存在（同 emitter 两个
 * renderer）而互不污染尺寸。
 */
export class ProRibbonWidthModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  width: ProDistributionFloat = ProDistributionFloat.fromConstant(0.1);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: unknown = null;

  override toJSON (): ProRibbonWidthModuleProps {
    return { width: this.width.toJSON() };
  }

  override fromJSON (data: ProRibbonWidthModuleProps): void {
    if (data.width) {
      this.width = ProDistributionFloat.fromJSON(data.width);
    }
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

    if (!dataBuffer || firstInstance >= lastInstance) {
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
      // Math.max 防止用户配负宽度（distribution Range 下限可能小于 0）—
      // 负 width 会让 renderer 的 halfW 反号、左右顶点交叉成蝴蝶结
      const w = Math.max(0, this.width.sampleAtTime(randomStream.nextFloat(), 0));

      a.ribbonWidth.set(dataBuffer, i, w);
      // 同时备份到 InitialRibbonWidth — ProRibbonWidthScaleModule 用它当基准，
      // 否则 update 阶段每帧 width *= scale 会复合
      a.initialRibbonWidth.set(dataBuffer, i, w);
    }
  }
}
