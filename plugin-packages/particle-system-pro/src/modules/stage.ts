/**
 * Emitter / Particle 级 Module 的执行阶段。
 *
 * 顺序：EmitterSpawn → EmitterUpdate → ParticleSpawn → ParticleUpdate。
 *
 * 各阶段允许写入的变量范围不同：
 * - EmitterSpawn / EmitterUpdate：Emitter Parameters（含计算下一帧的 SpawnInfo）
 * - ParticleSpawn：新粒子的 Particle Parameters（每帧一次性写入初值）
 * - ParticleUpdate：现存粒子的 Particle Parameters（每帧推进，可 kill）
 *
 * System 级阶段（SystemSpawn / SystemUpdate）由独立的 ProSystemModule 类型体系处理，
 * 见 system-module.ts。对齐 UE Stateful 架构：System Script 与 Emitter Script
 * 是完全不同的类型，操作不同的 DataSet。
 */
export enum ProModuleStage {
  EmitterSpawn = 'emitterSpawn',
  EmitterUpdate = 'emitterUpdate',
  ParticleSpawn = 'particleSpawn',
  ParticleUpdate = 'particleUpdate',
}
