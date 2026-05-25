import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpPos: [number, number, number] = [0, 0, 0];

/**
 * 纯位置积分：position += velocity * dt。
 *
 * Force 模块（Gravity/Acceleration/CurlNoise）在此之前修改 velocity，
 * 本模块只负责将 velocity 积分到 position。
 */
export class ProSolveForcesAndVelocityModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

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
      a.velocity.get(dataBuffer, i, tmpVel);
      a.position.get(dataBuffer, i, tmpPos);
      a.position.set(
        dataBuffer, i,
        tmpPos[0] + tmpVel[0] * deltaTime,
        tmpPos[1] + tmpVel[1] * deltaTime,
        tmpPos[2] + tmpVel[2] * deltaTime,
      );
    }
  }
}
