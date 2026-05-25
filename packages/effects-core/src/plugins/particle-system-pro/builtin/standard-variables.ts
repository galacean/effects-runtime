import { ProDataSetLayout } from '../data/data-set-layout';
import type { ProVariable } from '../types/variable';
import { ProVariableTypes, createProVariable } from '../types/variable';

/**
 * 标准 Particle 变量名常量。Module 间通过名字握手，避免散落字符串。
 */
export const ProStandardVariableNames = {
  Age: 'Particle.Age',
  Lifetime: 'Particle.Lifetime',
  Position: 'Particle.Position',
  Velocity: 'Particle.Velocity',
  Color: 'Particle.Color',
  Size: 'Particle.Size',
  Rotation: 'Particle.Rotation',
  SubUVFrame: 'Particle.SubUVFrame',
  InitialColor: 'Particle.InitialColor',
  InitialSize: 'Particle.InitialSize',
  RibbonID: 'Particle.RibbonID',
} as const;

/**
 * 默认 Sprite Emitter 用的 Particle 变量集合。
 *
 * - Age / Lifetime：UpdateAge 推进，超时 kill
 * - Position / Velocity：SolveForcesAndVelocity 积分
 * - Color / Size：每帧由 ColorOverLife / ScaleSizeBySpeed 写
 * - InitialColor / InitialSize：spawn 时记录，给 over-life 模块做基准
 */
export function createStandardParticleVariables (): ProVariable[] {
  return [
    createProVariable(ProStandardVariableNames.Age, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.Lifetime, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.Position, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.Velocity, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.Color, ProVariableTypes.Color),
    createProVariable(ProStandardVariableNames.Size, ProVariableTypes.Vec2),
    createProVariable(ProStandardVariableNames.Rotation, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.SubUVFrame, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.InitialColor, ProVariableTypes.Color),
    createProVariable(ProStandardVariableNames.InitialSize, ProVariableTypes.Vec2),
    createProVariable(ProStandardVariableNames.RibbonID, ProVariableTypes.Int32),
  ];
}

export function createStandardParticleLayout (): ProDataSetLayout {
  return new ProDataSetLayout(createStandardParticleVariables());
}
