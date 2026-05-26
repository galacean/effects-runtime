import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProInitializeRotationModuleProps extends ProModuleProps {
  rotation: ProDistributionFloatData,
}

/**
 * 给新生粒子写入随机初始旋转角度（弧度）。
 *
 * 必须在 InitializeParticle 之后跑（InitializeParticle 默认不写 rotation）。
 */
export class ProInitializeRotationModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  rotation: ProDistributionFloat = ProDistributionFloat.fromRange(0, Math.PI * 2);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProInitializeRotationModuleProps {
    return { rotation: this.rotation.toJSON() };
  }

  override fromJSON (data: ProInitializeRotationModuleProps): void {
    if (data.rotation) {
      this.rotation = ProDistributionFloat.fromJSON(data.rotation);
    }
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

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
      a.rotation.set(dataBuffer, i, this.rotation.sampleAtTime(randomStream.nextFloat(), 0));
    }
  }
}
