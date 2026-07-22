# 研究管线 Skill 套件

一套"研究一个模糊大需求"的 skill 管线：摸处境 → 定边界 → 精研源码 → 写方案/系分。本文档是安装入口，新机器 clone 本仓库后按下方步骤装上即可用。

## 位置

本套件在仓库内的落点：`.claude/skills/`，与项目级 skill 加载目录一致。

## 7 个 Skill

| 目录 | 干啥 | 何时用 |
|---|---|---|
| `research-pipeline/` | **编排器**，串整套流程、定文档写哪（默认语雀 CLI） | 模糊大需求、不知从哪入手 |
| `research-before-design/` | 摸处境：相关物 / 关系 / 卡点 | 任何大需求的第一步 |
| `define-research-boundary/` | 定"还没透的方向 + 往哪查" | 大方向摸清但还没到写系分 |
| `deep-read-by-boundary/` | 按边界清单逐块精研源码 | 边界清单出来后 |
| `write-design-by-priorities/` | 写落地方案叙事，**硬链接** research 推理 | 要给落地方案时 |
| `write-detailed-spec/` | 代码级系分：interface / JSON / 示例 / 实现流程 | 要拆到代码细节时（自带 `reference/`） |
| `write-doc-clean/` | 写"不堆垃圾章节、按重点、人能看懂"的文档 | 小方案 / 已想清楚 / 没跑 research |

## 管线流向

```
  模糊大需求
      │
      ▼
 research-pipeline（编排器：串流程、定文档落点）
      │
      ▼
 research-before-design ──── 摸处境
      │                      ↑ 翻车点：没摸处境就动手
      ▼
 define-research-boundary ── 定还没透的方向 + 往哪查
      │
      ▼
 deep-read-by-boundary ───── 按边界清单逐块精研代码
      │
      ├──▶ write-design-by-priorities  写"要做的方案"（硬链接 research 推理）
      ├──▶ write-detailed-spec         写代码级细致系分（含示例）
      └──▶ write-doc-clean             兜底：没跑 research 也能写干净文档
```

## 铁律（各 SKILL.md 里写死）

- `write-design-by-priorities` 没跑 `research` 不准写，硬链接它的推理；要写"怎么拆出来的"叙事就用它。
- `write-detailed-spec` 没精研结论不准写。
- `research-before-design` 钉的翻车点：**没摸处境就动手**。

## 安装（新机器）

clone 本仓库后，想在本机 Claude Code 用上这套 skill，二选一：

**方式 A — 只在当前项目用**：无需安装。clone 后这些 skill 已在 `.claude/skills/`，项目内自动加载，直接可调。

**方式 B — 全局可用（所有项目）**：把 7 个 skill 目录复制到本机全局加载目录：

```sh
cp -R .claude/skills/{research-pipeline,research-before-design,define-research-boundary,deep-read-by-boundary,write-design-by-priorities,write-detailed-spec,write-doc-clean} ~/.claude/skills/
```

> 不同环境全局加载目录可能不同，常见为 `~/.claude/skills/`。若该目录不存在则手动创建：`mkdir -p ~/.claude/skills`。

## 给新机器 AI 的一句指令

直接把下面这段丢给新机器的 Claude Code：

> 读本项目 `.claude/skills/README.md`，把里面列的 7 个 skill 目录（research-pipeline、research-before-design、define-research-boundary、deep-read-by-boundary、write-design-by-priorities、write-detailed-spec、write-doc-clean）从仓库 `.claude/skills/` 复制到本机 `~/.claude/skills/`（不存在就建），装完确认每个目录下都有 SKILL.md。

单个 skill 也独立可用（除编排器 `research-pipeline` 本身，它需要其余子 skill 配合）。
