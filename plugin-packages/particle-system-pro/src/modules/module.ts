import type { ProModuleContext } from './module-context';
import type { ProModuleStage } from './stage';

/**
 * 一个 Module 实现某个 Stage 上的一段粒子逻辑。
 *
 * 与 Niagara 不同，这里直接用 TS 函数书写逻辑（不通过 VectorVM 字节码），
 * 因此 module 可以保持 stateful（持有 ValueGetter、Curve 等编辑期数据）。
 *
 * 单 module 只能挂在一个 stage 上。
 */
export abstract class ProModule {
  abstract readonly stage: ProModuleStage;
  enabled = true;

  abstract execute (ctx: ProModuleContext): void;
}
