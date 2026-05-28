import type { ProModuleContext } from './module-context';
import type { ProModuleStage } from './stage';

/**
 * Module 序列化数据的 base interface。
 *
 * 每个子类应 extend 这个空 interface 声明自己的字段；序列化层只持有
 * `ProModuleProps` 作为通用形参类型，运行时由具体 module 自己窄化。
 */
export interface ProModuleProps {
}

/**
 * Emitter / Particle 级 Module 基类。
 *
 * 与 Niagara 不同，这里直接用 TS 函数书写逻辑（不通过 VectorVM 字节码），
 * 因此 module 可以保持 stateful（持有 ValueGetter、Curve 等编辑期数据）。
 *
 * 单 module 只能挂在一个 stage 上（EmitterSpawn / EmitterUpdate /
 * ParticleSpawn / ParticleUpdate）。
 *
 * System 级模块使用独立的 ProSystemModule 基类（见 system-module.ts），
 * 与本类完全隔离——对齐 UE Stateful：System Script 和 Emitter Script
 * 是不同的类型体系。
 *
 * 序列化由每个子类自己实现 toJSON / fromJSON —— 显式声明哪些字段需要存、
 * 什么类型、怎么写；并 export 一个 ProXxxModuleProps interface 描述形状。
 */
export abstract class ProModule {
  abstract readonly stage: ProModuleStage;
  enabled = true;

  abstract execute (ctx: ProModuleContext): void;

  /**
   * 把 module 的可序列化字段返回为 JSON-safe 对象。
   * 子类返回 own ProXxxModuleProps（必须 extend ProModuleProps）；
   * 默认返回空对象（无字段的 module 如 SolveForces 直接继承即可）。
   */
  toJSON (): ProModuleProps {
    return {};
  }

  /**
   * 从 data 恢复字段。默认无操作。
   */
  fromJSON (_data: ProModuleProps): void {
    // no-op by default
  }
}
