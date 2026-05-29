import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';

export interface ProDragModuleProps extends ProModuleProps {
  drag: ProDistributionFloatData,
}

const tmpVel: [number, number, number] = [0, 0, 0];

/**
 * Stokes drag：velocity *= exp(-drag * dt)。
 *
 * 物理意义：阻力与速度成正比；积分得指数衰减。比线性衰减 `(1 - drag*dt)`
 * 在大 dt 下稳定（不会变负或爆炸）。
 *
 * **与质量无关**——对齐 UE Stateless：drag 直接作用于速度，SolveVelocitiesAndForces
 * 的 drag 项里没有 mass（只有 AccelerationForce 才除质量）。终端速度由 drag 与
 * acceleration 的逐帧相互作用自然涌现（≈ accel/drag）。
 *
 * 对齐 UE `FNiagaraDistributionRangeFloat`：drag 是 range-only 分布，range 模式下
 * 每粒子在 spawn 时通过 `Particle.RandomSeed` 稳定随机一次，整个生命周期保持同一
 * 阻力值。不支持随年龄渐变的 curve（UE 不允许）。
 */
export class ProDragModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  drag: ProDistributionFloat = ProDistributionFloat.fromConstant(1);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProDragModuleProps {
    return { drag: this.drag.toJSON() };
  }

  override fromJSON (data: ProDragModuleProps): void {
    if (data.drag) {
      this.drag = ProDistributionFloat.fromJSON(data.drag);
    }
  }

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.RandomSeed, T.Float), access: 'read' },
      { variable: createProVariable(V.Velocity, T.Vec3), access: 'readwrite' },
    ];
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
      const seed = a.randomSeed.get(dataBuffer, i);
      const r = hashSeed(seed, ParticleRandSalts.Drag);
      const drag = Math.max(0, this.drag.sampleAtTime(r, 0));
      const factor = Math.exp(-drag * deltaTime);

      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(dataBuffer, i, tmpVel[0] * factor, tmpVel[1] * factor, tmpVel[2] * factor);
    }
  }
}
