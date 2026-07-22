# 研究管线 Skills（桌面副本）

这一套是"研究一个模糊大需求"时用的 skill 管线，从摸处境 → 定边界 → 精研源码 → 写方案/系分，整套串起来。来源：`/Users/linxi/.codefuse/engine/cc/skills/`，逐目录 `cp -R`，未改一字。

## 什么时候用

- **模糊大需求、不知从哪入手** → 走编排器 `research-pipeline`，它会告诉你何时调哪个子 skill、何时回头、文档写哪。
- **已经知道要某一步** → 直接调对应子 skill，别走编排器，免得多绕一层。

## 管线流向

```
  模糊大需求
      │
      ▼
 research-pipeline（编排器：串流程、定文档落点）
      │
      ▼
 research-before-design ──── 摸处境（相关物/关系/卡点）
      │                      ↑ 翻车点：没摸处境就动手
      ▼
 define-research-boundary ── 定还没透的方向 + 往哪查
      │
      ▼
 deep-read-by-boundary ───── 按边界清单逐块精研代码
      │
      ├──▶ write-design-by-priorities  写"要做的方案"（硬链接 research 推理）
      ├──▶ write-detailed-spec         写代码级细致系分（含示例）
      └──▶ write-doc-clean             兜底：没跑 research 也能写出干净文档
```

## 7 个 skill 一览

| 目录 | 干啥 | 何时用 |
|---|---|---|
| `research-pipeline/` | **编排器**，串整套流程、定文档写哪（默认语雀 CLI） | 模糊大需求、不知从哪入手 |
| `research-before-design/` | 先摸处境：有哪些相关物、各是什么、什么关系、哪里会卡 | 任何大需求的第一步 |
| `define-research-boundary/` | 定"还没透的几个方向 + 大概往哪查" | 大方向摸清但还没到写系分 |
| `deep-read-by-boundary/` | 按边界清单逐块精研源码，落点到细 | 边界清单出来后 |
| `write-design-by-priorities/` | 写"要做的方案"（系分/设计/实施）叙事，**硬链接** research 产出的推理链 | 要给落地方案时 |
| `write-detailed-spec/` | 写代码级系分：interface / JSON / 示例 / 实现流程 | 要拆到代码细节时（自带 `reference/` 示例） |
| `write-doc-clean/` | 写"不堆垃圾章节、按重点、人能看懂"的文档 | 小方案/已想清楚直接给结论/没跑 research |

## 铁律（各 SKILL.md 里写死的）

- `write-design-by-priorities` 没跑 `research` 不准写，硬链接它的推理；要写"怎么拆出来的"叙事就用它。
- `write-detailed-spec` 没精研结论不准写。
- `research-before-design` 钉的翻车点：**没摸处境就动手**。

## 安装到另一个 Claude Code 环境

把需要的 skill 目录丢进该环境的 skills 加载目录即可（不同环境路径不同，常见为 `~/.claude/skills/` 或项目内 `.claude/skills/`）：

```sh
# 示例：整套装到 ~/.claude/skills/
cp -R ~/Desktop/research-pipeline/* ~/.claude/skills/
```

单个 skill 也独立可用（除编排器 `research-pipeline` 本身，它需要其余子 skill 配合）。
