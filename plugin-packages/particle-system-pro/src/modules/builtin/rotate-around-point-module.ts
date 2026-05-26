import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProRotateAroundPointModuleProps extends ProModuleProps {
  rate: ProDistributionFloatData,
  radius: ProDistributionFloatData,
  phase: ProDistributionFloatData,
}

const tmpPos: [number, number, number] = [0, 0, 0];

const DEG2RAD = Math.PI / 180;
const GOLDEN_RATIO_FRAC = 0.6180339887498949;

/**
 * 轨道运动：粒子绕 Y 轴做圆周运动叠加到位置上。
 *
 * rate/radius/phase 均为 Distribution，per-particle 用确定性 hash 采样（不闪烁）。
 * angle = (rate * age + phase) * DEG2RAD
 * position += [cos(angle) * radius, 0, sin(angle) * radius]
 *
 * 对齐 Niagara Stateless 的 RotateAroundPoint 模块。
 */
export class ProRotateAroundPointModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  rate: ProDistributionFloat = ProDistributionFloat.fromConstant(180);
  radius: ProDistributionFloat = ProDistributionFloat.fromConstant(1);
  phase: ProDistributionFloat = ProDistributionFloat.fromRange(0, 360);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProRotateAroundPointModuleProps {
    return {
      rate: this.rate.toJSON(),
      radius: this.radius.toJSON(),
      phase: this.phase.toJSON(),
    };
  }

  override fromJSON (data: ProRotateAroundPointModuleProps): void {
    if (data.rate) { this.rate = ProDistributionFloat.fromJSON(data.rate); }
    if (data.radius) { this.radius = ProDistributionFloat.fromJSON(data.radius); }
    if (data.phase) { this.phase = ProDistributionFloat.fromJSON(data.phase); }
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
      const pRand = (i * GOLDEN_RATIO_FRAC) % 1;
      const r = this.radius.sampleAtTime(pRand, 0);
      const rateVal = this.rate.sampleAtTime(pRand, 0);
      const phaseVal = this.phase.sampleAtTime(pRand, 0);
      const age = a.age.get(dataBuffer, i);
      const angle = (rateVal * age + phaseVal) * DEG2RAD;

      a.position.get(dataBuffer, i, tmpPos);
      a.position.set(
        dataBuffer, i,
        tmpPos[0] + Math.cos(angle) * r,
        tmpPos[1],
        tmpPos[2] + Math.sin(angle) * r,
      );
    }
  }
}
