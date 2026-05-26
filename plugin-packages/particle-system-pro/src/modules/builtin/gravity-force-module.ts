import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProGravityForceModuleProps extends ProModuleProps {
  gravity: [number, number, number],
}

const tmpVel: [number, number, number] = [0, 0, 0];

/**
 * 恒定重力加速度：velocity += gravity * dt。
 *
 * 对齐 Niagara Stateless 的 GravityForce 模块。
 * 执行顺序必须在 SolveVelocitiesAndForces 之前。
 */
export class ProGravityForceModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  gravity: [number, number, number] = [0, -9.8, 0];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProGravityForceModuleProps {
    return { gravity: [...this.gravity] };
  }

  override fromJSON (data: ProGravityForceModuleProps): void {
    if (data.gravity && data.gravity.length === 3) {
      this.gravity = [data.gravity[0], data.gravity[1], data.gravity[2]];
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
    const [gx, gy, gz] = this.gravity;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(dataBuffer, i, tmpVel[0] + gx * deltaTime, tmpVel[1] + gy * deltaTime, tmpVel[2] + gz * deltaTime);
    }
  }
}
