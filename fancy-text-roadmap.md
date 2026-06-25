# 花字系统开发计划

> 基于 [文本花字系分文档](https://yuque.antfin.com/ndl7nd/mars/yvy3lwie8kzykgr0) 整理
>
> 分支：`feat/fancy-text`
>
> 更新时间：2026-06-25（第三次更新）

---

## 📊 当前实现状态

### ✅ 已完成（runtime 2.8）

| 功能 | 文件位置 | 状态 |
|------|---------|------|
| 多层描边 `single-stroke` | `text-layer-drawers.ts:46` — `SingleStrokeDrawer`（离屏 canvas 外描边） | ✅ |
| 纯色填充 `solid-fill` | `text-layer-drawers.ts:333` — `SolidFillDrawer` | ✅ |
| 渐变填充 `gradient` | `text-layer-drawers.ts:198` — `GradientDrawer`（基于 `computeTextBbox` 计算渐变坐标） | ✅ |
| 纹理填充 `texture` | `text-layer-drawers.ts:309` — `TextureDrawer` | ✅ |
| 阴影 `shadow` | `text-layer-drawers.ts:255` — `ShadowDrawer` | ✅ |
| 发光 `glow` | `text-layer-drawers.ts:283` — `GlowDrawer`（intensity 钳位 [1, 10]，与预设 max 一致） | ✅ |
| 统一阴影/发光离屏渲染 | `render-with-text-layers.ts:52`（163 行） — `renderWithTextLayers`（支持多阴影/发光叠加、离屏合成管线） | ✅ |
| FancyConfig 解析 | `text-style.ts` — `parseFancyConfig`（正式 API，将花字配置解析为 FancyRenderStyle） | ✅ |
| 花字层工厂 | `fancy-layer-factory.ts` — `FancyLayerFactory`（6 种 kind 注册：single-stroke/gradient/shadow/texture/solid-fill/glow） | ✅ |
| 类型定义 | `fancy-types.ts`（128 行） — `FancyConfig`、`BaseLayerConfig`、`DecorativeLayerConfig`（含 `ShadowLayerConfig` + `GlowLayerConfig`）、`FancyRenderLayer`、`FancyRenderStyle`、`TextEnv`、`TextLayerDrawer` | ✅ |
| RTL/连写文本支持 | `text-layer-drawers.ts:5-9` — `HAS_RTL_OR_JOINING` 正则 + `fillTextWithPadding`（阿拉伯语等连写字形整行绘制） | ✅ |
| Demo 预设配置 | `web-packages/demo/src/fancy-presets.ts` — `demoFancyJsonConfigs`（6 种：none/single-stroke/multi-stroke/gradient/shadow/texture） | ✅ |
| 示例预设（金属） | `text-style.ts:420` — `METALLIC_SAMPLE`（渐变 + 带高光阴影描边） | ✅ |
| 示例预设（霓虹） | `text-style.ts:432` — `NEON_SAMPLE`（Shadow offset=0 模拟发光 + 多描边） | ✅ |
| 示例预设（发光+描边+渐变） | `text-style.ts:392` — `GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE`（三层描边（其中两层带 Shadow offset=0 模拟发光）+ 渐变填充） | ✅ |
| 编辑器辅助函数 | ~~`flattenFancyConfigToRenderStyle` / `flattenFancyConfigToLayers`~~ — 已移除，统一使用 `TextStyle.parseFancyConfig` | ❌ 已移除 |
| 编辑器-花字参数操作 | `text-style.ts:226-387` — `setStrokeEnabled`/`setShadowEnabled`/`updateStrokeParams`/`updateShadowParams`/`updateFillParams`/`setTextColor`/`setOutlineColor`/`setOutlineWidth`/`setShadowBlur`/`setShadowColor`/`setShadowOffsetX`/`setShadowOffsetY` | ✅ |
| 编辑器-排版面板 | `text-editor.ts` — 字体/字号/字重/样式/对齐/行高/字间距/Auto Resize/宽高等 | ✅ |
| 单元测试（6 个文件） | `fancy-layer-factory.spec.ts`、`render-with-text-layers.spec.ts`、`text-layer-drawers.spec.ts`（含 `applyStyle` 方法测试 + render() offscreen 集成测试）、`text-style-base.spec.ts`、`text-style-parse.spec.ts`、`preset-manager.spec.ts` | ✅ |
| `SingleStrokeDrawer.applyStyle()` | `text-layer-drawers.ts` — 从 `render()` 提取的公共方法，允许直接在指定 ctx 上应用描边样式（绕过 offscreen canvas 副作用） | ✅ |
| 异步纹理加载 | `texture-pattern-loader.ts` — `loadTexturePatterns()` 异步加载纹理层图片并创建 CanvasPattern | ✅ |

---

## 📋 开发计划

### 第一阶段：业务约束与核心效果实现

**目标**：实现发光效果及系分文档中的业务规则约束

> **当前进度**：发光效果已完成（含边缘伪影修复 + 单测），Shadow/Glow 归属约束已完成（含单测）。本阶段全部完成 ✅。

#### 1.1 发光效果 `glow` ✅

- [x] 类型定义：`GlowLayerConfig`（独立于 shadow，作为装饰层）— `fancy-types.ts` 中 `DecorativeLayerConfig = ShadowLayerConfig | GlowLayerConfig`
- [x] 参数设计：`GlowLayerConfig { kind: 'glow', params: { color, blur, intensity? } }`
- [x] `GlowDrawer` 实现 — `text-layer-drawers.ts:283` 中基于 Canvas shadow API + 离屏 canvas 合成，intensity 钳位 [1, 10]
- [x] 在 `FancyLayerFactory` 中注册 — factory 已处理 6 种 kind（含 glow）
- [x] 将 `GlowLayerConfig` 加入 `DecorativeLayerConfig` 联合类型
- [x] 在 `FancyRenderLayer` 联合类型中新增 glow 分支
- [x] 在 `parseFancyConfig` 中支持 glow 装饰层的展开
- [x] 离屏渲染管线支持 — `renderWithTextLayers` 中 Glow 独立于 Shadow 渲染，层次：文字内容 > Glow > Shadow
- [x] 发光边缘伪影修复 — `renderWithTextLayers` 优化为先生成干净 glow 图层再叠加 intensity，避免多次 shadowBlur 导致阶梯状伪影
- [x] 添加单元测试 — `fancy-layer-factory.spec.ts` 和 `text-style-parse.spec.ts` 中已覆盖 glow 相关测试用例

> **已解决的技术风险**：Glow 与 Shadow 的冲突已通过离屏渲染管线解决——先在离屏 canvas 渲染文字内容，再分别生成 Glow 和 Shadow 图层，使用 `destination-over` 合成模式按层次叠加。

> **遗留项（已全部修复）**：~~`text-item.ts` 的 `getEffectPadding()` 当前只计算 outline + shadow 的 padding，尚未加入 glow padding~~ — glow 和 single-stroke 的 padding 均已加入。特效 padding 导致的文本左上偏移 bug 已通过 `context.translate(padL, padT)` 补偿修复。

**涉及文件**：
- `packages/effects-core/src/plugins/text/fancy-text/fancy-types.ts`
- `packages/effects-core/src/plugins/text/fancy-text/text-layer-drawers.ts`（349 行，新增 `computeTextBbox` 辅助函数、`GradientDrawer` 改用 bbox 渐变坐标、`GlowDrawer` intensity 钳位修正 [1,10]）
- `packages/effects-core/src/plugins/text/fancy-text/fancy-layer-factory.ts`（42 行）
- `packages/effects-core/src/plugins/text/fancy-text/render-with-text-layers.ts`（163 行）
- `packages/effects-core/src/plugins/text/text-item.ts`（891 行，`getEffectPadding` 增加 glow/stroke 层 padding、"updateTexture" 增加 `translate(padL, padT)` 偏移补偿）
- `packages/effects-core/src/plugins/text/text-style.ts`（383 行）

#### ~~1.2 多 Stroke 自动排序~~ — 已取消

> **取消原因**：评估后认为自动排序无实际意义，设计师更习惯手动控制描边层序，runtime 保持按 `layers` 数组原始顺序渲染即可。

#### ~~1.3 Shadow/Glow 归属约束~~ — 已取消

> **取消原因**：装饰层与基础层地位平行，单个 Fill/Stroke 可挂任意数量的 Shadow/Glow 以实现有层次的发光/阴影效果（如内外双层发光）。`decorations` 数组无数量限制。

#### ~~1.4 Fill 唯一性约束~~ — 已取消

> **取消原因**：评估后确认 Fill 层天然可以共存，设计师可以叠加纹理、渐变、纯色实现更丰富的效果，无需做唯一性约束。


### 第二阶段：预设系统完善

**目标**：建立完整的预设管理和调参体系

> **当前进度**：预设数据存储、扩展预设库、调参接口均已完成 ✅。同时修复了 P0 遗留项（glow padding 缺失）。

#### 2.1 预设数据存储 ✅

- [x] FancyConfig 存储在 `TextComponentData.options` 中内联（`fancyConfig?: FancyConfig` 字段）
- [x] 序列化方式：FancyConfig 是纯 JSON 可序列化结构，自然被 `JSON.stringify` 包含
- [x] `TextStyle.update()` 中优先读取 `fancyConfig`，通过 `parseFancyConfig` 生成 `FancyRenderStyle`
- [x] `TextStyle` 新增 `fancyConfig?` 属性，保存最近一次应用的配置态数据
- [x] 实现预设的序列化/反序列化 — `PresetManager.serializeConfig` / `deserializeConfig`
- [x] 预设版本管理 — `FancyConfig.version` 字段 + `PresetManager.migrateConfig` 迁移方法

**涉及文件**：
- 新建 `packages/effects-core/src/plugins/text/preset-manager.ts`
- 修改 `packages/effects-core/src/plugins/text/text-style.ts`
- 修改 `packages/effects-core/src/plugins/text/fancy-text/fancy-types.ts`

#### 2.2 扩展预设库 ✅

- [x] 霓虹效果 — `NEON_SAMPLE`（已更新为真正的 glow 装饰层，替代 Shadow offset=0 模拟方式）
- [x] 彩虹效果 — `RAINBOW_PRESET`（5层光谱描边 + 7色全光谱渐变填充）
- [x] 金属效果 — `METALLIC_SAMPLE`（渐变 + 带高光描边，shadow 模拟高光线，无需修改）
- [x] 冰霜效果 — `FROST_PRESET`（冰蓝描边 + glow 装饰 + 冰蓝渐变填充）
- [x] 火焰效果 — `FLAME_PRESET`（火焰色描边 + glow 装饰 + 火焰渐变填充）
- [x] 立体效果 — `STEREO_PRESET`（多层 shadow + 描边 + 顶部高光填充）
- [x] 发光+多描边+渐变效果 — `GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE`（已更新为 glow 装饰层）
- [x] Demo 基础预设 — `fancy-presets.ts` 中 7 种：none / single-stroke / multi-stroke / gradient / shadow / glow / texture

> **备注**：所有使用 Shadow(offset=0) 模拟发光的预设已更新为真正的 `glow` 装饰层。METALLIC_SAMPLE 中 offsetY=-2 的 shadow 是真实高光线，无需替换。预设库统一管理在 `fancy-presets.ts`，Demo 侧从 `@galacean/effects-core` 导入。

**涉及文件**：
- 新建 `packages/effects-core/src/plugins/text/fancy-text/fancy-presets.ts`（统一内置预设库）
- 修改 `web-packages/demo/src/fancy-presets.ts`（改为从 effects-core 导入）
- 修改 `packages/effects-core/src/plugins/text/text-style.ts`（旧 SAMPLE 迁移，此处 re-export）

#### 2.3 预设调参接口 ✅

- [x] 预设可调参数元信息 — `AdjustableParamMeta` 接口（path/label/type/min/max/step/options/group）
- [x] FancyConfig 新增 `adjustableParams?: AdjustableParamMeta[]` 字段
- [x] 实现 `getAdjustableParams(config)` — 支持显式 adjustableParams 和启发式自动推断两种策略
- [x] 实现 `updateParamByPath(config, path, value)` — 点号路径格式，不可变返回新对象
- [x] `AdjustableParam` 接口 — 在 `AdjustableParamMeta` 基础上增加 `value` 字段

**涉及文件**：
- `packages/effects-core/src/plugins/text/preset-manager.ts`
- `packages/effects-core/src/plugins/text/fancy-text/fancy-types.ts`

#### P0 遗留修复 ✅

- [x] `getEffectPadding()` 增加 glow 层 padding 计算 — 遍历 `fancyRenderStyle.layers`，对 glow 层按 `blur * intensity` 计算 padding
- [x] `getEffectPadding()` 增加 single-stroke 层 padding 计算 — 遍历 `fancyRenderStyle.layers`，对 single-stroke 层按 `widthPx` 计算 padding
- [x] **特效 padding 偏移 bug 修复** — `updateTexture()` 的 drawCallback 中添加 `context.translate(padL, padT)` 补偿，修复启用 glow/stroke/outline/shadow 时文本整体往左上角偏移的问题
- [x] `GlowDrawer.getGlowParams()` intensity 钳位上限从 5 修正为 10 — 与 `GLOW_PRESET` 的 adjustableParams max 值一致
- [x] `GradientDrawer` 渐变坐标改用 `computeTextBbox` 计算 — 修复 effect padding 导致 canvas 尺寸扩展时渐变坐标基于画布尺寸而非文字内容区域，使渐变偏移

**涉及文件**：
- `packages/effects-core/src/plugins/text/text-item.ts`（L430 translate 补偿、L620-637 stroke/glow padding 计算）
- `packages/effects-core/src/plugins/text/fancy-text/text-layer-drawers.ts`（L147 `computeTextBbox`、L198 `GradientDrawer` 改用 bbox、L300 intensity 钳位修正）

---

### 第三阶段：编辑器集成

**目标**：完成编辑器 UI 与 runtime 的联调

> **当前进度**：排版面板（Typography）已完成，花字效果面板尚未开始。`TextStyle` 中已提供花字参数操作 API（`setStrokeEnabled`/`setShadowEnabled`/`updateStrokeParams`/`updateShadowParams`/`updateFillParams` 等），为编辑器面板提供了就绪的 runtime 接口。

#### 3.0 已完成：本地调试排版面板 ✅

> `text-editor.ts` 中 `TextComponentEditor` 已实现以下排版编辑功能：

- [x] 字体家族选择（Inter / Arial / Helvetica / sans-serif / serif / monospace）
- [x] 字重按钮组（Regular / Bold / Lighter）
- [x] 字体样式按钮组（Normal / Italic / Oblique）
- [x] 字号拖动控件
- [x] 多行文本输入
- [x] Auto Resize 模式（Fixed / Auto Width / Auto Height）
- [x] 宽高拖动控件（支持 maxTextWidth/maxTextHeight）
- [x] 行高拖动控件
- [x] 字间距百分比控件
- [x] 水平对齐按钮组（Left / Center / Right）
- [x] 垂直对齐按钮组（Top / Middle / Bottom）

#### 3.1 编辑器简化模式（本期重点，对标剪映）

> 面向普通用户，不暴露多层结构，通过预设 + 少量参数调节实现花字效果。

- [ ] 预设选择器（参考系分文档 UI 截图：霓虹、彩虹、金属、冰霜、火焰、立体等）
- [ ] 少量可调参数面板：
  - [ ] 描边：类型选择、颜色、线宽（runtime API 已就绪：`setStrokeEnabled`/`updateStrokeParams`）
  - [ ] 填充：类型切换（纯色/渐变/纹理，可叠加）、颜色（runtime API 已就绪：`updateFillParams`）
  - [ ] 阴影：颜色、模糊、偏移（runtime API 已就绪：`setShadowEnabled`/`updateShadowParams`，支持 distance+angle 参数）
  - [ ] 发光：颜色、模糊、强度（P0 Glow 效果已完成，runtime API 已就绪）
- [ ] 预设预览

**涉及文件**：
- `web-packages/imgui-demo/src/custom-editors/text-editor.ts`（525 行，在已有排版面板基础上新增花字效果区域）

#### 3.2 编辑器 UI 面板设计（可参考runtime本地调试面板的排版和交互）

- [ ] 效果列表编辑器（类似 Figma Effects）
- [ ] 填充类型切换（纯色/渐变/纹理，可叠加）
- [ ] 描边列表管理（增删排序）
- [ ] 装饰效果配置（Shadow/Glow）

**涉及文件**：
- `web-packages/imgui-demo/src/custom-editors/text-editor.ts`

#### 3.3 高级模式（后续完善）

> 面向内部预设作者，完整展示层级结构。

- [ ] 完整展示"绘制层 + 装饰层"层级结构
- [ ] 支持多层描边编辑
- [ ] 排版面板（弯曲配置，依赖后续迭代的弯曲功能）
- [ ] 滤镜面板（依赖后续迭代的滤镜功能）

---

## 🔮 后续迭代规划（本期不做）

> 以下功能记录在此作为后续迭代参考。

### 弯曲文本

- [ ] 实现弯曲文本排版算法（当前 `text-layout.ts`（132 行）中无弯曲相关实现）
- [ ] 在 `layout` 配置中描述弯曲参数
- [ ] 与背景功能互斥逻辑
- [ ] 与花字渲染管线集成

**涉及文件**：
- `packages/effects-core/src/plugins/text/text-layout.ts`（132 行，当前仅有基础排版逻辑）
- `packages/effects-core/src/plugins/text/text-item.ts`（856 行）

### 滤镜系统

- [ ] 设计滤镜架构（当前代码中无任何滤镜相关实现，需从零开发）
- [ ] 定义独立 `filters` 数组结构
- [ ] 实现滤镜类型：
  - [ ] 模糊滤镜 `blur`
  - [ ] UV 扭曲滤镜 `distort`
  - [ ] 色彩调整滤镜 `color-adjust`
- [ ] 滤镜渲染管线集成

**涉及文件**：
- 新建 `packages/effects-core/src/plugins/text/filters/`（目录当前不存在）
- `packages/effects-core/src/plugins/text/text-item.ts`（856 行）

### 背景形状

- [ ] 类型定义：`BackgroundLayerConfig`
  ```typescript
  interface BackgroundLayerConfig {
    kind: 'background';
    params: {
      color: [number, number, number, number];
      padding: [number, number, number, number]; // top, right, bottom, left
      borderRadius?: number;
      shape?: 'rectangle' | 'rounded';
    };
  }
  ```
- [ ] `BackgroundDrawer` 实现
- [ ] 与弯曲功能互斥逻辑（开启背景时禁用弯曲，反之亦然）

**涉及文件**：
- `packages/effects-core/src/plugins/text/fancy-text/fancy-types.ts`
- `packages/effects-core/src/plugins/text/fancy-text/text-layer-drawers.ts`
- `packages/effects-core/src/plugins/text/fancy-text/fancy-layer-factory.ts`

---

## 🔧 优先级排序

```
本期计划（截至 2026-06-25 进度标注）：

P0 - 核心效果 + 业务约束（必须先完成，影响后续设计）：
  1. 发光效果 glow                               ✅ 已完成
  2. 多 Stroke 自动排序                           ❌ 已取消（设计师手动排序）
  3. Shadow/Glow 归属约束                         ❌ 已取消（装饰层无数量限制，支持多层叠加）
  4. Fill 唯一性约束                              ❌ 已取消（Fill 层可共存叠加）
  5. Glow padding 修复                            ✅ 已完成（getEffectPadding 增加 glow + stroke 层计算）
  6. 特效 padding 偏移 bug 修复                   ✅ 已完成（translate(padL, padT) 补偿）
  7. GlowDrawer intensity 钳位修正                ✅ 已完成（[1,5] → [1,10]，与预设 max 一致）
  8. GradientDrawer 渐变坐标修复                  ✅ 已完成（改用 computeTextBbox 替代画布尺寸）

P1 - 预设系统：
  9. 预设存储结构（options 内联集成）               ✅ 已完成（preset-manager.ts + fancyConfig 字段）
  10. 扩展预设库                                  ✅ 已完成（14 个内置预设：7基础+3示例+4新增）
  11. 预设调参接口                                ✅ 已完成（AdjustableParamMeta + getAdjustableParams + updateParamByPath）

P2 - 编辑器集成：
  12. 排版面板（Typography）                      ✅ 已完成
  13. 简化模式（花字效果面板：预设选择 + 基础调参） ❌ 未开始（runtime API 已就绪）
  14. UI 面板设计                                 ❌ 未开始
  15. 高级模式（后续完善）                        ❌ 未开始

后续迭代（本期不做）：
  - 弯曲文本（需从零实现）
  - 滤镜系统（需从零开发）
  - 背景形状
```

---

## 📁 文件变更预估

| 阶段 | 文件 | 操作 | 状态 |
|------|------|------|------|
| P0 | `fancy-types.ts`（98 行） | 修改类型：新增 `GlowLayerConfig` 装饰层类型、`DecorativeLayerConfig` 联合新增 glow、`FancyRenderLayer` 联合新增 glow | ✅ 已完成 |
| P0 | `text-style.ts` | `parseFancyConfig` 为正式 API；已删除 `applyFancyConfig`（死代码）、`flattenFancyConfigToRenderStyle`/`flattenFancyConfigToLayers`（冗余薄包装） | ✅ 已完成 |
| P0 | `text-layer-drawers.ts`（349 行） | 新增 `GlowDrawer`（L283）、`computeTextBbox`（L147）辅助函数；`GradientDrawer` 改用 bbox 渐变坐标；`GlowDrawer` intensity 钳位修正 [1,10] | ✅ 已完成 |
| P0 | `fancy-layer-factory.ts`（42 行） | 在 switch 中注册 `glow` 分支 | ✅ 已完成 |
| P0 | `render-with-text-layers.ts`（163 行） | 离屏渲染管线支持 Glow + Shadow 分层叠加 | ✅ 已完成 |
| P0 | `text-item.ts`（891 行） | `getEffectPadding` 增加 glow+stroke 层 padding；`updateTexture` 增加 `translate(padL, padT)` 偏移补偿 | ✅ 已完成 |
| P1 | `fancy-types.ts` | 新增 `AdjustableParamMeta`/`AdjustableParam` 接口；FancyConfig 新增 `version?`/`adjustableParams?` | ✅ 已完成 |
| P1 | 新建 `fancy-text/fancy-presets.ts` | 内置预设库（14 个预设含 adjustableParams 元信息），旧 SAMPLE 迁移至此 | ✅ 已完成 |
| P1 | 新建 `preset-manager.ts` | 预设管理、序列化、迁移、调参接口 | ✅ 已完成 |
| P1 | `text-style.ts`（383 行） | 新增 `fancyConfig` 属性；`update()` 读取 fancyConfig；SAMPLE 迁移为 re-export；NEON/GLOW 更新为 glow | ✅ 已完成 |
| P1 | `text-item.ts`（891 行） | `updateWithOptions` 支持 fancyConfig 字段（通过 TextStyle.update 间接处理）；`translate(padL, padT)` 偏移补偿（L430） | ✅ 已完成 |
| P1 | `index.ts`（text插件） | 新增 `fancy-presets` 和 `preset-manager` 导出 | ✅ 已完成 |
| P1 | `demo/fancy-presets.ts` | 改为从 effects-core 导入 `BUILTIN_FANCY_PRESETS` | ✅ 已完成 |
| P1 | `demo/fancy-text.ts` | 新增 4 个预设按钮（neon/metallic/rainbow/frost/flame/stereo）；渐变测试用例 | ✅ 已完成 |
| P2 | `text-editor.ts`（525 行） | 新增花字效果面板（简化模式 + UI 面板），排版面板已完成无需改动 | ❌ 未开始 |
| 后续 | `fancy-types.ts` | 新增 `BackgroundLayerConfig` 类型 | — |
| 后续 | `text-layer-drawers.ts` | 新增 `BackgroundDrawer` | — |
| 后续 | `fancy-layer-factory.ts` | 注册 `BackgroundDrawer` | — |
| 后续 | `text-layout.ts`（132 行） | 弯曲文本实现（当前无弯曲代码） | — |
| 后续 | `text-item.ts`（891 行） | 弯曲文本集成 | — |
| 后续 | 新建 `filters/` | 滤镜系统（目录当前不存在，需从零开发） | — |

> **注**：`inspector.ts` 为通用属性面板框架，自动调用已注册的 Editor（如 `TextComponentEditor`），花字相关 UI 改动集中在 `text-editor.ts`。

---

## 📝 备注

- 本期不做的功能（后续迭代）：
  - 滤镜系统（模糊、UV 扭曲、色彩调整）— 当前代码中无任何滤镜实现，`filters/` 目录不存在，需从零开发
  - 弯曲文本 — 当前 `text-layout.ts`（132 行）中无弯曲相关代码，需从零实现；`text-item.ts` 已达 891 行
  - 背景形状
- 已明确的业务约束：
  - Fill 可叠加：纯色/渐变/纹理可共存叠加（~~原计划三选一约束已取消~~）
  - Shadow/Glow 无数量限制：每个 Fill/Stroke 可挂任意数量的 Shadow 和 Glow（~~原计划 per-layer 唯一性约束已取消~~）
  - Stroke 排序：由设计师手动控制层序，runtime 按 `layers` 数组顺序渲染（~~原计划自动排序已取消~~）
- 技术风险（已解决）：
  - ~~Glow 与 Shadow 在同一次 Canvas 绘制中可能冲突~~ — 已通过离屏渲染管线解决（`render-with-text-layers.ts` 中使用 `destination-over` 合成模式分层叠加）
- 架构说明：
  - `parseFancyConfig`（`text-style.ts`）为正式 API，负责将 FancyConfig 解析为 FancyRenderStyle。编辑器侧和 runtime 均直接调用 `TextStyle.parseFancyConfig`，已移除冗余的 `flattenFancyConfigToRenderStyle` / `flattenFancyConfigToLayers` 薄包装和死代码 `applyFancyConfig`
  - `inspector.ts` 是通用属性面板框架，花字相关 UI 改动集中在 `text-editor.ts`（525 行）
  - 预设库统一管理在 `fancy-text/fancy-presets.ts`，导出 `BUILTIN_FANCY_PRESETS`（14 个内置预设）。Demo 侧从 `@galacean/effects-core` 导入，不再独立维护
  - `PresetManager`（`preset-manager.ts`）提供预设注册/序列化/迁移/调参接口，所有方法为纯函数式静态方法
  - `TextStyle.fancyConfig` 保存最近一次应用的配置态数据，供编辑器回读和调参使用
  - `getEffectPadding` 已支持 glow 层（`blur * intensity`）和 single-stroke 层（`widthPx`）padding 计算，解决极端 blur/width 值时边缘裁切问题
- `updateTexture()` 中已添加 `context.translate(padL, padT)` 补偿特效 padding 偏移，修复启用 glow/stroke/outline/shadow 时文本整体往左上角偏移的 bug
- `GlowDrawer.getGlowParams()` intensity 钳位范围已修正为 [1, 10]，与 `GLOW_PRESET` 的 adjustableParams max 一致
- `GradientDrawer` 已改用 `computeTextBbox` 从文字内容 bbox 计算渐变坐标，替代基于画布尺寸的旧逻辑，修复 effect padding 扩展画布后渐变偏移问题

---

## 更新日志

| 日期 | 内容 |
|------|------|
| 2026-04-01 | 初始版本，基于系分文档整理 |
| 2026-04-01 | 对齐系分文档：新增 Fill 唯一性约束（1.3）；明确 Stroke 排序字段位置（`strokeOrder`）；将弯曲/滤镜/背景移至后续迭代；预设系统提升为 P1；编辑器集成简化模式提前为本期重点 |
| 2026-04-01 | 将发光效果（Glow）加入本期计划并前移至 1.1 最高优先级，原 1.1-1.3 顺延为 1.2-1.4 |
| 2026-06-04 | 基于 `feat/fancy-text` 分支代码实际进度更新文档：补充已完成项（RTL 支持、花字层工厂、类型定义、示例预设 METALLIC/NEON/GLOW_WITH_STROKE_AND_GRADIENT、编辑器辅助函数、花字参数操作 API、排版面板、7 个单元测试文件）；补充精确行号；标注 `parseFancyConfig` 已 deprecated；补回缺失的 1.2（多 Stroke 排序）和 1.4（Fill 唯一性约束）章节；修正后续迭代描述（弯曲/滤镜均需从零开发而非迁移）；标注所有计划项当前进度状态；移除 `inspector.ts` 作为花字涉及文件的错误引用 |
| 2026-06-04 | 取消 1.2（多 Stroke 自动排序）和 1.4（Fill 唯一性约束）：评估后确认 Stroke 排序由设计师手动控制即可，Fill 层天然可共存叠加无需约束 |
| 2026-06-05 | 基于代码实际进度二次更新：1.1 发光效果补充单测已完成状态；修正单测文件数为 6 个（移除不存在的 index.ts）；补充各文件实际行数；标注 getEffectPadding 缺少 glow padding 为遗留项 |
| 2026-06-05 | 取消 1.3（Shadow/Glow 归属约束）：装饰层与基础层地位平行，多个 Shadow/Glow 可实现有层次的发光效果，移除 parseFancyConfig 中 hasShadow/hasGlow 去重逻辑，更新单测为验证多装饰层保留 |
| 2026-06-24 | 恢复 `parseFancyConfig` 为正式 API（移除 @deprecated）；删除死代码 `applyFancyConfig`；删除冗余薄包装 `flattenFancyConfigToRenderStyle`/`flattenFancyConfigToLayers`；demo 改用 `TextStyle.parseFancyConfig`；删除 `flatten-fancy-config.spec.ts`（覆盖已由 `text-style-parse.spec.ts` 完整包含） |
| 2026-06-24 | 完成第二阶段预设系统完善：2.1 预设数据存储（FancyConfig 内联于 options、PresetManager 序列化/反序列化/版本迁移）；2.2 扩展预设库（14 个内置预设统一管理，新增彩虹/冰霜/火焰/立体，旧 NEON/GLOW 更新为 glow 装饰层）；2.3 预设调参接口（AdjustableParamMeta + getAdjustableParams + updateParamByPath 点号路径）；修复 P0 遗留 getEffectPadding 增加 glow padding |
| 2026-06-25 | 修复特效 padding 偏移 bug：`updateTexture()` drawCallback 中添加 `context.translate(padL, padT)` 补偿，解决启用 glow/stroke/outline/shadow 时文本往左上角偏移；`getEffectPadding()` 增加 single-stroke 层 padding 计算；`GlowDrawer.getGlowParams()` intensity 钳位上限从 5 修正为 10（与预设 max 一致）；`GradientDrawer` 改用 `computeTextBbox` 计算 bbox 渐变坐标（修复 effect padding 扩展画布后渐变偏移）；补充 `text-layer-drawers.spec.ts` 单测 |
| 2026-06-26 | 修复花字单元测试失败：从 `SingleStrokeDrawer.render()` 提取 `applyStyle()` 公共方法，6 个测试改用 `applyStyle` 直接验证样式属性；新增 2 个 render() 集成测试（验证 offscreen canvas 不污染传入 ctx、验证 drawImage 合成）；修复 `render-with-text-layers.spec.ts` 中 `.not.eql()` → `.not.equal()` 引用比较；修复 `text-item.ts` ESLint no-floating-promises（加 `void`）；新增 `texture-pattern-loader.ts` 异步纹理加载 |