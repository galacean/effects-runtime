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
1. Agent以当前git分支——batched-feather-rendering为基础，拉一个新分支。
2. Agent在新分支上写代码（和用户讨论，反复迭代）,用户在调试页面中观察结果。
3. Agent在这个文档后续的章节中填写总结（这一步会由用户发出明确指令）。
4. 如果用户觉得有必要，则将开发分支合并回batched-feather-rendering。

在这里记录不同的尝试的结果。
## 1. 尝试使用整数计算改写整个流程
这个思路是为了验证是否真的是GPU浮点误差导致，并尝试修复。具体地，将Indicator & Integration都改为使用整数计算。可以接受浮点改为整数导致的取整误差，因为本身显示设备就只有8位。我预期它涉及到整个羽化部分渲染管线的改动，包括怎么将输入的图形坐标取整（例如，坐标5.521可能会取整为一个放大的坐标系下的整数坐标552），怎么用整数改写现在scatter pass中的浮点数计算过程，怎么使用能存储和叠加正负整数的纹理类型。
后面由Agent在实现和总结后填写。

## 2. 别的思路——暂时没想到。