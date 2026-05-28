import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionVector2 } from '../../distribution/pro-distribution-vector2';
import type { ProDistributionVector2Data } from '../../distribution/pro-distribution-vector2';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';

export interface ProScaleSpriteSizeModuleProps extends ProModuleProps {
  scale: ProDistributionVector2Data,
}

const tmpInit: [number, number] = [0, 0];
const tmpScale: [number, number] = [0, 0];

/**
 * 对齐 UE Niagara Stateful ScaleSpriteSize：size = initialSize * scale(normalizedAge)。
 * scale 为 ProDistributionVector2，X/Y 独立缩放。
 */
export class ProScaleSpriteSizeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  scale: ProDistributionVector2 = ProDistributionVector2.fromUniformConstant(1);

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProScaleSpriteSizeModuleProps {
    return { scale: this.scale.toJSON() };
  }

  override fromJSON (data: ProScaleSpriteSizeModuleProps): void {
    if (data.scale) {
      this.scale = ProDistributionVector2.fromJSON(data.scale);
    }
  }

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.RandomSeed, T.Float), access: 'read' },
      { variable: createProVariable(V.Lifetime, T.Float), access: 'read' },
      { variable: createProVariable(V.Age, T.Float), access: 'read' },
      { variable: createProVariable(V.InitialSize, T.Vec2), access: 'read' },
      { variable: createProVariable(V.Size, T.Vec2), access: 'write' },
    ];
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance } = ctx;

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
      const pRand = hashSeed(seed, ParticleRandSalts.ScaleX);
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;

      this.scale.sampleAtTime(pRand, t, tmpScale);

      a.initialSize.get(dataBuffer, i, tmpInit);
      a.size.set(dataBuffer, i, tmpInit[0] * tmpScale[0], tmpInit[1] * tmpScale[1]);
    }
  }
}
