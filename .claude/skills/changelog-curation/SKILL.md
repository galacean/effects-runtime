---
name: changelog-curation
description: "用于整理、分组、归并和同步 CHANGELOG。触发词包括：changelog 梳理、release note 整理、按模块归类、主从变更归并、同类 PR 合并、中英 changelog 同步、CHANGELOG.md、CHANGELOG-zh_CN.md、版本发布说明、反引号规范。Use when user asks to reorganize or polish changelog entries for a specific version."
---

# Changelog Curation Skill

## 目标

在不改变事实信息的前提下，对指定版本的 CHANGELOG 做结构化整理与风格统一，支持中英文文件同步。

本 skill 适用于：
- 将扁平条目重排为标准分节
- 按模块或同事项归并 PR
- 形成一级主变更与二级补充变更
- 中英文件内容与结构同步
- 统一代码标识符的反引号风格

## 作用范围

- 默认只处理用户指定版本（例如 2.9.0）
- 未明确要求时，不改其他版本
- 未明确要求时，不改与任务无关文件

## 输入信息（执行前确认）

1. 目标版本号（必需）
2. 目标文件（可多选）
   - CHANGELOG.md
   - CHANGELOG-zh_CN.md
3. 操作类型（可多选）
   - 结构分组
   - 主从归并
   - 中英同步
   - 反引号规范化
4. 内容修改边界
   - 默认不改事实内容，仅重排和格式化
   - 若需翻译，明确翻译方向和目标文件

## 标准分节结构

优先使用以下一级分节顺序：

1. Feat
2. Refactor
3. Perf
4. Fix
5. Chore
6. Test

说明：
- 若某分节无条目，可省略
- 条目保留原 PR 链接与作者

## 主从归并规则

1. 一级条目：主变更
   - 对用户价值或功能面变化最大的条目
2. 二级条目：补充或附属变更
   - 对同一主事项的修复、补测、重构、兼容处理
3. 归并优先级
   - 同模块 > 同功能点 > 同问题链路
4. 跨类型挂载
   - 允许 Fix/Refactor 作为 Feat 的二级条目
   - 但需确保语义可追溯
5. PR 细节核验（建议）
   - 如有必要，进入对应 PR 查看 diff 详情
   - 用于更清晰地判断变更所属模块与主从关系

## 反引号规范

### 需要加反引号

- API / 方法 / 字段 / 类型 / 类名
  - 例如：getTextWidth, AnimationEventReference.event, data, GLRenderer
- 包名 / 插件名 / 技术标识
  - 例如：effects-core, ktx2, KTX2 loader
- 明确代码符号或文件名
  - 例如：window.devicePixelRatio, viewer.js, JSON
- 版本号在技术上下文中作为字面量
  - 例如：2.8.0 stable, 1.92

### 不加反引号

- 普通描述词和业务短语
  - 例如：case tests, profile, diff, rich text, pixel ratio, display overflow

说明：
- 若用户明确指定某词要加或不要加，用户要求优先

## 中英同步规则

当用户要求同步时：

1. 以主文件为基准（通常是 CHANGELOG.md）
2. 同步到另一语言文件时保持：
   - 分节结构一致
   - 主从层级一致
   - PR 链接与作者一致
3. 翻译要求：
   - 保持事实不变
   - 术语前后一致
   - 不擅自增删条目

## 执行步骤

1. 定位目标版本区间
2. 读取该区间全部条目
3. 按分节和主从规则整理
4. 按需进行反引号规范化
5. 若要求同步，更新对应语言文件同版本区间
6. 用 diff 自检仅改了目标范围
7. 输出修改摘要与变更边界确认

## 质量检查清单

- 仅改了目标版本
- 未改事实信息（除非用户明确要求翻译）
- PR 链接与作者完整保留
- 分节顺序符合规范
- 一级/二级关系清晰
- 反引号只用于代码标识符
- 中英结构已对齐（若本次要求同步）

## 建议命令

- 查看目标版本片段：
  - awk 'BEGIN{f=0} /^## <version>/{f=1} /^## /&&f&&$0!="## <version>"{f=0} f{print}' <file>
- 只看目标文件改动：
  - git --no-pager diff -- CHANGELOG.md CHANGELOG-zh_CN.md

## 输出模板

- 处理范围：<版本号 + 文件>
- 本次动作：<结构分组/主从归并/同步/反引号>
- 结果确认：
  - 是否改动了事实内容：否/是（说明）
  - 是否仅改目标版本：是/否（说明）
  - 是否完成中英同步：是/否/不适用
- 关键变更点（3-8 条）

## 最小输入模板

当用户希望快速开始时，优先引导使用下面的最小输入：

1. 版本号：<例如 2.10.0>

默认值（用户不输入时自动采用）：

- 目标文件：CHANGELOG.md + CHANGELOG-zh_CN.md
- 操作：结构分组 + 主从归并 + 中英同步 + 反引号规范
- 内容边界：仅重排与格式化，不改事实内容

### 一句话快捷模板

可直接使用以下句式触发完整流程：

“请按 changelog-curation 规则整理 <版本号>。”

示例：

- “请按 changelog-curation 规则整理 2.10.0。”
