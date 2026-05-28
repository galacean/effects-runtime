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

export interface ProWindForceModuleProps extends ProModuleProps {
  wind: ProDistributionVector3Data,
}

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpWind: [number, number, number] = [0, 0, 0];

/**
 * 风力模块：velocity += wind * dt。
 *
 * 对标 UE Stateful 的 WindForce 模块。`wind` 支持 Distribution（Constant/Range/Curve），
 * per-particle 随机。默认方向 (1, 0, 0)。
 */
export class ProWindForceModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  wind: ProDistributionVector3 = ProDistributionVector3.fromConstant(1, 0, 0);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProWindForceModuleProps {
    return { wind: this.wind.toJSON() };
  }

  override fromJSON (data: ProWindForceModuleProps): void {
    if (data.wind) {
      this.wind = ProDistributionVector3.fromJSON(data.wind);
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

      this.wind.sampleAtTime(seed, 0, tmpWind);
      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(dataBuffer, i,
        tmpVel[0] + tmpWind[0] * deltaTime,
        tmpVel[1] + tmpWind[1] * deltaTime,
        tmpVel[2] + tmpWind[2] * deltaTime,
      );
    }
  }
}
