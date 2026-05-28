import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';

export interface ProCameraOffsetModuleProps extends ProModuleProps {
  offset: ProDistributionFloatData,
}

/**
 * 每帧按 normalizedAge 采样 CameraOffset，让 Sprite 沿视线方向偏移。
 *
 * - Constant 模式：效果等价旧版 spawn-only 行为（每帧值不变）
 * - Curve/Range 模式：粒子随生命周期前后摆动（push-pull 效果）
 *
 * 对应 UE Niagara CameraOffset 模块。
 */
export class ProCameraOffsetModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  offset: ProDistributionFloat = ProDistributionFloat.fromConstant(0);

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.Age, T.Float), access: 'read' },
      { variable: createProVariable(V.Lifetime, T.Float), access: 'read' },
      { variable: createProVariable(V.RandomSeed, T.Float), access: 'read' },
      { variable: createProVariable(V.CameraOffset, T.Float), access: 'write' },
    ];
  }

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProCameraOffsetModuleProps {
    return { offset: this.offset.toJSON() };
  }

  override fromJSON (data: ProCameraOffsetModuleProps): void {
    if (data.offset) {
      this.offset = ProDistributionFloat.fromJSON(data.offset);
    }
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
      const pRand = hashSeed(seed, ParticleRandSalts.CameraOffset);
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 0;
      const v = this.offset.sampleAtTime(pRand, t);

      a.cameraOffset.set(dataBuffer, i, v);
    }
  }
}
