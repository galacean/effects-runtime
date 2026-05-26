import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

/**
 * 推进 age，超过 lifetime 的粒子先标记为死亡，真正 compact 推迟到阶段边界。
 *
 * 这样 interpolated spawn 的窄区间 ParticleUpdate 不会在执行中改写实例布局，
 * 语义更接近 UE Niagara 的执行模型。
 *
 * 与 Niagara 的 Update Age + Kill Particles 合并实现。
 */
export class ProUpdateAgeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

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
    const begin = Math.max(0, firstInstance);
    const end = Math.min(lastInstance, dataBuffer.numInstances);

    // 倒着遍历保留与旧实现一致的 kill 顺序；真正的 compact 推迟到阶段边界执行。
    for (let i = end - 1; i >= begin; i--) {
      const newAge = a.age.get(dataBuffer, i) + deltaTime;

      if (newAge >= a.lifetime.get(dataBuffer, i)) {
        dataBuffer.markInstanceKilled(i);
      } else {
        a.age.set(dataBuffer, i, newAge);
      }
    }
  }
}
