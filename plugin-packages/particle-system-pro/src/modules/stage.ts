/**
 * Module 执行阶段。
 *
 * 顺序：SystemSpawn → SystemUpdate → EmitterSpawn → EmitterUpdate
 * → ParticleSpawn → ParticleUpdate。
 *
 * 各阶段允许写入的变量范围不同：
 * - SystemSpawn / SystemUpdate：System Parameters
 * - EmitterSpawn / EmitterUpdate：Emitter Parameters（含计算下一帧的 SpawnInfo）
 * - ParticleSpawn：新粒子的 Particle Parameters（每帧一次性写入初值）
 * - ParticleUpdate：现存粒子的 Particle Parameters（每帧推进，可 kill）
 */
export enum ProModuleStage {
  SystemSpawn = 'systemSpawn',
  SystemUpdate = 'systemUpdate',
  EmitterSpawn = 'emitterSpawn',
  EmitterUpdate = 'emitterUpdate',
  ParticleSpawn = 'particleSpawn',
  ParticleUpdate = 'particleUpdate',
}
