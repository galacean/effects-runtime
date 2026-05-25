import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

/**
 * 推进 age，超过 lifetime 的粒子 swap-back kill。
 *
 * 必须放在 particleUpdate 阶段所有访问 age 的 module 之后（这里在最后），
 * 否则被 kill 粒子的位置会被新粒子覆盖。
 *
 * 与 Niagara 的 Update Age + Kill Particles 合并实现。
 */
export class ProUpdateAgeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, deltaTime } = ctx;

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

    // 倒着遍历避免 swap-back 把还没处理的尾部粒子换到前面后被跳过
    for (let i = dataBuffer.numInstances - 1; i >= 0; i--) {
      const newAge = a.age.get(dataBuffer, i) + deltaTime;

      if (newAge >= a.lifetime.get(dataBuffer, i)) {
        dataBuffer.killInstance(i);
      } else {
        a.age.set(dataBuffer, i, newAge);
      }
    }
  }
}
