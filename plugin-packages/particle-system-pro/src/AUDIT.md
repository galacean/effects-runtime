# Particle System Pro — UE Niagara 对齐审计

审计日期：2026-05-26
修复日期：2026-05-26
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

### #3 [WRONG] SpawnRate range 模式每帧抖动
- 位置：`modules/builtin/spawn-rate-module.ts:46` 每 tick 重采样 rate
- UE：`Private/Stateless/NiagaraStatelessEmitterInstance.cpp:385` 每个 loop 在 `InitSpawnInfos` 采样**一次**到 `FActiveSpawnRate.Rate`
- 现象：用 `fromRange(20, 40)` 时 spawn 节奏忽快忽慢

### #4 [WRONG] SpawnBurst infinite 模式整个生命周期只 fire 一次
- 位置：`modules/builtin/spawn-burst-module.ts:58`：`duration <= 0 → age = emitterAge`；loop 永远不重置 → bursts 单次后死
- 注释自己承认"退化"
- UE：`NiagaraStatelessEmitterInstance.cpp:432-459` `InitSpawnInfosForLoop` 每个 loop 重建 burst 列表

### #5 [WRONG] Loop 状态机大 dt 漏触发
- 位置：`simulation/emitter-instance.ts:395` 只 `loopAge -= duration` 一次
- UE：`NiagaraStatelessEmitterInstance.cpp:251-277` `do { ++LoopCount; ... } while (Age >= CurrentLoopAgeEnd)`
- 现象：tab 切换回来一帧 `dt > 2*duration` 时 loop 计数滞后、spawn 窗口漏触发

### #6 [WRONG] 新粒子 `dt=0` update 跳过子帧插值
- 位置：`simulation/emitter-instance.ts:261` 注释自承简化
- UE：真正的 `SpawnTimeStart..Age` interpolated spawn，新粒子在生成那一帧就有 `(now - spawnTime) * velocity` 偏移
- 现象：60Hz 高发射率下粒子全卡在 emitter 原点 → "stutter at origin"

### #7 [WRONG] loopDelay > 0 时 loopAge 跨 loop 累积
- 位置：`simulation/emitter-instance.ts:367` delay 结束后 `loopAge = -delayRemaining`，**没有**先 `loopAge -= duration`
- 修：进入 delay 时立刻 `loopAge -= duration`

### #8 [WRONG] SpriteRotationRate Curve 模式失效
- 位置：`modules/builtin/sprite-rotation-rate-module.ts:62` `rate.sampleAtTime(pRand, 0)` 永远采到 `t=0`
- 修：要么拒绝 Curve 模式，要么用 normalizedAge

### #9 [WRONG] ScaleSpriteSizeBySpeed 算法整个不对
- 位置：`modules/builtin/scale-size-by-speed-module.ts:71` `factor = clamp(speed/refSpeed)` + 自创 `intensity/maxFactor`
- UE：`Internal/Stateless/Modules/NiagaraStatelessModule_ScaleSpriteSizeBySpeed.h:36-47` — Vec2 **曲线**，索引为 `speed²·VelocityNorm`（speed² 归一化 0..1 查表）
- 修：重写为 `ProDistributionVector2` curve + speed² 索引

### #10 [WRONG] UpdateAge kill 边界
- 位置：`modules/builtin/update-age-module.ts:39` 循环上界在 kill 前 capture，kill 缩小 numInstances 后仍按旧上界遍历
- 风险：取决于 `killInstance` 实现（tail-swap 应该 OK），但属于隐式依赖
- 修：用 while 循环 + 动态检查 numInstances

### #11 [WRONG] AddVelocity coneAngle 单位与 UE 不一致
- 位置：`modules/builtin/add-velocity-in-cone-module.ts:132` 当**半角**用
- UE：`Internal/Stateless/Modules/NiagaraStatelessModule_AddVelocity.h:38-40` `ConeAngle` 是**全角**（0–360），`.cpp:63` `ConeHAngle = ConeAngle/2`
- 现象：同名字段同默认值在 UE/我们这里出来锥体大一倍
- 修：要么改字段名为 `coneHalfAngle`，要么改实现除以 2

### #12 [WRONG] ShapeLocation Ring 内圈密度偏高
- 位置：`modules/builtin/shape-location-module.ts:199` `radius + (rs-0.5)*thickness`，在 r 上均匀 → 面积上偏内圈
- UE：`Shaders/Private/Stateless/Modules/NiagaraStatelessModule_ShapeLocation.ush:67` `lerp(R*(1-SDC), R*SDC, sqrt(rs))` 面积均匀
- 修：把 `rs` 改成 `sqrt(rs)` 或按 UE 的 DiscCoverage 公式重写

### #13 [WRONG] CurlNoise 实现错误
- 位置：`modules/builtin/curl-noise-force-module.ts`
  - `:65-67` 采样在 `position*frequency`（空间噪声）
  - `:80` `n3y` 注释掉了 → Z 方向 curl 永远为 0
- UE：`Shaders/Private/Stateless/Modules/NiagaraStatelessModule_CurlNoiseForce.ush:103-112` per-particle `(Age, NormalizedAge, UniqueIndex)` **时间噪声** + 完整 Jacobian curl `(J[1][2]-J[2][1], J[2][0]-J[0][2], J[0][1]-J[1][0])`
- 修：完整重写，补完 z 分量、改采样轴、补 NoiseOffset per-particle

---

## 🟠 P1 — 架构性偷懒

### A. 缺少 `FPhysicsBuildData` 聚合管线（最大架构差距）

UE 所有力模块**只写 range 到 PhysicsBuildData**，由 `SolveVelocitiesAndForces` 一次性闭式解析积分：

```
LambdaAge = (1 - exp(-Drag/Mass * Age)) / (Drag/Mass)
Position = InitialPos
         + (V₀ - W) * LambdaAge
         + W * Age
         + Acceleration * (Age - LambdaAge) / (Drag/Mass)
```
参考 `Shaders/Private/Stateless/Modules/NiagaraStatelessModule_SolveVelocitiesAndForces.ush:49-56`

**我们的现状（全部偏离）：**
- `gravity-force-module.ts:58` 直接 `velocity += g*dt`
- `acceleration-force-module.ts:58-70` 直接 `velocity += a*dt`
- `drag-module.ts:66-69` 直接 `velocity *= exp(-drag*dt/mass)`
- `solve-forces-and-velocity-module.ts:39-48` 只剩 `position += v*dt`

**后果：**
- drag + acceleration 共存时一阶 Euler 与 UE 闭式解发散
- 模块顺序成为隐式合约（`emitter-instance.ts:416` runStage 不做依赖校验）
- Wind / ConeVelocity / PointVelocity 三个 PhysicsBuildData 字段完全没法接入

**P0 修复后建议优先做这一项**，后续物理模块对齐成本会暴跌。

### B. Distribution 类型与 UE 反向

UE Stateless 多数 distribution 是 **range-only**（`AccelerationForce.h:18 DisableUniformDistribution`），少数支持 curve 的明确标出。

我们的实现反向：
- `gravity-force-module.ts:9` 裸 `[number,number,number]` ❌（UE 是 `FNiagaraDistributionRangeVector3`）
- `initialize-particle-module.ts:39` `positionOrigin` 裸 Vec3 ❌
- `scale-sprite-size-module.ts:32` 用 `ProDistributionFloat`（uniform XY），但 `ProDistributionVector2` **已经存在**且被 `initialize-particle-module.ts:37` 用了 ❌ 纯偷懒
- 反之 `drag-module.ts:28` 用了 `ProCurveFloat`，UE 是 `FNiagaraDistributionRangeFloat`（range-only）— 扩展过头

### C. per-particle 随机源错误（关联性 bug）

4 个模块用 `(i * GOLDEN_RATIO_FRAC) % 1` ——**slot 索引 hash**：
- `scale-sprite-size-module.ts`
- `scale-color-module.ts`
- `sprite-rotation-rate-module.ts`
- `rotate-around-point-module.ts:72`

**后果：**
- slot 复用 → 同一 slot 不同生命周期粒子拿到相同 rand
- `i=0` 永远 `pRand=0` → 第一个粒子永远在 distribution 下界
- `reseed` 完全无效
- `rate / radius / phase` 三个值共享同一 rand → 完全相关

UE：`Shaders/Private/Stateless/Modules/NiagaraStatelessModule_RotateAroundPoint.ush:31-33` 用 spawn 时一次性 `RandomScaleBiasFloat(Particle, ...)` 写到 `Particle.RandomSeed`，每个属性独立随机偏移。

**修：** 新增 `Particle.RandomSeed: float`（或 `uint32`），spawn 时写一次；4 个模块改读该字段做哈希。

### D. ID / 状态泄露

- `simulation/emitter-instance.ts:36` `idTable.acquire()` 在 spawn 时调用，但 `killInstance` **没配对 release** → ID 单调累积
- `simulation/system-instance.ts:137` `runSystemStage` 用 `emitters[0]` 作占位 emitter context，system 级模块若误读 particleDataSet 会拿到任意 emitter

### E. 渲染器偷懒

- `renderers/sprite-renderer.ts:333-336` 每帧 `[].sort` 分配新数组 → GC 抖动；预分配 typed array 复用
- `renderers/sprite-renderer-properties.ts:32-40` 缺 PivotOffset / Alignment / CutoutTexture / 自定义 Material — 全部硬编码或写死在 shader 里
- `renderers/ribbon-renderer.ts` 宽度只看 `tmpSize[0]`，`tmpSize[1]` 永不读

### F. SystemInstance tick 顺序不完整

- `simulation/system-instance.ts:106-110` 只有 `preTick + tick`，没有独立 `postTick` 阶段
- `emitter.postTick()` 从 `tickInner` 内部调用（`emitter-instance.ts:266`）
- 后果：破坏 UE 的"所有 emitter 完成 update 后再 postTick"不变量 — 未来做 cross-emitter sample 会读到 dirty data
- 修：System 层独立 `preTick / tick / postTick` 三段调度

---

## 🟡 P2 — 缺失模块 / 字段

### 缺失的整模块

| UE Stateless 模块 | 状态 |
|---|---|
| `SpriteFacingAndAlignment` | **缺**；renderer facingMode 只有 'billboard'/'velocity'，缺 Unaligned/CustomAlignment/Automatic + FacingCameraDistanceBlend |
| `InitialMeshOrientation` | 缺 |
| `MeshIndex` / `MeshRotationRate` / `ScaleMeshSize*` | 缺（mesh 整套） |
| `DynamicMaterialParameters` | 缺 |
| 内置 Wind module | 缺（依赖 A 项 PhysicsBuildData） |

### 缺失的字段 / 模式

| 位置 | 缺失内容 | UE 来源 |
|---|---|---|
| `initialize-particle-module.ts` | `MeshScale` (Vec3)、`SpriteRotation`、`RibbonWidth` distribution | `Internal/Stateless/Modules/NiagaraStatelessModule_InitializeParticle.h:44-61` |
| `initialize-particle-module.ts` | `PreviousSpriteSize / PreviousSpriteRotation / PreviousScale` 写入 | `InitializeParticle.h:110-113` |
| `emitter-properties-module.ts` | `LoopDuration / LoopDelay` 应为 range；`bRecalculateDurationEachLoop`、`bRecalculateDelayEachLoop`、`bDelayFirstLoopOnly` | `Internal/Stateless/NiagaraSystemEmitterState.h:87-101` |
| `emitter-properties-module.ts` | `InactiveResponse = Kill`（立即清场，不必 drain） | `NiagaraStatelessEmitterInstance.cpp:538` |
| `emitter-properties-module.ts` | `FixedBounds` | `NiagaraStatelessEmitter.h:119` |
| `sub-uv-animation-module.ts` | `Random` mode + `RandomChangeInterval`；`StartFrameRangeOverride/EndFrameRangeOverride` | `Internal/Stateless/Modules/NiagaraStatelessModule_SubUVAnimation.h:14-17` |
| `camera-offset-module.ts:26` | 支持 curve-over-life（当前只 ParticleSpawn 阶段算，丢失 push-pull 效果） | UE `BuildContext.AddDistribution` |
| `add-velocity-in-cone-module.ts` | `LinearVelocityScale` / `InnerCone` / `SpeedFalloffFromConeAxis` | `Internal/Stateless/Modules/NiagaraStatelessModule_AddVelocity.h:32,41` |
| `shape-location-module.ts` | Box `SurfaceThicknessMin/Max`；Cylinder `HeightMidpoint`；Ring `DiscCoverage / UDistribution` | `Internal/Stateless/Modules/NiagaraStatelessModule_ShapeLocation.h:36-55` |
| `spawn-rate-module.ts` / `spawn-burst-module.ts` | `SpawnProbability`；burst `Amount = DistributionRangeInt` | `Internal/Stateless/NiagaraStatelessSpawnInfo.h:39-43` |
| `system-instance.ts` | `RandomSeedOffset`（两个同 seed emitter 解相关） | `NiagaraStatelessEmitterInstance.cpp:66` |
| `calculate-accurate-velocity-module.ts` | 还应写 `PreviousVelocity` | UE `SolveVelocitiesAndForces.ush:166-167` |

---

## ⚪ 死代码 / 冗余

| 位置 | 处理 |
|---|---|
| `modules/builtin/box-location-module.ts` | **删除** — 不在 `module-registry.ts` 注册，UI 创建不到，被 `ShapeLocation` 完全替代 |
| `modules/builtin/sphere-location-module.ts` | **删除** — 同上；sphere uniform 采样比 ShapeLocation 还正确，把那段逻辑搬过去再删 |
| `simulation/tick-context.ts` `ProTickContext` 接口 | **删除** — `system-instance.ts:tick(deltaTime: number)` 没用 |
| `shape-location-module.ts` 的 `center` 字段 | **删除** — 与 `initialize-particle-module.ts.positionOrigin` 重复，UE 没有 per-shape center |
| `color-over-life-module.ts` / `size-over-life-module.ts` | 与 `scale-color`/`scale-sprite-size` 曲线模式重叠；可保留但需注释明确"非 UE 模块，曲线快捷方式" |

---

## 修复优先级

### 必须先修（输出已经错了）
1. #1 RotateAroundPoint 螺旋外飞
2. #2 Ribbon UV 错位
3. #3 SpawnRate range 抖动
4. #5 Loop 状态机大 dt 漏触发
5. #4 SpawnBurst infinite 死路径
6. #12 ShapeLocation Ring 面积非均匀

### 架构对齐（做完后续工作成本降低）
7. **A 项：PhysicsBuildData 聚合管线** — Gravity/Acceleration/Drag/CurlNoise 全部改"写 range，Solve 闭式积分"
8. **C 项：`Particle.RandomSeed` 字段** + 改 4 个模块的 pRand 来源
9. #6 子帧插值 spawn（替换 dt=0 hack）
10. D 项：idTable.release 修复 ID 泄露
11. 死代码清理（box-location、sphere-location、ProTickContext、center）

### 重写错误算法
12. #9 ScaleSpriteSizeBySpeed 改 UE Vec2 曲线版
13. #13 CurlNoise 完整重写
14. #8 SpriteRotationRate Curve 模式
15. #10 UpdateAge kill 边界
16. #11 AddVelocity coneAngle 单位

### 缺失功能补完
17. SpriteFacingAndAlignment 模块 + renderer Alignment/PivotOffset
18. SubUVAnimation Random mode
19. ShapeLocation 缺失参数
20. EmitterProperties 完整化（LoopDuration range / RecalculateEachLoop / InactiveResponse）
21. Mesh 整套（InitialMeshOrientation / MeshIndex / MeshRotationRate / ScaleMeshSize）
22. DynamicMaterialParameters

---

## 参考

- UE Stateless 模块入口：`D:/Developments/git/UnrealEngine/Engine/Plugins/FX/Niagara/Source/Niagara/Internal/Stateless/Modules/`
- UE Stateless shaders：`D:/Developments/git/UnrealEngine/Engine/Plugins/FX/Niagara/Shaders/Private/Stateless/Modules/`
- UE PhysicsBuildData：`Internal/Stateless/Modules/NiagaraStatelessModuleCommon.h` (FPhysicsBuildData)
- UE Stateless EmitterInstance：`Private/Stateless/NiagaraStatelessEmitterInstance.cpp`
