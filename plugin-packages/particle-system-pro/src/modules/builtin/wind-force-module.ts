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

const tmpPos: [number, number, number] = [0, 0, 0];
const tmpWind: [number, number, number] = [0, 0, 0];

/**
 * 风力模块：position += wind * dt。
 *
 * 对齐 UE Stateless SolveVelocitiesAndForces——wind 是**恒定速度偏移**
 * （解析积分里的 `Age·Wind` 项），不被 drag 衰减、也不随时间累积成加速度。
 * 在我们的逐帧模型里等价于每帧给 position 加 `wind·dt`（而不是给 velocity 加
 * `wind·dt`，那会让粒子持续加速）。若用户挂了 CalculateAccurateVelocity，
 * 风的位移会被反推进 Velocity，与 UE 行为一致。
 *
 * `wind` 支持 Distribution（Constant/Range/Curve），per-particle 随机。默认 (1,0,0)。
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
      { variable: createProVariable(V.Position, T.Vec3), access: 'readwrite' },
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
      a.position.get(dataBuffer, i, tmpPos);
      a.position.set(dataBuffer, i,
        tmpPos[0] + tmpWind[0] * deltaTime,
        tmpPos[1] + tmpWind[1] * deltaTime,
        tmpPos[2] + tmpWind[2] * deltaTime,
      );
    }
  }
}
