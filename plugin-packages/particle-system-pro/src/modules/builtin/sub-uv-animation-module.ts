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
 * SubUV 模式。
 *
 * - SyncToAge：帧 = normalizedAge * totalFrames（粒子生命周期内播完一遍）
 * - FixedRate：帧 = floor(age * framesPerSecond) % totalFrames（独立速率，可循环）
 * - Random：每隔 randomChangeInterval 秒随机切帧（确定性，用 hashSeed 可重播）
 */
export type ProSubUVModeType = 'syncToAge' | 'fixedRate' | 'random';

export const ProSubUVMode = {
  SyncToAge: 'syncToAge' as const,
  FixedRate: 'fixedRate' as const,
  Random: 'random' as const,
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
 * 写 Particle.SubUVFrame，让 SpriteRenderer 着色器按帧采样 SubUV 网格。
 *
 * totalFrames 应跟 SpriteRendererProperties.subUVTotal 对齐，否则会越界。
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
    if (data.mode === 'syncToAge' || data.mode === 'fixedRate' || data.mode === 'random') {
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

    for (let i = firstInstance; i < lastInstance; i++) {
      const age = a.age.get(dataBuffer, i);

      switch (this.mode) {
        case 'syncToAge': {
          const lifetime = a.lifetime.get(dataBuffer, i);
          const t = lifetime > 0 ? Math.min(age / lifetime, 0.99999) : 0;

          a.subUVFrame.set(dataBuffer, i, t * total);

          break;
        }
        case 'fixedRate': {
          a.subUVFrame.set(dataBuffer, i, (age * this.framesPerSecond) % total);

          break;
        }
        case 'random': {
          const interval = Math.max(0.001, this.randomChangeInterval);
          const stage = Math.floor(age / interval);
          const seed = a.randomSeed.get(dataBuffer, i);
          const rand = hashSeed(seed, (stage * 7919 + ParticleRandSalts.SubUV) | 0);
          const startFrame = this.startFrameOverride >= 0 ? this.startFrameOverride : 0;
          const endFrame = this.endFrameOverride >= 0 ? Math.min(this.endFrameOverride, total - 1) : total - 1;
          const range = endFrame - startFrame + 1;
          const frame = startFrame + Math.floor(rand * range);

          a.subUVFrame.set(dataBuffer, i, frame);

          break;
        }
      }
    }
  }
}
