# Particle System Pro — Feature Roadmap

对标 UE Niagara Stateless，按优先级追踪尚未实现的功能。
每完成一项在状态栏标 `[x]` 并补充实现日期。

---

## P0 — 基础架构完善

这些不做，后续功能都有坑。

### 模拟生命周期

- [x] **EmitterSpawn 阶段执行** — `tick()` 在 `tickCount === 0` 时调用 `runStage(EmitterSpawn)` (2026-05-25)
- [x] **SystemSpawn / SystemUpdate 阶段执行** — `SystemInstance.tick()` 首帧跑 SystemSpawn，之后每帧跑 SystemUpdate；提供 modules 数组 + runSystemStage (2026-05-25)
- [x] **Emitter Lifetime + Loop 控制** — EmitterPropertiesModule 配置 duration / loopCount / loopDelay；emitterAge 超时后自动转 Inactive；postTick 检查粒子耗尽转 Complete (2026-05-25)
- [x] **System Lifetime / 自动 Complete** — 所有 emitter 都 Complete 时 System 标记 Complete (2026-05-25)

### Emitter 属性

- [x] **Emitter Properties Module** (EmitterSpawn stage) — 配置 maxParticleCount / duration / loopBehavior / loopCount / loopDelay / simulationSpace / warmupTime / randomSeed (2026-05-25)
- [x] **Simulation Space (Local/World)** — emitter.simulationSpace + worldMatrix；World 模式 spawn 后烘焙 position/velocity；renderer 用 identity (2026-05-25)
- [x] **Warmup / Pre-simulate** — 首次 tick 按 warmupTickDelta 拆分预跑 warmupTime 秒 (2026-05-25)
- [x] **Deterministic Seed 外部配置** — EmitterProperties.randomSeed → emitter.applyRandomSeed → randomStream.reseed (2026-05-25)

---

## P1 — 表现力提升

### 渲染器

- [x] **Sprite 速度朝向拉伸 (SpriteFacingAndAlignment)** — Sprite Renderer 增加 aVelocity attribute + facingMode 切换 billboard/velocity；velocity 模式下 Y 沿世界速度方向，X = cross(viewDir, Y) (2026-05-25)
- [x] **CameraOffset** — Particle.CameraOffset 字段 + ProCameraOffsetModule (ParticleSpawn)；Sprite shader 沿"远离相机"方向偏移；正值远离、负值靠近（UE 约定） (2026-05-25)
- [x] **粒子深度排序** — ProSpriteRendererProperties.sortMode：none / viewDepth / distance / age；renderer 根据 camera/view 算 key 后按下标重排 vertex (2026-05-25)
- [ ] **Soft Particle** — 深度 buffer 软粒子淡入（需 depth texture 采样）

### Spawn

- [x] **SpawnRate 支持 Distribution** — rate: number → ProDistributionFloat；按 normalized emitter age (loop/once 时) 或 randomStream (Range 时) 采样 (2026-05-25)
- [x] **SpawnBurst 多次触发** — bursts: Array&lt;{time,count}&gt;；每个 entry 单独 fired 标记，loop 重置时一并重置 (2026-05-25)

### Module 补全

- [x] **SpriteRotationRate** — ProSpriteRotationRateModule (ParticleUpdate)；rate 用 ProDistributionFloat per-particle 采样 (golden-ratio hash) (2026-05-25)
- [x] **ScaleColor** — ProScaleColorModule (ParticleUpdate)；scale = ProDistributionColor；color = initialColor * scale.sampleAtTime(perParticleRand, normalizedAge) (2026-05-25)
- [x] **ScaleSpriteSize** — ProScaleSpriteSizeModule (ParticleUpdate)；scale 用 ProDistributionFloat (uniform XY 简化版，UE 是 Vec2)；size = initialSize * scale (2026-05-25)
- [ ] **CalculateAccurateVelocity** — 从位移反算速度。**Deferred**：依赖 P2 PreviousPosition buffer 字段

---

## P2 — 物理正确性

- [x] **Mass 属性** — Particle.Mass buffer 字段 + accessor；InitializeParticle.mass: ProDistributionFloat 默认 1 (2026-05-25)
- [x] **Drag 物理修正** — Stokes 衰减：`velocity *= exp(-drag * dt / mass)`，大 dt 下稳定不爆炸 (2026-05-25)
- [ ] **Force 模块 mass 加权** — 不需要：现有 Gravity/AccelerationForce 语义已经是加速度（不带质量）；如需"力"模块可后续补 AddForce
- [x] **PreviousPosition** — Particle.PreviousPosition 字段；emitter tick 在 ParticleUpdate 前自动备份 position；CalculateAccurateVelocity 用它反算速度 (2026-05-25)
- [x] **InitializeParticle.SpriteSize 改为 Vector2 Distribution** — 新建 ProDistributionVector2 + fromUniformConstant；startSize 支持 X/Y 独立或 uniform (2026-05-25)

---

## P3 — 扩展能力

### 系统功能

- [x] **序列化 / 反序列化** — 通过组件 toData/fromData：Distribution/Curve 加 toJSON/fromJSON；新建 module-serialization helpers + ProModuleData typeId 反查；ProParticleSystem(Renderer)Component.toData/fromData；texture 用 URL 序列化反序列化时异步重载；verifyRoundtripModules() smoke 测试 (2026-05-26)
- [ ] **事件系统** — 粒子死亡/碰撞等事件触发回调或 spawn 新粒子
- [ ] **World Transform 接入** — Transform 移动时粒子 inherit velocity；Local Space 粒子跟随物体
- [ ] **Bounds 计算** — 包围盒估算，用于视锥裁剪
- [ ] **Scalability / LOD** — 距离 / 性能自适应降级（减少粒子数、降低发射率等）
- [ ] **Multi-Emitter 参数共享** — 通过 SystemParameterStore 在 emitter 间共享参数

### 渲染器扩展

- [ ] **Mesh Renderer** — 3D Mesh 粒子渲染管线
- [ ] **DynamicMaterialParameters** — 自定义 float4 传入 shader
- [ ] **SubUV Frame Blending** — 帧间插值过渡（当前是 floor 跳帧）
- [ ] **Sprite SizeBySpeed 非等比拉伸** — 沿速度方向拉伸 X，垂直方向压缩 Y
- [ ] **RibbonLinkOrder / 稳定连接顺序** — 增加独立的 `Particle.RibbonLinkOrder`，避免当前按 Age 排序在 burst / 可变 lifetime 下产生不稳定连接
- [ ] **RibbonDistanceFromStart / RibbonProgress** — 为每个 ribbon 点生成沿带距离或 0..1 进度，供 UV、颜色、宽度等效果复用，而不是复用粒子 `normalizedAge`
- [ ] **Ribbon Over Trail Controls** — 支持按 `RibbonProgress` 驱动 Color / Width / Twist，使拖尾渐变与粒子 lifetime 解耦

### 编辑器

- [ ] **Emitter Properties 面板** — 配置 lifetime/loop/capacity/space 等 emitter 级设置
- [ ] **播放控制栏** — Pause / Step / Speed / Restart 统一控制
- [ ] **曲线编辑器可视化拖拽** — 拖拽控制点编辑 keyframe（当前只能输数字）
- [ ] **Copy / Paste Module** — 复制粘贴模块配置
- [ ] **Timeline 视图** — 显示各 emitter 的 spawn 时间窗口

---

## 已完成

- [x] **P3 序列化：toData/fromData + Distribution/Curve toJSON/fromJSON + module-serialization helpers + Texture URL 序列化** (2026-05-26)
- [x] **P2 物理：Mass + PreviousPosition buffer 字段 + InitializeParticle 初始化；Drag 改 Stokes 衰减；CalculateAccurateVelocity 模块；ProDistributionVector2 + InitializeParticle.startSize X/Y 独立** (2026-05-25)
- [x] **P1 渲染 + Spawn 增强：CameraOffset + Sprite 深度排序 + SpawnRate Distribution + SpawnBurst 多次触发** (2026-05-25)
- [x] **P1 模块补全：ScaleColor + ScaleSpriteSize（CalculateAccurateVelocity 因依赖 PreviousPosition 延后）** (2026-05-25)
- [x] **P1 起步：SpriteRotationRate 模块 + Sprite 速度朝向拉伸 (SpriteFacingAndAlignment)** (2026-05-25)
- [x] **P0 完成：Simulation Space (Local/World) + Warmup + Deterministic Seed + SystemSpawn/SystemUpdate 基建** (2026-05-25)
- [x] **EmitterSpawn 阶段执行 + EmitterPropertiesModule + Loop/Duration 状态机 + System 自动 Complete** (2026-05-25)
- [x] **InitializeParticle startColor → ProDistributionColor** (2026-05-22)
- [x] **InitializeParticle startSize → ProDistributionFloat** (2026-05-22)
- [x] **AddVelocity 三合一 (Linear/InCone/FromPoint)** (2026-05-22)
- [x] **RotateAroundPoint 模块** (2026-05-22)
- [x] **编辑器 CONDITIONAL_PROPS 条件属性显示** (2026-05-22)
- [x] **编辑器 ProDistributionFloat/Vector3/Color 控件** (2026-05-22)
- [x] **编辑器 Enum Combo 下拉** (2026-05-22)
- [x] **ShapeLocation 五种形状** (已有)
- [x] **GravityForce / AccelerationForce / CurlNoiseForce / Drag** (已有)
- [x] **SolveForcesAndVelocity 积分** (已有)
- [x] **ColorOverLife (Curve)** (已有)
- [x] **SizeOverLife (Curve)** (已有)
- [x] **ScaleSizeBySpeed** (已有)
- [x] **SubUVAnimation** (已有)
- [x] **SpawnRate / SpawnBurst** (已有)
- [x] **UpdateAge + Kill** (已有)
- [x] **InitializeRotation (Distribution)** (已有)
- [x] **Ribbon Renderer (Camera/Velocity facing, Stretch/Tile UV)** (已有)
- [x] **Sprite Renderer (Billboard + SubUV)** (已有)

---

## 参考

- UE Niagara Stateless 源码: `Engine/Plugins/FX/Niagara/Source/Niagara/Internal/Stateless/Modules/`
- UE Niagara Common: `NiagaraStatelessModuleCommon.h` — FPhysicsBuildData (Mass/Drag/Velocity/Wind ranges)
