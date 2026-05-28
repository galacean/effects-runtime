import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProVariableDeclaration } from '../module';

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

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.Age, T.Float), access: 'readwrite' },
      { variable: createProVariable(V.Lifetime, T.Float), access: 'read' },
    ];
  }

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

    // 正向遍历；mark 仅设位，真正 compact 在阶段边界由 emitter-instance 统一执行
    // (对齐 UE bMarkedDead 模式 — 与遍历顺序无关，正向更符合 UE 习惯)
    for (let i = begin; i < end; i++) {
      const newAge = a.age.get(dataBuffer, i) + deltaTime;

      if (newAge >= a.lifetime.get(dataBuffer, i)) {
        dataBuffer.markInstanceKilled(i);
      } else {
        a.age.set(dataBuffer, i, newAge);
      }
    }
  }
}
