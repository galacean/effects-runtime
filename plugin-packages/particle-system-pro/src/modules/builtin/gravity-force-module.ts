import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ProDistributionVector3 } from '../../distribution/pro-distribution-vector3';
import type { ProDistributionVector3Data } from '../../distribution/pro-distribution-vector3';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProGravityForceModuleProps extends ProModuleProps {
  gravity: ProDistributionVector3Data,
}

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpG: [number, number, number] = [0, 0, 0];

/**
 * 恒定重力加速度：velocity += gravity * dt。
 *
 * `gravity` 是 `ProDistributionVector3`（对齐 UE Niagara
 * `FNiagaraDistributionRangeVector3`）。spawn 时每个粒子一次性采样到一个常量，
 * 之后整生命周期保持稳定 — Range 模式下不同粒子有不同的下落速率。
 *
 * 旧实现是裸 Vec3，所有粒子完全相同 → 缺少 UE 的 range 表达力。
 *
 * 执行顺序必须在 SolveVelocitiesAndForces 之前。
 */
export class ProGravityForceModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  gravity: ProDistributionVector3 = ProDistributionVector3.fromConstant(0, -9.8, 0);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProGravityForceModuleProps {
    return { gravity: this.gravity.toJSON() };
  }

  override fromJSON (data: ProGravityForceModuleProps): void {
    if (data.gravity) {
      this.gravity = ProDistributionVector3.fromJSON(data.gravity);
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
      // per-particle 随机 — RandomSeed 已 spawn 时写入；range 模式下不同粒子重力不同
      const seed = a.randomSeed.get(dataBuffer, i);

      this.gravity.sampleAtTime(seed, 0, tmpG);
      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(dataBuffer, i,
        tmpVel[0] + tmpG[0] * deltaTime,
        tmpVel[1] + tmpG[1] * deltaTime,
        tmpVel[2] + tmpG[2] * deltaTime,
      );
    }
  }
}
