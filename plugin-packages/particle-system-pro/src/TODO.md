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

- [x] **Emitter Properties Module** (EmitterSpawn stage) — 配置 maxParticleCount / duration(Distribution) / loopBehavior / loopCount / loopDelay(Distribution) / simulationSpace / warmupTime / randomSeed / recalculateDurationEachLoop / recalculateDelayEachLoop / delayFirstLoopOnly / inactiveResponse / fixedBounds / randomSeedOffset (2026-05-25, 补完 2026-05-28)
- [x] **Simulation Space (Local/World)** — emitter.simulationSpace + worldMatrix；World 模式 spawn 后烘焙 position/velocity；renderer 用 identity (2026-05-25)
- [x] **Warmup / Pre-simulate** — 首次 tick 按 warmupTickDelta 拆分预跑 warmupTime 秒 (2026-05-25)
- [x] **Deterministic Seed 外部配置** — EmitterProperties.randomSeed → emitter.applyRandomSeed → randomStream.reseed (2026-05-25)

---

## P1 — 表现力提升

### 渲染器

- [x] **Sprite 速度朝向拉伸 (SpriteFacingAndAlignment)** — Sprite Renderer 增加 aVelocity attribute + facingMode 切换 billboard/velocity；velocity 模式下 Y 沿世界速度方向，X = cross(viewDir, Y) (2026-05-25)
- [x] **CameraOffset** — Particle.CameraOffset 字段 + ProCameraOffsetModule (ParticleUpdate, curve-over-life)；按 normalizedAge + per-particle hashSeed 采样；Sprite shader 沿"远离相机"方向偏移；正值远离、负值靠近（UE 约定） (2026-05-25, curve-over-life 2026-05-28)
- [x] **粒子深度排序** — ProSpriteRendererProperties.sortMode：none / viewDepth / distance / age；renderer 根据 camera/view 算 key 后按下标重排 vertex (2026-05-25)
- [ ] **Soft Particle** — 深度 buffer 软粒子淡入（需 depth texture 采样）

### Spawn

- [x] **SpawnRate 支持 Distribution** — rate: number → ProDistributionFloat；按 normalized emitter age (loop/once 时) 或 randomStream (Range 时) 采样 (2026-05-25)
- [x] **SpawnBurst 多次触发** — bursts: Array&lt;{time,count}&gt;；每个 entry 单独 fired 标记，loop 重置时一并重置 (2026-05-25)

### Module 补全

- [x] **SpriteRotationRate** — ProSpriteRotationRateModule (ParticleUpdate)；rate 用 ProDistributionFloat per-particle 采样 (golden-ratio hash) (2026-05-25)
- [x] **ScaleColor** — ProScaleColorModule (ParticleUpdate)；scale = ProDistributionColor；color = initialColor * scale.sampleAtTime(perParticleRand, normalizedAge) (2026-05-25)
- [x] **ScaleSpriteSize** — ProScaleSpriteSizeModule (ParticleUpdate)；scale 用 ProDistributionVector2（X/Y 独立缩放）；size = initialSize * scale (2026-05-25, Vec2 改造 2026-05-27)
- [x] **CalculateAccurateVelocity** — 从 PreviousPosition 反算速度写入 Velocity；ParticleUpdate 阶段 (2026-05-25)

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
- [x] **World Transform 接入** — Local Space 粒子已由 renderer 每帧乘 worldMatrix 刚性跟随；component 按 worldMatrix 平移增量算 emitterVelocity，新增 ProInheritVelocityModule (ParticleSpawn) 让 world-space 新粒子继承发射器世界速度×velocityScale（先世界缩放→逆旋回局部，bake 后落回世界；local 模式 no-op 避免重复计运动） (2026-05-29)
- [x] **Bounds 计算** — emitter.computeBounds() 逐帧从活跃粒子 position+size 估算 AABB；fixedBounds 配置时跳过动态计算；视锥裁剪留后续实现 (2026-05-28)
- [ ] **Scalability / LOD** — 距离 / 性能自适应降级（减少粒子数、降低发射率等）
- [ ] **Multi-Emitter 参数共享** — 通过 SystemParameterStore 在 emitter 间共享参数

### 渲染器扩展

- [ ] **Mesh Renderer** — 3D Mesh 粒子渲染管线（InitialMeshOrientation / MeshIndex / MeshRotationRate / ScaleMeshSize）
- [ ] **DynamicMaterialParameters** — per-particle float4 传入 shader；需新增 vertex attribute + shader varying（改 renderer attribute layout）
- [ ] **SpriteFacingAndAlignment CustomAlignment** — per-particle 自定义轴向量（`Particle.SpriteAlignment` Vec3 + `Particle.SpriteFacing` Vec3）+ FacingCameraDistanceBlend；需新增 vertex attributes + shader 分支（改 renderer attribute layout）
- [ ] **SubUV Frame Blending** — 帧间插值过渡（当前是 floor 跳帧）
- [ ] **Sprite SizeBySpeed 非等比拉伸** — 沿速度方向拉伸 X，垂直方向压缩 Y

#### Ribbon Renderer — 与 UE Niagara 差距

参考：`Engine/Plugins/FX/Niagara/Source/Niagara/Public/NiagaraRibbonRendererProperties.h`、`NiagaraRendererRibbons.cpp`、`Content/Modules/Ribbons/*`

**P1 — 每粒子独立 Trail（multi-ribbon，跨 emitter sample）**

当前所有粒子共享一个 RibbonID 拼成一条 ribbon；目标：每个"源"粒子各自生成一条独立 trail，完全对齐 UE Niagara 实现。

- [x] **Cross-Emitter Particle Read Data Interface** — `ProEmitterInstance.name` + `ProSystemInstance.getEmitterByName`；module 在 execute 时按名字解析 source emitter，直接拿 `source.particleDataSet.getCurrentData()` + 用 `ProStandardAccessors` 读任意 standard attribute（对应 UE `NiagaraDataInterfaceParticleRead` 的 by-index 读路径） (2026-05-26)
- [x] **Source emitter UniqueID 字段** — `Particle.UniqueID` (Int32) standard variable；InitializeParticleModule 通过 `emitter.idTable.acquire().acquireTag` 写入单调递增、永不复用的全局 ID (2026-05-26)
- [x] **Sample Particles From Other Emitter 模块（ParticleSpawn）** — `ProSampleParticlesFromOtherEmitterModule`；配 sourceEmitterName，spawn 时按 `(i-first) % numSrc` 轮询，把 source.Position → trail.Position(+previousPosition)，source.UniqueID → trail.RibbonID；trail 粒子之后照常跑 ParticleUpdate 衰减，Ribbon Renderer 自动按 RibbonID 分出独立 ribbon (2026-05-26)
- [x] **Spawn Per Source Particle 触发** — `ProSpawnPerSourceParticleModule` (EmitterUpdate)；按 `spawnRatePerSource × numSrc × dt + 累积残量` 决定本帧 trail spawn 数；source 无活粒子时清零累积避免突喷 (2026-05-26)
- [x] **System 内 emitter 顺序保证** — 仍依赖 `addEmitter` 调用顺序（cheap，O(n) emitter 数 < 10）；Sample/SpawnPerSource 在首次解析 source 时检测 `emitters.indexOf(src) > indexOf(self)` 并 console.warn 提示用户调换顺序 (2026-05-26)

**P1 — 连接稳定性与基础形态**

- [x] **RibbonLinkOrder 字段** — 独立 `Particle.RibbonLinkOrder` (float)，InitializeParticleModule 写入 `totalSpawnedParticles + (i - first)`；Ribbon Renderer 排序键改 `(RibbonID asc, LinkOrder desc)`，彻底替换 Age 排序，解决 burst 同帧 / 可变 lifetime 下连接抖动 (2026-05-26)
- [x] **RibbonWidth 字段（per-particle）** — `Particle.RibbonWidth` + `Particle.InitialRibbonWidth` standard 字段；ribbon-renderer 优先用 per-particle width，为 0 时回退 `Size.x * widthScale`；新增 `ProRibbonWidthModule` (ParticleSpawn, ProDistributionFloat) 写初值并 snapshot 到 InitialRibbonWidth；新增 `ProRibbonWidthScaleModule` (ParticleUpdate) `width = initialWidth * scale(age)` 避免每帧复合 (2026-05-26)
- [x] **RibbonUVDistance 字段（per-particle） + TiledFromStart 模式** — `Particle.RibbonUVDistance` standard 字段；SpawnPerSource 加 per-UID 距离累积器，每帧无条件按 `|currPos - prevPos|` 推进；assignment 携带 `(distAtFrameStart, frameSegLen)`；Sample 写 `uvDist = distAtFrameStart + frameSegLen * (k+0.5)/N`；ribbon-renderer 新增 `TiledFromStart` 模式，`v = abs(uvDist - ribbonStartUVDist) / tileLength`，跳过 renderer 端弧长扫描。剩余 3 种 `ENiagaraRibbonUVDistributionMode` 见后续 P2 (2026-05-26)
- [x] **CurveTension + Tessellation** — `ProRibbonTessellationMode` enum (Disabled / Custom / Automatic)；renderer 引入 `OriginalPointCache` + `InflatedPoint` 双层池：cacheOriginalAttributes 一次性读 position/size/color/velocity/ribbonWidth/uvDistance 避免 accessor 重读；buildInflatedPoints 按 ribbon 边界做带 tension 的 Catmull-Rom 细分（端点复制扮 P0/P3 防越界 / 跨 ribbon 拉伸），属性沿 t 线性插值；writeGeometry 改从 inflatedPoints 取数；customSubdivisions 防御性 clamp 0..64；Disabled 模式 subdivisions=0 退化为原始连线行为 (2026-05-26)
- [x] **DrawDirection / MaxNumRibbons** — `ProRibbonRendererProperties.drawDirection` (frontToBack/backToFront) 控制 index buffer 写入顺序；`maxNumRibbons` (0=unlimited) 在 sort 后截断多余 ribbon (2026-05-28)

**P2 — 形态扩展与朝向**

- [ ] **Shape: MultiPlane / Tube** — 当前只有 Plane（双面 quad）；MultiPlane 多片旋转、Tube 圆柱体生成
- [ ] **WidthSegmentation / TubeSubdivisions** — Plane 宽度方向分段、Tube 圆周分段
- [ ] **3 种 FacingMode** — 当前只有 `Camera`（Screen）+ `Velocity`；补 `Custom`（per-particle `RibbonFacing` 法线）和 `CustomSideVector`（per-particle 切线右向量）
- [ ] **RibbonTwist 字段** — `Particle.RibbonTwist` 沿切线旋转截面，配合 Tube / MultiPlane 才有意义
- [ ] **UV DistributionMode 完整 4 模式** — 当前只有 Stretch (≈ScaledUniformly) 与 Tile；补 `ScaledUsingRibbonSegmentLength` / `TiledFromStartOverRibbonLength` / 完整 `TiledOverRibbonLength`
- [ ] **UV0 + UV1 双通道** — 两套独立 distribution mode / tiling / offset，材质可分别采样

**P3 — 高级特性**

- [ ] **Shape: Custom（spline 自定义截面）** — 任意 2D 截面沿切线扫掠
- [ ] **DynamicMaterial0~3 + MaterialRandom** — per-particle 写入 4 个 float4 + 1 random 传到 shader
- [ ] **Motion-blur prev 绑定** — `PrevPosition / PrevRibbonWidth / PrevRibbonFacing / PrevRibbonTwist` 用于 TAA / MotionBlur
- [ ] **LeadingEdge / TrailingEdge 模式** — UV 在 ribbon 头尾的特殊渐变处理

### 编辑器

- [x] **Emitter Properties 面板** — 提到 emitter header 下方做固定面板；缺失时显示 + Add；从 stage stack 隐藏避免重复 (2026-05-26)
- [ ] **播放控制栏** — Pause / Step / Speed / Restart 统一控制
- [ ] **曲线编辑器可视化拖拽** — 拖拽控制点编辑 keyframe（当前只能输数字）
- [ ] **Copy / Paste Module** — 复制粘贴模块配置
- [ ] **Timeline 视图** — 显示各 emitter 的 spawn 时间窗口

---

## 已完成

- [x] **World Transform 接入** — emitterVelocity 追踪(component 算 worldMatrix 平移增量) + ProInheritVelocityModule 让 world-space 新粒子继承发射器运动；Local 模式刚性跟随已有 (2026-05-29)
- [x] **Ribbon DrawDirection/MaxNumRibbons + Bounds 计算** — drawDirection 控制 index buffer 写入顺序(frontToBack/backToFront)；maxNumRibbons sort 后截断多余 ribbon；emitter.computeBounds() 逐帧 AABB + fixedBounds 覆盖 (2026-05-28)
- [x] **P2 补完批量：AddVelocityInCone(innerCone/speedFalloff/linearVelocityScale) + CameraOffset curve-over-life + SpawnProbability + RandomSeedOffset + SubUV Random mode + FixedBounds 预留** (2026-05-28)
- [x] **P2 补完：EmitterProperties 完整化(Distribution duration/delay + recalculate + inactiveResponse) + ShapeLocation 参数(heightMidpoint/discCoverage/uDistribution/surfaceThickness) + Wind 模块** (2026-05-28)
- [x] **AUDIT P0/P1 全修：13 项 bug fix + 架构对齐(per-particle RandomSeed / IdTable 简化 / System Module 隔离 / PivotOffset / Unaligned facing / spawn clip 重排)** (2026-05-27~28)
- [x] **Ribbon P1 后段：CurveTension + Tessellation (Catmull-Rom 平滑曲线 / 模式 Disabled-Custom-Automatic)** (2026-05-26)
- [x] **Ribbon P1 中段：RibbonWidth (per-particle, ProRibbonWidth + ProRibbonWidthScale) + RibbonUVDistance / TiledFromStart UV 模式** (2026-05-26)
- [x] **Ribbon P1 前段：Cross-Emitter Read + UniqueID + SampleParticlesFromOtherEmitter + SpawnPerSourceParticle + RibbonLinkOrder** (2026-05-26)
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
