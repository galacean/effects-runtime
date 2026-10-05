这是一个用于手机浏览器的轻量级矢量渲染器，基于typescript和gles。我正在尝试改进其中“羽化/模糊”相关的部分。
这部分代码的调度逻辑位于D:\Projects\effects-runtime-fork\packages\effects-core\src\render\feather-offscreen-pass.ts，
着色器位于D:\Projects\effects-runtime-fork\packages\effects-core\src\math\shape\shaders。
Agent只需要关注D:\Projects\effects-runtime-fork\packages\effects-core\src\之下的代码。别的部分与我们关心的逻辑无关。

这个项目有一个调试页面，启动方式为在根目录下cd .\web-packages\imgui-demo，然后pnpm dev。
Agent可以不用自己阅读这个页面，用户会打开这个页面并观察当前渲染结果。

需要关注的羽化逻辑分为三个pass来绘制一组图形：
1. 根据当前像素是否位于图形内部，向一个离屛纹理绘制0或1. 这被称为indicator pass。D:\Projects\effects-runtime-fork\packages\effects-core\src\math\shape\shaders\feather-indicator.frag.glsl
2. 沿着图形边缘（图形全都被展平为多边形）做路径积分（这实际上由卷积转化而来），为每个线段绘制[-1,1]内的值。不同线段的计算结果叠加在一起，最终在离屛纹理上得到一个[-1, 1]内的值。这个过程被称为Integration Pass。目前有两种实现方式：
2.1 Scatter：以每个线段为单位计算路径积分，用GPU硬件混合叠加在一起。D:\Projects\effects-runtime-fork\packages\effects-core\src\math\shape\shaders\feather-scatter.frag.glsl
2.2 Gather：以每个像素为单位计算路径积分，用for循环遍历所有线段。D:\Projects\effects-runtime-fork\packages\effects-core\src\math\shape\shaders\feather-gather.frag.glsl
3. 把不同图形在离屛纹理上绘制的Indicator和Integration结果叠加得到不透明蒙版，然后上采样和着色。这被称为Upsample Pass。

需要Agent协助解决的是一个Scatter计算流程中GPU行为的问题。
由于整个算法实际上是在尝试实现一种卷积（只是拆分成indicator & integration两个pass），结果应该是连续的。
但是我实验发现，scatter计算时，有极低的概率出现不连续（像素亮度突变）的结果。经分析，有两种问题导致：
1. 图形边缘的像素，由于Indicator和Integration的“内部”判定不完全相同，可能有一些浮点误差等，导致Indicator Pass认为该像素位于内部而Integration Pass认为它在外部（或反之）。这可以通过在upsample pass中的后处理完全解决。
2. Scatter模式实现Integration时，部分像素计算结果和正确值出偏差。这一问题概率更低，发生在边界附近，导致约0.02~0.2的亮度差异，并且是scatter独有的，使用gather实现integration不会发生这一问题。
目前我需要协助的就是上述问题2.我需要Agent帮我想办法找出或解决Scattered Integration个别像素出误差的问题。我怀疑它可能和GPU浮点误差相关。

每个尝试的流程：
1. 用户以batched-feather-rendering为基础，拉一个新分支。Agent在这里工作。目前是BFR-Agent1。
2. Agent写代码（和用户讨论，反复迭代）,用户在调试页面中观察结果。
3. Agent在这个文档后续的章节中填写总结（这一步会由用户发出明确指令）。
4. 如果用户觉得有必要，则让Agent将开发分支合并回batched-feather-rendering。

在这里记录不同的尝试的结果。
## 1. 尝试使用整数计算改写整个流程
这个思路是为了验证是否真的是GPU浮点误差导致，并尝试修复。具体地，将Indicator & Integration都改为使用整数计算。可以接受浮点改为整数导致的取整误差，因为本身显示设备就只有8位。我预期它涉及到整个羽化部分渲染管线的改动，包括怎么将输入的图形坐标取整（例如，坐标5.521可能会取整为一个放大的坐标系下的整数坐标552），怎么用整数改写现在scatter pass中的浮点数计算过程，怎么使用能存储和叠加正负整数的纹理类型。

### 阶段性实验
不同组合的测试，取R=5单位（不是5像素）
geometry: FPS60，1891mW
storage+geometry: FPS60，1827mW
storage+geometry+indicatorSoS: FPS60, 2090mW
storage+geometry+fixed: FPS60, 1928mW

### 总结

#### 结论
问题 2 已解决，靠的是两项改动一起生效：
- **geometry**：scatter 不再插值 `vLocal`，而是在片元中用 `gl_FragCoord` 和边的端点直接计算几何。
- **storage**：atlas 改为 RGBA32F，并用定点数做精确累加。

两者缺一不可。原先设想的"整数几何 / 整数叉积 / 定点积分 / indicator 共用 SoS 规则"经实验证明都不必要，已删除（实验代码存档在 `fa454d30`、`0212bd35`）。
问题 1 仍由 upsample 中的 `fixSingleLayer` 处理，需要保持开启。

推荐采用的最终版本是 `ec26fca0`（storage 用 RGBAFloat）。其后的 `ee7f799e` / `dd88f714` 是 fp16 实验版，效果不达标，见下文"fp16 的不足"。

#### 改动规模（相对分支起点 `e80011f4`，只统计 `packages/`）
- fp32 版 `ec26fca0`：10 个文件，+331 / -10。其中新 shader 约 140 行，其余为开关、uniform 传递和格式支持。
- fp16 版（当前 HEAD）：7 个文件，+292 / -7。相比 fp32 版去掉了 RGBAFloat 相关的 3 个文件。
- 涉及的文件：
  - 新增 `feather-scatter-direct.vert/frag.glsl`（GLSL1）。
  - 修改 `feather-scatter.frag.glsl`、`feather-upsample.frag.glsl`、`vector-feather-renderer.ts`、`feather-offscreen-pass.ts`、`shape-component.ts`。
  - 仅 fp32 版修改的 `framebuffer.ts`（新增 `RGBAFloat`）、`render-target-pool.ts`（`FLOAT` 映射）、`gpu-capability.ts`（`floatBlend` 检测）。
- CPU 端的顶点数据流程（`updateMeshData`）与分支起点完全一致。每帧只多设置几个 uniform，不需要重新上传顶点。

#### 开关（`VectorFeatherRenderer.integerOptions`，全局调试开关）
- `storage`：
  - fp32 版：atlas 用 RGBA32F，scatter 输出 `round(v * 65536)`。
  - fp16 版：atlas 用 RGBAHalf，scatter 输出 `round(v * 256)`。
  - upsample 读出 G 通道后除以 S。gather 和 indicator 只写 R 通道，不受影响。
- `geometry`：scatter 改用 `feather-scatter-direct`。indicator 仍是原来的扇形三角形。
- `geometrySpace`（仅 geometry 生效）：`'grid'`（端点换算到 FBO 像素 × 16 的网格坐标）或 `'local'`（直接在局部坐标中计算）。同一个 shader，只靠 uniform 区分，两种实测都能解决问题 2。

#### 关键设计：为什么能解决问题 2
1. **相邻边的共享顶点逐位一致（geometry）**
   - 原 scatter 的每条边以自己的中点为原点，片元拿到的是插值得到的 `vLocal`。同一个顶点在相邻两条边里，会因为参考系不同、插值舍入不同而得到略有差异的局部坐标。
   - 像素靠近顶点时，弧项 `atan(y/b)` 非常陡峭，相邻两条边的弧项本应精确抵消，却留下了 0.02~0.2 的残差。这正是问题 2 的特征：只出现在边界或顶点附近，并且只有 scatter 有，gather 没有。
   - 新做法是：像素中心由 `floor(gl_FragCoord.xy)` 得到；端点在顶点着色器里用同一个表达式、同样的输入换算到计算空间。因此共享顶点在两个实例中逐位相同，弧项可以精确抵消。
   - 叉积为 0、像素恰好落在边上或顶点上时，用 SoS（Simulation of Simplicity，模拟微小扰动）规则决定落在哪一侧，并对顶点重合的情况取极限值，避免出现 0/0。
2. **累加与绘制顺序无关（storage）**
   - 硬件混合的累加顺序不确定，fp16 的部分和每次相加都会舍入。
   - 把每条边的输出量化成整数，再用能精确表示这些整数的格式来累加，加法就是精确的，结果与顺序无关。
   - fp32 下 `2^24` 以内的整数都能精确表示，S = 65536 时部分和可以达到 ±256，余量很大。
3. 只开 geometry 时，近顶点的大幅弧项在 fp16 中相加并抵消，仍会残留误差；只开 storage 时，几何本身已经不一致。所以两者必须同时开启。

#### 兼容性与性能
- 两个新 shader 都是 GLSL1，WebGL1 可以使用（引擎在 WebGL2 下会自动转换成 300 es）。
- fp32 版 storage 需要以下扩展；缺少时会自动关闭 storage 并打印 warn：
  - WebGL2：`EXT_color_buffer_float` + `EXT_float_blend`。
  - WebGL1：`OES_texture_float` + `WEBGL_color_buffer_float` + `EXT_float_blend`。
- 累加值最大约 2^24，要求片元着色器支持 highp。这一点与原羽化 shader 的要求相同。

#### fp16 的不足（`ee7f799e`，RGBAHalf + 量化）
- **原理**：fp16 只能精确表示 2048 以内的整数，所以部分和上限为 ±2048 / S。S = 256 时上限 ±8，S = 1024 时上限 ±2。实测部分和不超过约 1.2，不会溢出，累加确实与顺序无关。
- **问题出在量化误差**：每条边都会产生 ±0.5 / S 的误差，而且这个误差不会随机抵消，会系统性累积。密集曲线上许多边的贡献都小于 0.5 / S，全部被舍入成 0，整体就丢失了。
  - 仿真结果：1024 边的圆（卷积核内最多 146 条边）误差约 0.088，48 角星约 0.015。这比不开 storage 的 fp16 误差（千分之几）还大一个数量级。
- **实测**：S = 256 时能看到明显的明暗噪点；S = 1024 时仍未完全消除。S 不能继续增大，否则部分和的余量不够。
- **结论**：精确累加需要足够的尾数位，fp16 只有 11 位，无法同时满足"量化误差足够小"和"部分和不溢出"两个要求。目前 fp32（RGBA32F + `EXT_float_blend`）难以替代。
- 对于不支持 float 混合的设备，可能的退路：关闭 storage，只开 geometry（实测问题 2 未完全消除，残余程度待评估）；或者在这些设备上改用 gather。

## 2. 别的思路——暂时没想到。

## 3. 三通道 fp16 定点（S=32768，基数 8）

storage 不再把 `round(v * S)` 写进单独的 G。每条边拆成 `n = d2 * 64 + d1 * 8 + d0`（余数 -4…3），G/B/A 各自做加法混合，upsample 在 `fixSingleLayer` 之前还原。Indicator 仍在 R。`storage: false` 与 gather 仍成立：B = A = 0 时还原结果就是 G / S。

容量按每个通道的 `max(正贡献之和, 负贡献之和) ≤ 2048` 估计，不是按绝对值之和。低位、中位每条边最多 4，所以核内非零边数的保守上限是 512。高位在 S = 32768 时，羽化值的 `max(P, N)` 大约要 ≤ 3.44。

仿真（`glslcheck/test-split.mjs`、`sim-triple.mjs`，不进仓库）：

- `n ∈ [-16384, 16384]` 全部拆得回来，`|d2| ≤ 256`。
- 六边形（grid / local）、1024 与 4096 边圆、48 角星（L1 = 4.95，`max(P,N) = 2.72`）、20 齿梳、双层螺旋：还原与精确整数和一致，打乱顺序无差异。与 S = 65536 的 fp32 量化相差最大约 0.0012（4096 边圆）。
- 20000 边圆：核内非零边 1596，低位通道和达到 3453，8 个像素不再精确。8192 边圆核内 762 条，低位和 1148，仍精确。
- 奇数余数一过 2048 就丢：682 条 `-3` 精确，683 条（和为 2049）不精确。全是 `-4` 时和为 4 的倍数，513 条的和 2052 仍可表示，因为越过 2048 后 ulp 先变成 2。
- 高位同理：2048 条 `n = 64`（d2 = 1）精确，2049 条不精确。48 齿宽核梳子的高位和到 2198，但仍是 ulp 的倍数，仿真里没有出错。

真机上的噪点、FPS 和功耗还没有测。