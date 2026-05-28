import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
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
 */
export enum ProSubUVMode {
  SyncToAge = 'syncToAge',
  FixedRate = 'fixedRate',
}

export interface ProSubUVAnimationModuleProps extends ProModuleProps {
  mode: ProSubUVMode,
  totalFrames: number,
  framesPerSecond: number,
}

/**
 * 写 Particle.SubUVFrame，让 SpriteRenderer 着色器按帧采样 SubUV 网格。
 *
 * totalFrames 应跟 SpriteRendererProperties.subUVTotal 对齐，否则会越界。
 */
export class ProSubUVAnimationModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  mode: ProSubUVMode = ProSubUVMode.SyncToAge;
  totalFrames = 1;
  framesPerSecond = 30;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.Age, T.Float), access: 'read' },
      { variable: createProVariable(V.Lifetime, T.Float), access: 'read' },
      { variable: createProVariable(V.SubUVFrame, T.Float), access: 'write' },
    ];
  }

  override toJSON (): ProSubUVAnimationModuleProps {
    return {
      mode: this.mode,
      totalFrames: this.totalFrames,
      framesPerSecond: this.framesPerSecond,
    };
  }

  override fromJSON (data: ProSubUVAnimationModuleProps): void {
    if (data.mode === ProSubUVMode.SyncToAge || data.mode === ProSubUVMode.FixedRate) {
      this.mode = data.mode;
    }
    if (typeof data.totalFrames === 'number') { this.totalFrames = data.totalFrames; }
    if (typeof data.framesPerSecond === 'number') { this.framesPerSecond = data.framesPerSecond; }
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
    const isSync = this.mode === ProSubUVMode.SyncToAge;
    const fps = this.framesPerSecond;

    for (let i = firstInstance; i < lastInstance; i++) {
      const age = a.age.get(dataBuffer, i);

      if (isSync) {
        const lifetime = a.lifetime.get(dataBuffer, i);
        const t = lifetime > 0 ? Math.min(age / lifetime, 0.99999) : 0;

        a.subUVFrame.set(dataBuffer, i, t * total);
      } else {
        a.subUVFrame.set(dataBuffer, i, (age * fps) % total);
      }
    }
  }
}
