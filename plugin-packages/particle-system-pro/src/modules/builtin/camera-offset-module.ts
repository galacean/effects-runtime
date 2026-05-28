import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';

export interface ProCameraOffsetModuleProps extends ProModuleProps {
  offset: ProDistributionFloatData,
}

/**
 * 写入 Particle.CameraOffset，渲染时让 Sprite 沿视线方向偏移。
 *
 * 典型用法：粒子穿透墙体或其它几何时表现为深度撕裂；给一个负的 offset
 * 把粒子拉近相机一点能消除穿插闪烁。烟雾/光效中也常用做"凸出/凹陷"效果。
 *
 * - offset: ProDistributionFloat（单位：世界空间长度；负数=朝相机靠近）
 * - 用 randomStream 在 spawn 时一次性采样，per-particle 独立
 *
 * 对应 UE Niagara Stateful CameraOffset 模块。
 */
export class ProCameraOffsetModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  offset: ProDistributionFloat = ProDistributionFloat.fromConstant(0);

  override declareVariables (): ProVariableDeclaration[] {
    return [
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
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

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
      const v = this.offset.sampleAtTime(randomStream.nextFloat(), 0);

      a.cameraOffset.set(dataBuffer, i, v);
    }
  }
}
