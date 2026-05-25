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

- [ ] **Sprite 速度朝向拉伸 (SpriteFacingAndAlignment)** — 粒子沿速度方向拉长（火花/雨滴必备），需改 vertex shader + 传入 velocity attribute
- [ ] **CameraOffset** — 粒子沿视线方向偏移，解决相交闪烁。需 buffer 字段 + 渲染器支持
- [ ] **粒子深度排序** — 半透明粒子 back-to-front 排序。支持 ViewDepth / Age / Distance 模式
- [ ] **Soft Particle** — 深度 buffer 软粒子淡入（需 depth texture 采样）

### Spawn

- [ ] **SpawnRate 支持 Distribution** — 发射速率可随时间变化（曲线/Range），目前是固定 number
- [ ] **SpawnBurst 多次触发** — 支持在多个时间点触发 burst（数组配置），目前只能触发一次

### Module 补全

- [ ] **SpriteRotationRate** — 纯速率驱动旋转 `rotation += rate * dt`（补充现有 RotationOverLife 的曲线模式）
- [ ] **ScaleColor (Distribution 版 ColorOverLife)** — 用 `DistributionColor(normalizedAge)` 驱动 per-particle random 颜色缩放
- [ ] **ScaleSpriteSize (Distribution 版 SizeOverLife)** — 用 `DistributionVector2(normalizedAge)` 驱动 per-particle random 尺寸缩放
- [ ] **CalculateAccurateVelocity** — 从位移反算速度（辅助速度依赖模块）

---

## P2 — 物理正确性

- [ ] **Mass 属性** — buffer 增加 Particle.Mass 字段；InitializeParticle 中 mass 用 Distribution 初始化
- [ ] **Drag 物理修正** — `velocity *= pow(1 - drag, dt / mass)` 而非当前的 `velocity *= (1 - drag * dt)`
- [ ] **Force 模块 mass 加权** — AccelerationForce/GravityForce 应除以 mass（F=ma → a=F/m）
- [ ] **PreviousPosition / PreviousVelocity** — 每帧开始时保存上一帧位置，用于速度朝向拉伸和运动模糊
- [ ] **InitializeParticle.SpriteSize 改为 Vector2 Distribution** — 支持非等比初始尺寸（X/Y 独立）

---

## P3 — 扩展能力

### 系统功能

- [ ] **序列化 / 反序列化** — 把粒子系统配置保存为 JSON 并从 JSON 恢复（ProParticleSystemLoader 目前是空壳）
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
