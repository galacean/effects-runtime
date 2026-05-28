import type { ProSystemModuleContext } from './module-context';

/**
 * System 级 module 的执行阶段。
 *
 * 与 Emitter/Particle 级 ProModuleStage 完全独立——对齐 UE Stateful：
 * System Script 和 Emitter Script 是不同的脚本资产类型，操作不同的 DataSet。
 */
export type ProSystemModuleStage = 'systemSpawn' | 'systemUpdate';

/**
 * System 级 Module 基类。
 *
 * 与 ProModule（Emitter/Particle 级）是完全独立的类型体系——对齐 UE Stateful
 * 架构：System Script 只能访问 System Parameters（systemParameterStore），
 * 不能读写 Emitter / Particle 数据。TypeScript 类型系统在编译期强制这一约束。
 *
 * SystemInstance 持有 systemModules: ProSystemModule[]，
 * EmitterInstance 持有 modules: ProModule[]，两者不混用。
 */
export abstract class ProSystemModule {
  abstract readonly stage: ProSystemModuleStage;
  enabled = true;

  abstract execute (ctx: ProSystemModuleContext): void;
}
