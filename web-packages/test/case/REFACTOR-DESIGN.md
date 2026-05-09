# Frame Diff Test 重构设计

## 1. 目标

本设计聚焦 `web-packages/test/case` 的帧对比测试系统，目标是：

1. 降低 profile 与 runner/common 的耦合。
2. 把“测试编排、播放器控制、图像比对、结果展示”分层，降低单文件复杂度。
3. 统一 profile 构建模式，减少重复代码与命名歧义。
4. 保持测试行为不变，采用可回滚、分阶段迁移。

## 2. 现状梳理

### 2.1 运行链路

当前执行链路：

1. `2d.html` / `3d.html` / `spine.html` 加载 mocha/chai 与 `src/suites/*.spec.ts`。
2. `src/suites/*.spec.ts` 直接导入多个 profile，并逐个执行 `runFrameSuite`。
3. `src/framework/runner/frame-suite-runner.ts` 创建 `TestController`，按场景运行比较。
4. `src/framework/runner/frame-compare-loop.ts` 执行逐帧比对，并在超阈值时调用 `saveCanvasToImage` 输出结果。

### 2.2 主要职责分布

1. `src/framework/runner`: 测试套件编排与逐帧循环。
2. `src/framework/types/profile.ts`: profile 与 scene 类型。
3. `src/profiles/*.profile.ts`: 测试数据映射、hook 绑定、阈值与时间点配置。
4. `src/common/test-controller.ts`: 加载旧版 SDK，创建 old/new 两个播放器。
5. `src/common/test-player.ts`: 播放控制 + 像素读取 + 失败截图 + DOM 预览（多职责混合）。

### 2.3 当前痛点

1. profile 构建重复：多个 profile 都在写 `Object.keys(sceneList).map(...)`。
2. 命名与组织不统一：`2d-*.profile.ts`、`3d-*.profile.ts`、`spine.profile.ts` 平铺，扩展新分组成本高。
3. `TestPlayer` 体量过大：既有渲染读取逻辑，也有 DOM 预览逻辑，测试与复用困难。
4. suite 入口重复：`2d.spec.ts`、`3d.spec.ts`、`spine.spec.ts` 都是“导入并逐个 run”模式。
5. 页面入口重复：三份 html 基本一致，维护成本高。
6. assets 组织分散：`2d/assets`、`3d/assets`、`spine/scene-list.ts` 分布不一致，数据类型和命名规则未统一。

## 3. 重构原则

1. 行为不变优先：阈值、时间点、hook 执行顺序、失败产物都保持一致。
2. 小步迁移：每一步可独立提交并验证，避免一次性大改。
3. 分层边界清晰：runner 不直接关心数据来源，profile 不关心 DOM 细节。
4. 接口先行：先补 builder/registry，再逐步迁移现有 profile。

## 4. 目标架构

### 4.1 分层模型

1. Runner 层：只负责生命周期与断言，不负责 profile 组装。
2. Profile 层：只负责测试配置与场景定义，统一由 builder 生成。
3. Player 层：只负责播放与像素读取。
4. Preview 层：只负责失败图片的 DOM 展示与 Viewer 交互。
5. Data 层：纯场景数据（可继续使用 TS 数据模块，后续再评估 JSON 化）。

### 4.2 目标目录

```text
web-packages/test/case/src
  framework/
    runner/
      frame-suite-runner.ts
      frame-compare-loop.ts
    types/
      profile.ts
    profile/
      profile-builder.ts
      profile-registry.ts
  profiles/
    shared/
      defaults.ts
      scene-mappers.ts
      hooks.ts
    2d/
      interact.profile.ts
      dynamic.profile.ts
      inspire.profile.ts
    3d/
      case.profile.ts
      gltf.profile.ts
      gltf-loaders/
        old-loader.ts
        new-loader.ts
    spine/
      spine.profile.ts
    index.ts
  assets/
    2d/
      interact.scene-list.ts
      dynamic.scene-list.ts
      inspire.scene-list.ts
    3d/
      case.scene-list.ts
      gltf.scene-list.ts
    spine/
      spine.scene-list.ts
    asset-types.ts
    asset-tags.ts
    asset-resolver.ts
  common/
    player/
      test-player.ts
      test-controller.ts
    preview/
      image-preview.ts
    comparator/
      image-comparator.ts
      comparator-stats.ts
      player-cost.ts
```

说明：首阶段可以只做“逻辑重构不动路径”，上述目录是最终目标态，不要求一次到位。

### 4.3 Assets 组织规范

assets 层统一承载“纯场景数据”，不放测试逻辑与断言逻辑。

1. 保留二级分组目录：scene-list 按 `assets/2d`、`assets/3d`、`assets/spine` 组织，类型与工具放在 `assets/` 根目录。
2. 文件命名统一：`<group>.scene-list.ts`，例如 `interact.scene-list.ts`。
3. 数据类型统一：所有场景列表实现同一基础结构（如 `SceneAssetItem`），避免 profile 侧再做弱类型判断。
4. 兼容字段收敛：3D 场景中的 `autoAdjustScene`、`enableDynamicSort` 通过可选扩展字段表达，不再散落在 profile 里手写判空。
5. URL 策略集中：通过 `asset-resolver.ts` 统一处理 base URL、环境切换、灰度地址覆盖，避免每个列表硬编码拼接规则。
6. 业务标签集中：把“全时段测试白名单/黑名单”等规则迁移到 `asset-tags.ts`，profile 只消费标签结果。

建议的资产类型示例：

```ts
export type SceneAssetItem = {
  id: string,
  name: string,
  url: string,
  threshold?: number,
  variables?: Record<string, unknown>,
  tags?: string[],
  pluginData?: {
    compatibleMode?: 'tiny3d',
    autoAdjustScene?: boolean,
    enableDynamicSort?: boolean,
  },
};
```

收益：

1. profile 不再关心资产来源细节，只关注“如何跑测试”。
2. 数据修改（新增/下线场景）可以在 assets 层独立完成，减少跨层改动。
3. 后续若需要切 JSON 或远程配置，迁移成本更低。

## 5. 关键设计

### 5.1 ProfileBuilder

引入 builder，把重复 profile 基础项收敛为默认配置。

建议接口：

1. `createProfile(base)`：创建 profile 基础实例。
2. `withScenes(scenes)`：设置场景列表。
3. `withOverrides(partial)`：局部覆盖。
4. `build()`：返回 `FrameSuiteProfile`。

收益：

1. 降低重复字段（canvas/timeout/pixelDiffThreshold/timePoints）。
2. 统一 2D/3D/Spine profile 结构，减少人为漏填。

### 5.2 Scene Mapper

把常见 `sceneList -> FrameCompareScene[]` 映射提取到 `profiles/shared/scene-mappers.ts`。

典型映射：

1. 普通 URL 场景映射。
2. 带 `loadOptions.variables` 的动态映射。
3. 带 `beforeEachFrame` 的交互场景映射。
4. 带 asset tags 的时间点策略映射（如 full-time、smoke-only）。

### 5.3 Profile Registry

新增 registry 统一管理 profile 注册与筛选。

建议能力：

1. 按 tag 获取（2d/3d/spine）。
2. 按 id 获取。
3. 支持 URL 查询参数过滤（例如 `?profiles=2d-interact,3d-gltf`）。

收益：

1. `src/suites/*.spec.ts` 可简化为统一模板。
2. 后续新增 profile 不需要反复改多个入口。

人工验证时可使用参数进行局部执行，例如：

1. `2d.html?profiles=2d-interact`
2. `3d.html?profiles=3d-gltf`
3. `2d.html?profiles=2d-interact,2d-dynamic`

### 5.4 TestPlayer 拆分

现有 `TestPlayer` 建议拆为：

1. `player/test-player.ts`：初始化、gotoTime、readImageBuffer、dispose。
2. `preview/image-preview.ts`：DOM 组织、Viewer 绑定、热力图全预览。

保留过渡适配：

1. 第一阶段保留 `saveCanvasToImage` 外部签名不变。
2. 内部改为委托 `ImagePreview`，避免一次性改动 `frame-compare-loop.ts`。

## 6. 分阶段迁移计划

### Phase 0: 基线冻结

1. 固化当前 profile 列表与执行顺序。
2. 记录一次 2d/3d/spine 全量运行结果，作为回归基线。

验收：旧链路可稳定运行。

备注：`pnpm test` 由人工在页面侧验证，本方案不将其作为自动化流水步骤。

### Phase 1: 抽象收敛（低风险）

1. 新增 `ProfileBuilder` 与 `scene-mappers`。
2. 迁移 `2d-interact`、`2d-dynamic`、`spine` 到 builder。
3. 保持导出名不变，避免影响 suite。
4. 新增 `assets/asset-types.ts`，先统一类型，不迁移业务逻辑。

验收：行为一致，diff 结果无新增失败。

### Phase 2: 入口统一（低风险）

1. 新增 `profiles/index.ts` + `ProfileRegistry`。
2. 改造 `suites/*.spec.ts` 为“按分组批量运行”。

验收：2d/3d/spine 页面执行数量与顺序保持一致。

### Phase 2.5: Assets 目录收敛（中风险）

1. 将旧路径数据直接迁移到 `assets/2d`、`assets/3d`、`assets/spine`，不保留旧路径 re-export。
2. 引入 `asset-resolver.ts`，统一 URL 解析与环境覆盖。
3. 把 full-time 等规则迁移到 `asset-tags.ts` 并由 mapper 消费。

验收：profile 侧不再直接依赖旧 `2d/assets`、`3d/assets`、`spine/scene-list` 路径。

当前进展：

1. `assets/asset-tags.ts` 已落地，并接入 3D case/gltf 的时间点与加载策略判定。
2. `assets/asset-resolver.ts` 已落地，并接入 scene mapper 与 gltf profile 的 URL 解析。

### Phase 3: Player 拆分（中高风险）

1. 从 `TestPlayer` 抽出 `ImagePreview`。
2. 把 DOM 与 Viewer 逻辑从 player 主类移出。
3. 保持 `saveCanvasToImage` 的兼容层。

验收：失败截图、热力图、全预览链接功能完整。

当前进展：

1. 已新增 `common/preview/image-preview.ts`，承接原 `TestPlayer` 的预览 DOM 与 Viewer 逻辑。
2. `TestPlayer.saveCanvasToImage` 已改为委托 preview 模块，外部签名保持不变。
3. 合并预览图函数已迁移到 `common/preview/merged-preview.ts`，旧 `common/image-preview.ts` 已删除。
4. `common` 已完成物理分层：`common/player`、`common/comparator`、`common/preview`。

### Phase 4: 目录收敛（中风险）

1. `profiles` 迁移为按域分组目录（2d/3d/spine/shared）。
2. 3d gltf loader 移入 `profiles/3d/gltf-loaders`。
3. 统一导出入口，减少跨层相对路径深度。

验收：路径调整后编译通过，测试行为一致。

当前进展：

1. `profiles` 已迁移为按域分组目录：`profiles/2d`、`profiles/3d`、`profiles/spine`、`profiles/shared`。
2. `profiles/index.ts` 已切换到新子目录导入。
3. 旧平铺 profile 文件已移除，不再双轨维护。
4. 3D gltf loader 已迁移到 `profiles/3d/gltf-loaders`，并清理旧 `src/3d/gltf` 目录。
5. `2d/inspire.profile.ts` 已对齐 builder/defaults 组织方式。
6. `profiles/shared/hooks.ts` 已落地，`runRandomHitTest` 已从 2D 私有 shared 收敛为共享 hook。

## 7. 风险与控制

1. 旧版 SDK 与插件加载受网络影响，可能导致假失败。
2. DOM 预览逻辑拆分后可能出现图片分组或 viewer 绑定退化。
3. profile 重排后若顺序变化，可能影响当前人工比对习惯。
4. assets 迁移期若新旧路径并存，可能出现重复注册或数据漂移。

控制措施：

1. 每阶段仅处理一类变化，并运行对应 case 页面验证。
2. 保留兼容层，避免在同一阶段同时变更 runner 和 preview。
3. 为 profile 执行顺序建立快照断言，防止无意识漂移。
4. assets 迁移采用单次切换策略，迁移 PR 中同步完成引用替换与旧目录清理。

## 8. 建议的近期落地顺序

1. 先做 Phase 1 与 Phase 2，快速降低重复代码与入口维护成本。
2. 再做 Phase 2.5，完成 assets 的目录和规则收敛。
3. 然后做 Phase 3，拆分 `TestPlayer` 多职责。
4. 最后做 Phase 4，完成 profile 目录形态收敛。

这样可以在不影响现有测试链路的前提下，逐步把结构整理到可持续演进的状态。

## 9. 验证策略

1. 自动验证：优先 `pnpm check:ts` 与必要的 lint/type 级检查。
2. 人工验证：`pnpm test` 保持人工执行（页面可视化比对），不在本次自动执行步骤中触发。
3. 回归记录：使用 `MANUAL-BASELINE-TEMPLATE.md` 作为手工回归基线记录模板。
