import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';

/**
 * SubUV 模式。对齐 UE ENSMSubUVAnimation_Mode。
 *
 * - syncToAge (= UE Linear)：normalizedAge 线性映射到 [startFrame, endFrame]，播一遍
 * - fixedRate (= UE InfiniteLoop)：按 framesPerSecond 速率在 [startFrame, endFrame] 范围内循环
 * - random (= UE Random)：每隔 randomChangeInterval 秒在 [startFrame, endFrame] 内随机切帧
 * - directSet (= UE DirectSet)：spawn 时按 RandomSeed 随机选一帧，生命周期内不变
 */
export type ProSubUVModeType = 'syncToAge' | 'fixedRate' | 'random' | 'directSet';

export const ProSubUVMode = {
  SyncToAge: 'syncToAge' as const,
  FixedRate: 'fixedRate' as const,
  Random: 'random' as const,
  DirectSet: 'directSet' as const,
};

export interface ProSubUVAnimationModuleProps extends ProModuleProps {
  mode: ProSubUVModeType,
  totalFrames: number,
  framesPerSecond: number,
  randomChangeInterval: number,
  startFrameOverride: number,
  endFrameOverride: number,
}

/**
 * 写 Particle.SubUVFrame（连续 float），让 SpriteRenderer 按帧采样 SubUV 网格。
 * 渲染器端 floor 取整帧索引；帧间混合（frame blending）是渲染器特性，不在此实现。
 *
 * 所有模式均尊重 startFrameOverride / endFrameOverride 帧范围；
 * override < 0 表示不启用，回退到 0 和 totalFrames-1。
 * 对齐 UE `bStartFrameRangeOverride_Enabled` / `bEndFrameRangeOverride_Enabled`。
 */
export class ProSubUVAnimationModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  mode: ProSubUVModeType = 'syncToAge';
  totalFrames = 1;
  framesPerSecond = 30;
  randomChangeInterval = 0.1;
  startFrameOverride = -1;
  endFrameOverride = -1;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.Age, T.Float), access: 'read' },
      { variable: createProVariable(V.Lifetime, T.Float), access: 'read' },
      { variable: createProVariable(V.RandomSeed, T.Float), access: 'read' },
      { variable: createProVariable(V.SubUVFrame, T.Float), access: 'write' },
    ];
  }

  override toJSON (): ProSubUVAnimationModuleProps {
    return {
      mode: this.mode,
      totalFrames: this.totalFrames,
      framesPerSecond: this.framesPerSecond,
      randomChangeInterval: this.randomChangeInterval,
      startFrameOverride: this.startFrameOverride,
      endFrameOverride: this.endFrameOverride,
    };
  }

  override fromJSON (data: ProSubUVAnimationModuleProps): void {
    if (data.mode === 'syncToAge' || data.mode === 'fixedRate' || data.mode === 'random' || data.mode === 'directSet') {
      this.mode = data.mode;
    }
    if (typeof data.totalFrames === 'number') { this.totalFrames = data.totalFrames; }
    if (typeof data.framesPerSecond === 'number') { this.framesPerSecond = data.framesPerSecond; }
    if (typeof data.randomChangeInterval === 'number') { this.randomChangeInterval = data.randomChangeInterval; }
    if (typeof data.startFrameOverride === 'number') { this.startFrameOverride = data.startFrameOverride; }
    if (typeof data.endFrameOverride === 'number') { this.endFrameOverride = data.endFrameOverride; }
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
    const total = Math.max(1, this.totalFrames);

    // 解析帧范围——对齐 UE bStartFrameRangeOverride_Enabled / bEndFrameRangeOverride_Enabled
    const startFrame = this.startFrameOverride >= 0 ? Math.min(this.startFrameOverride, total - 1) : 0;
    const endFrame = this.endFrameOverride >= 0 ? Math.min(this.endFrameOverride, total - 1) : total - 1;
    const frameRange = Math.max(0, endFrame - startFrame);

    for (let i = firstInstance; i < lastInstance; i++) {
      const age = a.age.get(dataBuffer, i);

      switch (this.mode) {
        case 'syncToAge': {
          // UE Linear (mode=2): normalizedAge 线性映射到 [startFrame, endFrame]
          const lifetime = a.lifetime.get(dataBuffer, i);
          const t = lifetime > 0 ? Math.min(age / lifetime, 1) : 1;

          a.subUVFrame.set(dataBuffer, i, startFrame + t * frameRange);

          break;
        }
        case 'fixedRate': {
          // UE InfiniteLoop (mode=1): 在 [startFrame, endFrame] 范围内按帧率循环
          const frameCount = frameRange + 1;
          const progress = (age * this.framesPerSecond) % frameCount;

          a.subUVFrame.set(dataBuffer, i, startFrame + progress);

          break;
        }
        case 'random': {
          // UE Random (mode=3): 每 randomChangeInterval 秒随机切帧
          const interval = Math.max(0.001, this.randomChangeInterval);
          const stage = Math.floor(age / interval);
          const seed = a.randomSeed.get(dataBuffer, i);
          const rand = hashSeed(seed, (stage * 7919 + ParticleRandSalts.SubUV) | 0);
          const range = frameRange + 1;

          a.subUVFrame.set(dataBuffer, i, startFrame + rand * range);

          break;
        }
        case 'directSet': {
          // UE DirectSet (mode=0): spawn 时随机选帧，生命周期内不变
          const seed = a.randomSeed.get(dataBuffer, i);
          const rand = hashSeed(seed, ParticleRandSalts.SubUV);
          const range = frameRange + 1;

          a.subUVFrame.set(dataBuffer, i, startFrame + rand * range);

          break;
        }
      }
    }
  }
}
