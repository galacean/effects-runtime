import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProRotationOverLifeModuleProps extends ProModuleProps {
  angularVelocity: number,
}

/**
 * 每帧给粒子旋转推进 angularVelocity * dt 弧度。
 */
export class ProRotationOverLifeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  angularVelocity = Math.PI;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProRotationOverLifeModuleProps {
    return { angularVelocity: this.angularVelocity };
  }

  override fromJSON (data: ProRotationOverLifeModuleProps): void {
    if (typeof data.angularVelocity === 'number') { this.angularVelocity = data.angularVelocity; }
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
    const delta = this.angularVelocity * deltaTime;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.rotation.set(dataBuffer, i, a.rotation.get(dataBuffer, i) + delta);
    }
  }
}
