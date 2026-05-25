import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

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
