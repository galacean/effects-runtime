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
  // 全局唯一持久 ID。InitializeParticle 通过 emitter.idTable.acquire() 写入
  // 单调递增的 UniqueIndex（永不复用，对齐 UE FNiagaraStatelessEmitterInstance::UniqueIndexOffset）。
  // trail emitter 的 SampleParticles 模块把 source 粒子的 UniqueID 直接当作 trail 粒子
  // 的 RibbonID，从而让"每条 source 轨迹"自动成为一条独立 ribbon
  UniqueID: 'Particle.UniqueID',
  CameraOffset: 'Particle.CameraOffset',
  Mass: 'Particle.Mass',
  PreviousPosition: 'Particle.PreviousPosition',
  // 全局单调递增的 spawn 顺序标识；Ribbon Renderer 用它做主排序键，
  // 比 Age 更稳定：burst 同帧粒子也能拿到 distinct 值，
  // 可变 lifetime 下也不会因为老粒子已死而错位
  RibbonLinkOrder: 'Particle.RibbonLinkOrder',
  // 每粒子 ribbon 宽度（世界单位）。Ribbon Renderer 优先用这个值；
  // 等于 0 时回退到 Size.x * widthScale 走老路径（向后兼容）。
  // 由 ProRibbonWidthModule (spawn) 写初值、ProRibbonWidthScaleModule
  // (update) 做 over-life 缩放
  RibbonWidth: 'Particle.RibbonWidth',
  // RibbonWidth 的 spawn 时初值快照，用于 ProRibbonWidthScaleModule
  // 每帧 `RibbonWidth = InitialRibbonWidth * scale_at_age`，避免在
  // 当前值上反复乘 scale 引起的指数复合
  InitialRibbonWidth: 'Particle.InitialRibbonWidth',
  // 沿 ribbon 走过的累计距离（世界单位）。Spawn 模块写入，渲染时
  // TiledFromStart 模式直接用 `v = RibbonUVDistance / tileLength`，
  // 避免每帧在 renderer 里再扫一遍 sorted 序列算弧长。
  // 对应 UE Niagara `RibbonUVDistance`
  RibbonUVDistance: 'Particle.RibbonUVDistance',
  // 粒子位置在所有 ParticleSpawn 模块跑完之后的快照。RotateAroundPoint 用它
  // 当"轨道基准位置"避免每帧增量累加造成螺旋外飞；未来 Mesh / Trail 等模块
  // 也可以读它做"相对 spawn 时的偏移"。emitter-instance.tickInner 在 spawn
  // 阶段末尾自动 capture（粒子用户无需写专门 module）
  InitialPosition: 'Particle.InitialPosition',
  // per-particle 随机种子 [0,1)。InitializeParticle 在 spawn 时一次性写入，
  // 之后所有"需要 per-particle 稳定随机"的 update 模块（ScaleColor /
  // ScaleSpriteSize / SpriteRotationRate / RotateAroundPoint）改用这个值
  // 而非 slot index hash，避免 slot 复用导致同 slot 不同粒子拿相同 rand、
  // 第一个粒子永远 pRand=0、reseed 失效、多属性相关性等问题。
  // 对应 UE Stateless 的 Particle.RandomSeed（每属性用 salt 再 hash 一次）
  RandomSeed: 'Particle.RandomSeed',
  // CurlNoise 等需要 per-particle 空间噪声偏移的模块用。spawn 时由
  // hash(uniqueId) 写入，让同一帧的不同粒子在噪声场不同采样点上。
  // 对应 UE `Particle.NoiseOffset`
  NoiseOffset: 'Particle.NoiseOffset',
  // Mesh 渲染的 per-particle 缩放（Vec3）。Sprite 用 Size(Vec2) 即可，但 Mesh
  // 需要三轴独立 — 对齐 UE `Particle.Scale` (FNiagaraDistributionRangeVector3)
  Scale: 'Particle.Scale',
  // 以下 Previous* 系列用于 motion blur / 速度反算 / interpolated rendering
  // 对齐 UE GetOutputVariables —— InitializeParticle 在 spawn 时把 PreviousXxx
  // 同步写成与 Xxx 相同的初值；之后由各自模块在 Update 阶段维护
  PreviousSpriteSize: 'Particle.PreviousSpriteSize',
  PreviousSpriteRotation: 'Particle.PreviousSpriteRotation',
  PreviousScale: 'Particle.PreviousScale',
  PreviousRibbonWidth: 'Particle.PreviousRibbonWidth',
  PreviousVelocity: 'Particle.PreviousVelocity',
  // 每粒子 quad 锚点偏移（Vec2）。(0,0)=中心；(-0.5,-0.5)=右下角。
  // Sprite Renderer 在旋转前把 corner 加上此偏移，改变粒子的旋转/展开锚点。
  // 对齐 UE NiagaraSpriteRendererProperties::PivotOffsetBinding
  PivotOffset: 'Particle.PivotOffset',
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
    createProVariable(ProStandardVariableNames.UniqueID, ProVariableTypes.Int32),
    createProVariable(ProStandardVariableNames.CameraOffset, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.Mass, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.PreviousPosition, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.RibbonLinkOrder, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.RibbonWidth, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.InitialRibbonWidth, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.RibbonUVDistance, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.InitialPosition, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.RandomSeed, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.NoiseOffset, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.Scale, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.PreviousSpriteSize, ProVariableTypes.Vec2),
    createProVariable(ProStandardVariableNames.PreviousSpriteRotation, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.PreviousScale, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.PreviousRibbonWidth, ProVariableTypes.Float),
    createProVariable(ProStandardVariableNames.PreviousVelocity, ProVariableTypes.Vec3),
    createProVariable(ProStandardVariableNames.PivotOffset, ProVariableTypes.Vec2),
  ];
}

export function createStandardParticleLayout (): ProDataSetLayout {
  return new ProDataSetLayout(createStandardParticleVariables());
}
