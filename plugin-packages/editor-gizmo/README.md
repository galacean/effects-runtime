# Galacean Effects Editor Gizmo Plugin

Editor interaction and scene gizmos for Galacean Effects.

- **2D**: selection, translation, resizing, rotation, text editing, image cropping,
  viewport navigation and frame layout.
- **3D**: transform handles, camera and light gizmos, geometry and wireframes.

## Usage

```ts
import { GestureHandler, GizmoComponent } from '@galacean/effects-plugin-editor-gizmo';
```

Use `GestureHandler` for 2D editor interaction and `GizmoComponent` for 3D scene
gizmos. Importing the package registers the `editor-gizmo` plugin. Keep its version
aligned with `@galacean/effects`.

## Source layout

- `src/2d/`: 2D interaction, selection, viewport and layout helpers.
- `src/3d/`: 3D gizmos, geometry, wireframes and plugin loader.
- `../../web-packages/test/unit/src/plugin-editor-gizmo/`: unit tests.

## Development

```bash
pnpm --filter @galacean/effects-plugin-editor-gizmo dev
```

Open [the demo](http://localhost:8081/demo/index.html).

Build the plugin:

```bash
pnpm --filter @galacean/effects-plugin-editor-gizmo build
```

Run the shared unit tests:

```bash
pnpm test
```

Open [the unit tests](http://localhost:9090/unit/index.html).


## 2D 更改区整理与交互验证（2026-11-28）

### 功能与职责

本次整理覆盖当前整个更改区。保留原有 `GestureHandler` 的输入派发、拖拽捕获、
模式切换和延迟释放流程；该文件与整理前逐字节一致。

| 层次 | 职责 |
| --- | --- |
| `GestureHandler` / `EditMode` | 输入、选区、模式和 Gizmo 生命周期 |
| 各 Gizmo | 命中、坐标换算、拖拽预览及取消 |
| `data-editing.ts` | 保存编辑起点；区分静态属性与动画轨道；更新当前帧；取消时恢复 |
| `actionstart` / `actionupdate` / `actioncommit` | 通过 `changes` 传递独立的数据快照 |
| Demo / `SceneDocument` | 接入业务数据、保存、历史和编辑器 Auto Key |

更改区保留的功能：

- 移动、缩放、旋转编辑当前动画时刻；锚点移动仍补偿整条运动路径。
- Pen 和 CrystalLattice 已有顶点动画时，新增帧会补齐所有顶点的各轴数据，
  并补建缺失的轨道。钢笔同时包含位置点、入控制点、出控制点。
  同一时间重复拖动复用帧和轨道；取消会移除本次创建的轨道。
- Curve 和 Gradient 输出可保存的变更；渐变保持颜色和几何数据分离。
- LoadingManager 独立持有加载状态；文字和纹理可切换，Gizmo 重建后恢复覆盖层，
  提示受 `loadingBox` 约束，调用方负责纹理的释放。
- 保存动画的 clip、轨道和绑定，支持撤销、重做与重新采样；保留原始序列化 ID。
  核心路径采样兼容仅一个关键点的路径。

### 精简方式

复用更改区已有的一个 `data-editing.ts`，没有再拆实现文件或测试文件。
文档合入本 README。不同工具只声明自己会改动的属性，复用同一套编辑和回滚逻辑。
动画绑定改为每个目标解析一次，避免每个晶格顶点重复遍历祖先和解析轨道绑定。
保留贝塞尔切分、加权切线和路径采样逻辑，以免简化后改变原动画插值。

加载提示合并文字和纹理的布局计算，删除空集合的重复判断以及冗长的分支包装，
订阅集中释放。`loading-gizmo.ts` 从整理前 469 行减到 406 行。
宿主在收到 `changes` 后不再重复替换钢笔组件的数组。

### 发现并修复的问题

| 问题与触发方式 | 修复及验证 |
| --- | --- |
| 钢笔拖拽中切换选中对象，取消时把旧路径写进新对象 | 会话绑定开始时的组件；真实编辑器中切换 Closed Path / Open Path，确认原对象回滚且新对象不变 |
| 钢笔在时间轴切换时刻后仍用旧顶点命中，下一次拖拽可能无反应 | 未提供 revision 的宿主在空闲时刷新路径；真实鼠标在 1 秒、1.5 秒分别拖动并生成完整帧 |
| Demo 钢笔宿主未提供组件，且每次预览重复替换路径 | 自定义路径接入组件，已处理的 `changes` 直接沿用；实际创建三角路径后补齐 9 条轨道 |
| 静态晶格撤销后顶点变成普通对象，继续编辑失败 | 序列化恢复保留数组内的向量实例；真实快捷键撤销、重做、再次拖拽及保存重开通过 |
| Gizmo 返回 `changes` 后，编辑器跳过未接管字段的 Auto Key | 先排除已由 clip 处理的属性，再交给宿主 Auto Key；空 Transform 片段开启 Auto Key 后拖动可生成帧 |
| Escape 取消后宿主可能留下自动生成的关键帧 | 宿主收集取消信号并回滚当前事务；真实页面取消后位置和 clip 都恢复 |
| 加载文字只限制宽度，纵向偏移或短区域会溢出 | 文字和纹理共用区域边界，文字按宽、高缩小；扩展已有文字布局案例验证 |
| `clearSelected` 仅发事件，没有选区消费者 | LoadingGizmo 接入移除选中事件并随实例释放；实际切工具、切文字/纹理和删除覆盖层通过 |
| 资源枚举在测试编译配置下抛错 | 定位到 Set / Map 迭代器展开被编译成数组拼接；改用显式 `Array.from`，复用已有资源身份和序列化测试 |

### 交互验证

测试使用本机 Chrome 的真实页面与鼠标、键盘事件。动画场景通过运行时 API
准备轨道和播放头，编辑动作通过实际指针完成；浏览器测试注入仅用于读取状态，
没有写入产品入口文件。

| 页面与流程 | 结果 |
| --- | --- |
| Demo：对象移动、缩放、角旋转、Escape 取消 | 通过；Sprite 缩放改变 scale，原始 size 保持 |
| Demo：Hand 平移、缩放按钮 | 通过 |
| Demo：钢笔闭合路径创建，连续新增完整帧、取消 | 通过；3 个位置点和 6 个控制点共 9 条轨道，各轴时刻一致 |
| Demo：5 × 5 晶格新增帧及取消 | 通过；25 条顶点轨道，各轴时刻一致 |
| Demo：渐变端点、运动路径关键点拖拽及取消 | 通过 |
| Demo：文字/纹理加载、清选中、工具重建、删除 | 通过；始终一个覆盖层，删除后调用方纹理仍有效 |
| Dev Tools：钢笔拖拽中更换选中对象 | 通过；两侧数据正确 |
| Dev Tools：晶格拖拽、撤销、重做、再次取消 | 通过；顶点仍为向量实例 |
| Dev Tools：保存晶格到浏览器存储，再重新打开 | 通过；顶点数据一致，可继续编辑 |
| Dev Tools：Auto Key 拖拽、撤销、Escape 取消 | 通过；正确生成关键帧，撤销和取消均还原 clip 与位置 |

新增测试只覆盖两条主流程：加载状态跨工具重建，以及静态晶格编辑后的历史恢复。
完整顶点补帧、取消、保存、撤销、重做、轨道复用沿用已有主流程案例，并增加切换选中
和切换时刻后的继续编辑检查。未新建测试文件。

验证结果：Gizmo 回归 **586 / 586**，资源与序列化回归 **5 / 5**；
全仓库 `tsc -b tsconfig.check.json` 通过；变更文件 ESLint **0 error**，
保留 CrystalLattice 原有的 2 条类型推断 warning；`git diff --check` 通过。

### 本地复测

本次运行的页面：

- [2D Gizmo 交互页](http://127.0.0.1:8080/html/gizmo-2d.html)
- [完整编辑器](http://127.0.0.1:8088/)

在仓库根目录可分别启动：

```bash
pnpm --filter @galacean/effects-demo exec vite --host 127.0.0.1 --port 8080 --strictPort
pnpm --filter dev-tools exec vite --host 127.0.0.1 --port 8088 --strictPort
pnpm --filter @galacean/effects-test exec vite --host 127.0.0.1 --port 9194 --strictPort
pnpm exec tsc -b tsconfig.check.json
```

Demo 左侧“+”可添加晶格、渐变和运动路径案例。钢笔从底部工具栏创建闭合路径后，
切换到顶点编辑；动画补帧需先准备至少一条顶点动画轨道。

验证范围是桌面 Chrome、当前测试场景与既有 Gizmo 回归集。
纯静态形状继续保存静态数据；已有顶点动画的拓扑增删，以及动画色标的增删或跨位排序，
仍需完整的轨道索引迁移，目前维持原限制。没有新增拓扑迁移功能。
