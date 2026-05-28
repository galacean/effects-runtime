# Particle System Pro — UE Niagara 对齐审计

审计日期：2026-05-27
文档更新：2026-05-27
对照源：`D:/Developments/git/UnrealEngine/Engine/Plugins/FX/Niagara/`（Stateless 模块为主）

每条缺陷标注：
- `[WRONG]` 实际输出错了
- `[INCOMPLETE]` 功能能跑但参数/模式不全
- `[LAZY]` 违反 UE 架构的简化
- `[MISSING]` UE 有、我们完全没有
- `[DEAD]` 死代码 / 冗余
- `[FIXED]` 已修复（带修复说明）

修复优先级见末尾。

---

## 🔴 P0 — 真实 BUG（视觉/行为错误）

### #1 [FIXED] RotateAroundPoint 螺旋外飞
- 位置：`modules/builtin/rotate-around-point-module.ts`
- 修复：重写为绝对位置公式 `position = origin + RotMatrix(baseAngle + rate·age + phase) · baseR·scale`；
  baseR / baseAngle 由 `initialPosition - origin` 推出（spawn 时已 capture）。
  `radius` 字段移除，改为 `radiusScale`（默认 1，沿用 spawn 半径）

### #2 [FIXED] Ribbon UV 在多 ribbon 场景下错位
- 位置：`renderers/ribbon-renderer.ts`
- 修复：新增 `endIdxForPoint: Int32Array` 字段 + `computeRibbonRanges()` pre-pass
  （从后向前扫描，给每个 point 写所在 ribbon 的最后下标）；
  Stretch 模式 v-coord 改用 `(i - ribbonStart) / (endIdxForPoint[i] - ribbonStart)`

### #3 [FIXED] SpawnRate range 模式每帧抖动
- 位置：`modules/builtin/spawn-rate-module.ts`
- 修复：新增 `cachedRate / cachedLoopIdx / lastSeenAge` 字段；
  仅在 loop 切换（`emitter.loopIndex !== cachedLoopIdx`）或 emitter 重启
  （`emitterAge < lastSeenAge`）时重采样 rate。对齐 UE `InitSpawnInfos` 每 loop 一次

### #4 [FIXED] SpawnBurst 有 duration 的 infinite 模式整个生命周期只 fire 一次
- 位置：`modules/builtin/spawn-burst-module.ts`
- 修复：`duration > 0` 时改用 `emitterAge % emitter.duration` 计算 loop 内年龄，
  使 bursts 在每个 loop 内重新激活；`duration <= 0` 时保持单次时间轴，
  每条 burst 只按绝对时间触发一次。与 UE `InitSpawnInfosForLoop` 语义一致

### #5 [FIXED] Loop 状态机大 dt 漏触发
- 位置：`simulation/emitter-instance.ts`
- 修复：改为 `while (loopAge >= duration)` 连续扣减 duration 并推进 `currentLoop`；
  同时保留 `pendingLoopOverrun` 处理 loopDelay，确保大 dt 一帧也能正确跨多个 loop

### #6 [FIXED] 新粒子 `dt=0` update 跳过子帧插值
- 位置：`simulation/emitter-instance.ts`
- 修复：移除 `dt=0` 简化；改为按 `SpawnInfo` 的 `interpStartDt / intervalDt`
  对每个新粒子单独运行 `ParticleUpdate(subDt)`，老粒子仍按全 dt 走

### #7 [FIXED] loopDelay > 0 时 loopAge 跨 loop 累积
- 位置：`simulation/emitter-instance.ts`
- 修复：进入 delay 前把 `(loopAge - duration)` 缓存到 `pendingLoopOverrun`；
  delay 结束后用 `pendingLoopOverrun + (-delayRemaining)` 还原到新 loop 起点，避免节奏漂移

### #8 [FIXED] SpriteRotationRate Curve 模式失效
- 位置：`modules/builtin/sprite-rotation-rate-module.ts`
- 修复：把 `t=0` 改成 `normalizedAge = clamp(age/lifetime, 0, 1)`，
  Curve / Range / Constant 模式语义都对齐 UE

### #9 [FIXED] ScaleSpriteSizeBySpeed 算法整个不对
- 位置：`modules/builtin/scale-size-by-speed-module.ts`
- 修复：删除 `referenceSpeed/intensity/maxFactor`；新增 `scaleDistribution: ProDistributionVector2`
  和 `velocityNorm: number`；算法重写为 `t = clamp(speedSq * velocityNorm, 0, 1)` →
  `size = initialSize * scaleDistribution.sample(t)`。Breaking change — demo 同步更新

### #10 [FIXED] UpdateAge kill 边界
- 位置：`modules/builtin/update-age-module.ts`
- 修复：旧版 AUDIT 描述的 in-place tail-swap kill 路径早已不存在 ——
  当前实现是 `markInstanceKilled(i)` 仅设 killMask 位 + `Math.min(lastInstance, numInstances)`
  上界保护 + 阶段边界统一 `compactKilledInstances`；遍历顺序与正确性无关。
  本次将反向遍历改为正向遍历，纯 UE convention 对齐（UE bMarkedDead 模式都是正向）

### #11 [FIXED] AddVelocity coneAngle 单位与 UE 不一致
- 位置：`modules/builtin/add-velocity-in-cone-module.ts`
- 修复：保留 `coneAngle` 字段名（全角语义），内部用 `cos(coneAngle * 0.5)` 算半角余弦；
  默认值改为 `Math.PI / 3`（与 UE 一致）

### #12 [FIXED] ShapeLocation Ring 内圈密度偏高
- 位置：`modules/builtin/shape-location-module.ts`
- 修复：`sampleRing` 改用面积均匀公式
  `r = sqrt(innerR² + (outerR² - innerR²) * rs)`，r² 在 [innerR², outerR²] 上均匀

### #13 [FIXED] CurlNoise 实现错误
- 位置：`modules/builtin/curl-noise-force-module.ts`
- 修复：完整重写为 Bridson curl —— 3 个 scalar potentials ψ₁/ψ₂/ψ₃（错开偏移 0/31.416/62.832），
  采样轴改为 per-particle `(age, normalizedAge, uniqueId) * freq + noiseOffset`；
  6 个偏导数（central differences）算 Jacobian，3 个 curl 分量
  `(∂ψ₃/∂y - ∂ψ₂/∂z, ∂ψ₁/∂z - ∂ψ₃/∂x, ∂ψ₂/∂x - ∂ψ₁/∂y)` 全部填齐

---

## 🟠 P1 — 架构性偷懒

### A. [N/A] ~~缺少 `FPhysicsBuildData` 聚合管线~~

原审计误判——`FPhysicsBuildData` 与闭式积分是 **UE Stateless 专有设计**（Stateless 不存
velocity，每帧从 age 重新算位置）。我们对标的是 **UE Stateful**（NiagaraScript 模块），
Stateful 的力模块就是逐帧 Euler 积分：

- GravityForce：`velocity += gravity * dt`
- AccelerationForce：`velocity += acceleration * dt`
- Drag：`velocity *= (1 - drag * dt)` 或指数衰减
- SolveForcesAndVelocity：`position += velocity * dt`

模块执行顺序由用户在编辑器中排列（与 UE Stateful 行为一致，by design）。
Wind / ConeVelocity / PointVelocity 在 Stateful 架构下是独立的普通模块，
不需要聚合管线。

**本项不需要修复。**

### B. [FIXED] Distribution 类型与 UE 反向

UE Stateless 多数 distribution 是 **range-only**（`AccelerationForce.h:18 DisableUniformDistribution`），少数支持 curve 的明确标出。

当前状态：
- ✅ `gravity-force-module.ts` 改用 `ProDistributionVector3`（per-particle stable random via `Particle.RandomSeed`）
- ✅ `initialize-particle-module.ts` `positionOrigin` 改用 `ProDistributionVector3`
- ✅ `acceleration-force-module.ts` 随机源从 `randomStream.nextFloat()`（每帧抖）改为 `a.randomSeed.get(...)`（per-particle stable）
- ✅ `scale-sprite-size-module.ts` 已改为 `ProDistributionVector2`，X/Y 独立缩放，和 UE 当前语义一致
- ✅ `drag-module.ts` 删除 `ProCurveFloat`，改 `ProDistributionFloat`（Constant/Range，与 UE
  `FNiagaraDistributionRangeFloat` 对齐）；运行时通过 `Particle.RandomSeed + hashSeed(Drag salt)`
  做 per-particle stable random — 一个粒子一生只算一次 drag 值。Demo 同步迁移

### C. [FIXED] per-particle 随机源错误（关联性 bug）

修复：
- `standard-variables.ts` 新增 `RandomSeed: float` 字段
- `standard-accessors.ts` 暴露 `randomSeed` accessor
- `initialize-particle-module.ts` spawn 时一次性写入 `randomStream.nextFloat()`
- 新增 `utils/per-particle-rand.ts`，内含 `ParticleRandSalts`
  （Rate / Radius / Phase / ScaleX / ScaleY / Color / Speed / Drag / Generic）
  + `hashSeed(seed, salt)` LCG hash
- 当前已迁移到 `hashSeed(randomSeed, salt)` 的模块：`scale-color`、`scale-sprite-size`、
  `sprite-rotation-rate`、`rotate-around-point`、`ribbon-width-scale`、`drag`
- `gravity-force-module.ts` / `acceleration-force-module.ts` 也已改为读取 `Particle.RandomSeed`
  做 per-particle stable sampling，不再依赖 slot index 或每帧随机流
- 每个属性使用不同 salt → 解相关，且 slot 复用不再共享 rand

### D. [FIXED] ID / 状态泄露

- ✅ `utils/id-table.ts` 删除 `freeList` / `nextIndex` / `release()` / `capacity` 死代码 ——
  这些字段从未被读过；`ProIdTable` 简化为单一 `nextUniqueIndex` monotonic counter，
  与 UE `FNiagaraStatelessEmitterInstance::UniqueIndexOffset` 1:1 对齐。`acquire()`
  返回 `number`（旧返回的 `{index, acquireTag}` 中的 index 半也从未被使用），
  `reset()` 重置为 0（对应 UE `ResetSimulation(bKillExisting=true)`）。
  `types/particle-id.ts` 同步删除（无任何外部引用）
- ✅ System 级模块完全独立类型体系（方案 A，对齐 UE Stateful 架构）：
  新增 `ProSystemModule` 基类 + `ProSystemModuleStage` 类型（`system-module.ts`），
  与 `ProModule`（Emitter/Particle 级）完全隔离。`ProModuleStage` 枚举移除
  `SystemSpawn` / `SystemUpdate`（仅保留 Emitter/Particle 四阶段）。
  `ProSystemInstance.systemModules: ProSystemModule[]` 独立于 `emitter.modules`。
  `runSystemStage` 调用 `ProSystemModule.execute(ctx: ProSystemModuleContext)`，
  上下文不含 emitterInstance / dataBuffer。TypeScript 编译期保证 system 模块
  无法访问 emitter / particle 数据——对齐 UE：System Script 与 Emitter Script
  是完全不同的脚本资产类型，操作不同的 DataSet

### E. [PARTIAL FIXED] 渲染器偷懒

- ✅ `renderers/sprite-renderer.ts` 新增 `sortScratch: number[]` 字段，
  每帧复用而非 `const idxArr: number[] = []` 重新分配 → GC 抖动消失
- ✅ Sprite renderer 新增 PivotOffset（per-particle Vec2 偏移 + shader 支持）——
  `Particle.PivotOffset` 变量 + accessor + vertex attribute `aPivotOffset`，
  shader 在旋转前用 `aCorner + aPivotOffset` 偏移角点，改变粒子的旋转/展开锚点。
  对齐 UE `NiagaraSpriteRendererProperties::PivotOffsetBinding`
- ✅ Sprite renderer 新增 `unaligned` 朝向模式——不做 billboard，quad 在物体
  局部 XY 平面展开。对齐 UE `ENiagaraSpriteAlignment::Unaligned`
- ⏸ Sprite renderer 仍缺 CustomAlignment / CutoutTexture / 自定义 Material —— P2 范围，
  CustomAlignment 需配合 SpriteFacingAndAlignment 模块（P2 缺失模块）
- ⏸ Ribbon renderer 只读 `tmpSize[0]` —— 与现有 RibbonWidth 模块设计一致，
  改 size.y 会破坏 Sprite/Ribbon 共用 size 字段的语义

### F. [FIXED] SystemInstance tick 顺序不完整

修复：
- `emitter-instance.ts` 从 `tickInner` 末尾移除 `this.postTick()`
- `system-instance.ts` 改成三段调度 `for(preTick); for(tick); for(postTick);`
  跨 emitter sample 现在能读到一致的 frame N state，不再有 dirty data 风险

---

## 🟡 P2 — 缺失模块 / 字段

### 缺失的整模块

| UE Stateless 模块 | 状态 |
|---|---|
| `SpriteFacingAndAlignment` | **缺**；renderer facingMode 只有 'billboard'/'velocity'，缺 Unaligned/CustomAlignment/Automatic + FacingCameraDistanceBlend |
| `InitialMeshOrientation` | 缺 |
| `MeshIndex` / `MeshRotationRate` / `ScaleMeshSize*` | 缺（mesh 整套） |
| `DynamicMaterialParameters` | 缺 |
| 内置 Wind module | ✅ `ProWindForceModule`（对标 Stateful，独立力模块） |

### 缺失的字段 / 模式

| 位置 | 缺失内容 | UE 来源 |
|---|---|---|
| `emitter-properties-module.ts` | ✅ `LoopDuration / LoopDelay` 改为 `ProDistributionFloat`；`recalculateDurationEachLoop`、`recalculateDelayEachLoop`、`delayFirstLoopOnly` | `Internal/Stateless/NiagaraSystemEmitterState.h:87-101` |
| `emitter-properties-module.ts` | ✅ `inactiveResponse: 'complete' \| 'kill'`（kill → InactiveClear 立即清场） | `NiagaraStatelessEmitterInstance.cpp:538` |
| `emitter-properties-module.ts` | `FixedBounds` | `NiagaraStatelessEmitter.h:119` |
| `sub-uv-animation-module.ts` | `Random` mode + `RandomChangeInterval`；`StartFrameRangeOverride/EndFrameRangeOverride` | `Internal/Stateless/Modules/NiagaraStatelessModule_SubUVAnimation.h:14-17` |
| `camera-offset-module.ts:26` | 支持 curve-over-life（当前只 ParticleSpawn 阶段算，丢失 push-pull 效果） | UE `BuildContext.AddDistribution` |
| `add-velocity-in-cone-module.ts` | `LinearVelocityScale` / `InnerCone` / `SpeedFalloffFromConeAxis` | `Internal/Stateless/Modules/NiagaraStatelessModule_AddVelocity.h:32,41` |
| `shape-location-module.ts` | ✅ Box `surfaceThickness`；Cylinder `heightMidpoint`；Ring `discCoverage / uDistribution` | `Internal/Stateless/Modules/NiagaraStatelessModule_ShapeLocation.h:36-55` |
| `spawn-rate-module.ts` / `spawn-burst-module.ts` | `SpawnProbability`；burst `Amount = DistributionRangeInt` | `Internal/Stateless/NiagaraStatelessSpawnInfo.h:39-43` |
| `system-instance.ts` | `RandomSeedOffset`（两个同 seed emitter 解相关） | `NiagaraStatelessEmitterInstance.cpp:66` |

---

## ⚪ 死代码 / 冗余 — [FIXED]

| 位置 | 状态 |
|---|---|
| `modules/builtin/box-location-module.ts` | ✅ 已删除 |
| `modules/builtin/sphere-location-module.ts` | ✅ 已删除（uniform 采样已在 `shape-location-module.ts.sampleSphere` 保留） |
| `simulation/tick-context.ts` | ✅ 已删除（含 `index.ts` 中的 export） |
| `shape-location-module.ts` 的 `center` 字段 | ✅ 已删除（toJSON / fromJSON / execute 全部去 center） |
| `color-over-life-module.ts` / `size-over-life-module.ts` | ✅ 已删除 |

---

## 修复优先级

### ✅ 已修（输出已经错了 → 现在正确）
1. ✅ #1 RotateAroundPoint 螺旋外飞 → 绝对位置公式
2. ✅ #2 Ribbon UV 错位 → 每 ribbon 单独算 endIndex
3. ✅ #3 SpawnRate range 抖动 → 每 loop 一次采样
4. ✅ #5 Loop 状态机大 dt → while 连续推进 loop + 保留 delay overrun
5. ✅ #4 SpawnBurst 有 duration 的 infinite 死路径 → `emitterAge % duration`
6. ✅ #12 ShapeLocation Ring 面积非均匀 → sqrt(rs) 公式

### ✅ 架构对齐
7. ✅ **A 项：N/A** — PhysicsBuildData 是 Stateless 专有，我们对标 Stateful 逐帧 Euler 即正确
8. ✅ **C 项：`Particle.RandomSeed` 字段** + 多模块 stable-rand 迁移完成
9. ✅ #6 子帧插值 spawn（per-particle partialDt 替换 dt=0 hack）
10. ✅ D 项：`ProIdTable` 删除 freeList/index 死代码 + `runSystemStage` 改用
    `ProSystemModuleContext`（无 emitterInstance）+ `executeSystem()` 分离执行
11. ✅ 死代码清理（box-location、sphere-location、tick-context、center、color-over-life、size-over-life、particle-id）

### ✅ 已重写错误算法
12. ✅ #9 ScaleSpriteSizeBySpeed → UE Vec2 曲线 + speed²·VelocityNorm
13. ✅ #13 CurlNoise → 3 个 scalar potentials + Jacobian
14. ✅ #8 SpriteRotationRate Curve → normalizedAge
15. ✅ #10 UpdateAge kill 边界 — 实际已 fixed（`markInstanceKilled` 延迟 + 阶段边界 compact），本次正向遍历对齐 UE convention
16. ✅ #11 AddVelocity coneAngle → 全角语义

### ⏸ 缺失功能补完（P2，本次未修）
17. SpriteFacingAndAlignment 模块 + renderer CustomAlignment（PivotOffset / Unaligned 已实现）
18. SubUVAnimation Random mode
19. ShapeLocation 缺失参数
20. EmitterProperties 完整化（LoopDuration range / RecalculateEachLoop / InactiveResponse）
21. Mesh 整套（InitialMeshOrientation / MeshIndex / MeshRotationRate / ScaleMeshSize）
22. DynamicMaterialParameters

---

## 当前 HEAD 状态总结（2026-05-28 更新）

- **P0：13 项全部修复**
- **P1：全部完成**（A 项确认 N/A；B / C / D / E / F 已修）
- **死代码：7 项全部清理**
- 补修 (2026-05-27)：drag distribution range-only / idTable monotonic counter / UpdateAge 正向遍历
- 补修 (2026-05-27)：P1-D runSystemStage → ProSystemModuleContext / P1-E PivotOffset + Unaligned mode
- 补修 (2026-05-28)：spawn clip 逻辑重排（先 compact 再算 availableSpawnSlots）+ 移除无意义 warning
- 补修 (2026-05-28)：P2 部分完成 — EmitterProperties 完整化 + ShapeLocation 参数补齐 + Wind 模块

剩余未做：FixedBounds、SubUVAnimation Random mode、CameraOffset curve-over-life、
AddVelocityInCone 缺失字段、SpawnProbability、RandomSeedOffset、
SpriteFacingAndAlignment、Mesh 整套、DynamicMaterialParameters

---

## 参考

- UE Stateless 模块入口：`D:/Developments/git/UnrealEngine/Engine/Plugins/FX/Niagara/Source/Niagara/Internal/Stateless/Modules/`
- UE Stateless shaders：`D:/Developments/git/UnrealEngine/Engine/Plugins/FX/Niagara/Shaders/Private/Stateless/Modules/`
- UE PhysicsBuildData：`Internal/Stateless/Modules/NiagaraStatelessModuleCommon.h` (FPhysicsBuildData)
- UE Stateless EmitterInstance：`Private/Stateless/NiagaraStatelessEmitterInstance.cpp`
