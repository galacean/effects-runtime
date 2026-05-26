import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionVector3 } from '../../distribution/pro-distribution-vector3';
import type { ProDistributionVector3Data } from '../../distribution/pro-distribution-vector3';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProAccelerationForceModuleProps extends ProModuleProps {
  acceleration: ProDistributionVector3Data,
}

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpAccel: [number, number, number] = [0, 0, 0];

/**
 * 自定义加速度力：velocity += acceleration.sample(random, t) * dt。
 *
 * acceleration 支持 Distribution（Constant/Range/Curve），per-particle 随机。
 * 对齐 Niagara Stateless 的 AccelerationForce 模块。
 */
export class ProAccelerationForceModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  acceleration: ProDistributionVector3 = ProDistributionVector3.fromConstant(0, 0, 0);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProAccelerationForceModuleProps {
    return { acceleration: this.acceleration.toJSON() };
  }

  override fromJSON (data: ProAccelerationForceModuleProps): void {
    if (data.acceleration) {
      this.acceleration = ProDistributionVector3.fromJSON(data.acceleration);
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
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;
      // 用 Particle.RandomSeed 做 per-particle stable random — 旧实现每帧 nextFloat
      // 会让 Range 模式下 acceleration 每帧抖动；UE 对力场固定到 spawn 时一次性采样
      const rand = a.randomSeed.get(dataBuffer, i);

      this.acceleration.sampleAtTime(rand, t, tmpAccel);
      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(
        dataBuffer, i,
        tmpVel[0] + tmpAccel[0] * deltaTime,
        tmpVel[1] + tmpAccel[1] * deltaTime,
        tmpVel[2] + tmpAccel[2] * deltaTime,
      );
    }
  }
}
