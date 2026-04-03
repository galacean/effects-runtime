## 测试

目前采用了scatter和gather混合的模式，由参数控制切换时机。在较大的半径下切换到gather。

在Mate60上的测试结果：

注：Radius是local-space的羽化尺寸，和屏幕上的羽化半径（像素）没有直接联系。

| Mode /FPS               | Radius=10 | Radius=20 | Radius=30 | Radius=40 |
| ----------------------- | --------- | --------- | --------- | --------- |
| Scatter（不限制降采样） | 60        | 60        | 60        | 60        |
| Gather（不限制降采样）  | 60        | 60        | 60        | 60        |
| Scatter（最大降采样=4） | 60        | 56        | 33        | 20        |
| Scatter（最大降采样=4） | 60        | 34        | 20        | 13        |

Rive似乎限制了最高降采样倍率为32。不过目前我自己观察的结果中，降采样倍率=屏幕羽化半径的1/10时，无限大没啥问题（因为此时羽化半径太大了，原始图形的几何信息已经完全不可分辨）。所以目前不做限制。

限制降采样（高负荷）的情况下，可以看到Scatter相比Gather的速度优势。不过，据我的观察，较大降采样下scatter更可能出现闪烁。

使用Gather的优势在于不会有闪烁（至少目前没观测到），劣势则包括：

- webgl1下对图形大小有限制。目前限制为512条边（可以调大，会导致性能下降）。
- 对于较小半径的效率比较低（因为Gather总要遍历所有边，而较小半径下scatter只用考虑很少的边）。
- 细碎的纹理开销，因为需要把每个图形都存储为纹理以便访问（当然也可以合并为一个大纹理，但这个代码改动太大，目前还没做，预期优化也不会很显著）。

## 改动

### 图形自相交处理

目前对于所有参与feather的轮廓，消除自相交。

- 根据之前的测试，有时候自相交不能接受（single demo）而有时候可以接受（imgui demo）。考虑到这两类在数学上无法区分，所以一刀切地全部消除掉。
- 这应该不会影响“图形中挖洞”之类“不同轮廓在同一个图层内叠加”的情况。它们仍然和以前一样可以叠加。

使用libtess消除自相交 - split-union.ts

### Gather相关

两个新增shader - feather-gather.vert/frag.glsl

渲染逻辑中添加了切换到gather的逻辑 - vector-feather-renderer.ts & feather-offscreen-pass.ts

控制切换的参数 - featherRenderer.featherSwitchThreshold，羽化半径/图形原本长度 小于这个值时使用scatter。

用于gather shader读取的纹理 - featherRenderer.scatterEdgeTexture

避免shader循环超限的图形简化算法 - scatter-edge-simplifier.ts

### Scatter闪烁抑制相关

修改了原本upsample shader的抑制逻辑- feather-upsample.frag.glsl

- 目前使用两个通道，效果比以前单通道好。
- 如果后续测试发现两个通道有什么性能/驱动之类的不可接受开销，按照代码注释修改回去即可。

为了更好的抑制闪烁，引入一个新的uniform变量 uScreenRadius - vector-feather-renderer.ts & feather-offscreen-pass.ts

