import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionVector3 } from '../../distribution/pro-distribution-vector3';
import type { ProDistributionVector3Data } from '../../distribution/pro-distribution-vector3';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';

export interface ProAccelerationForceModuleProps extends ProModuleProps {
  acceleration: ProDistributionVector3Data,
}

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpAccel: [number, number, number] = [0, 0, 0];

/**
 * 自定义加速度力：velocity += (acceleration / mass) * dt。
 *
 * **按质量加权**——对齐 UE Stateless：`Acceleration = (1/Mass)·AccelRange`
 * （SolveVelocitiesAndForces.ush:100-101，头文件注释 "This factors in mass, so
 * particles with a high mass will accelerate slower"）。重粒子加速更慢。
 * 与 GravityForce 不同：重力是真实加速度、与质量无关，所以重力**不**除质量。
 *
 * acceleration 支持 Distribution（Constant/Range/Curve），per-particle 随机。
 * mass <= 0 退化为 1，避免除零。
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

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.Lifetime, T.Float), access: 'read' },
      { variable: createProVariable(V.Age, T.Float), access: 'read' },
      { variable: createProVariable(V.RandomSeed, T.Float), access: 'read' },
      { variable: createProVariable(V.Mass, T.Float), access: 'read' },
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
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;
      // 用 Particle.RandomSeed 做 per-particle stable random — 旧实现每帧 nextFloat
      // 会让 Range 模式下 acceleration 每帧抖动；UE 对力场固定到 spawn 时一次性采样
      const rand = a.randomSeed.get(dataBuffer, i);

      this.acceleration.sampleAtTime(rand, t, tmpAccel);
      const mass = a.mass.get(dataBuffer, i);
      const invMass = mass > 0 ? 1 / mass : 1;

      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(
        dataBuffer, i,
        tmpVel[0] + tmpAccel[0] * invMass * deltaTime,
        tmpVel[1] + tmpAccel[1] * invMass * deltaTime,
        tmpVel[2] + tmpAccel[2] * invMass * deltaTime,
      );
    }
  }
}
