# Galacean Effects Helper

Galacean Effects Helper 提供了一组围绕特效制作与场景处理的可复用工具能力。

当前该包包含一个曲线处理子系统，能够：

- 在规范 Bezier 关键帧格式与运行时可编辑关键帧格式之间进行转换
- 以可组合、可预测的流水线方式应用曲线效果器
- 在制作期或运行前处理阶段对曲线进行重采样、扰动、增益与循环展开

## Curve Processing

### 数据模型

曲线子系统采用归一化的运行时关键帧模型：

- time, value
- inSlope, outSlope
- inWeight, outWeight
- tangentMode: Cubic, Linear, Constant
- weightedMode: None, In, Out, Both

相关定义：

- Keyframe, TangentMode, WeightedMode
- ProcessCurveContext
- CurveResult
- CurveEffects base class

以上类型和基类均定义于 [model.ts](src/curve-processing/model.ts)。

### 处理流水线

[processor.ts](src/curve-processing/processor.ts) 中的 CurveEffectsProcessor 按固定顺序执行：

1. 接收调用方传入的运行时 Keyframe 数组
2. 按顺序执行启用的效果器
3. 将结果转换回规范 Bezier 关键帧

默认效果链顺序：

1. Boost
2. Increase
3. Resampler
4. Distortion
5. Looper

该顺序有明确设计意图：

- 振幅类修改优先执行
- 在加扰动前先重采样，保证关键帧密度稳定
- 循环展开最后执行，保证时间压缩行为一致

### 转换层

[bezier-conversion.ts](src/curve-processing/bezier-conversion.ts) 提供以下转换函数：

- newBezierKeyframesToOld
- getControlPoints
- keyframeInfo helpers

这些工具负责处理：

- ease/line 段控制点计算
- hold in / hold out 语义处理
- slope 与 weight 重建
- 空输入场景的边界安全处理

### Bezier 变体处理

[bezier-variation.ts](src/curve-processing/bezier-variation.ts) 的入口能力包括：

- processBezierKeyframe
- BezierKeyframeProcessParameters

主要行为：

- 按 intensity 对 value 和 slope 进行缩放
- 对 value 与切线施加可选程序化噪声
- 自适应插点，增强运动细节
- 循环展开时进行时间重映射与斜率补偿

### Effects 详细说明

#### Distortion

文件：[distortion.ts](src/curve-processing/effects/distortion.ts)

- 为 value 与 slope 增加伪随机扰动
- 按 valueRange 与 timeRange 比例缩放扰动幅度
- 包含空输入与 epsilon 级别边界保护

#### Looper

文件：[looper.ts](src/curve-processing/effects/looper.ts)

- 将曲线按 loopCount 展开到 0..1 的时间范围内
- 避免循环拼接处出现重复关键帧
- 通过 slope 乘以 loopCount 来保持曲线形态

#### Resampler

文件：[resampler.ts](src/curve-processing/effects/resampler.ts)

- 将曲线重采样为固定 sampleCount
- 支持 Constant、Linear、Cubic 三种切线模式
- Cubic 模式结合牛顿迭代与 de Casteljau 分割求解
- 对重复时间点和近零分母场景做了保护

#### Volume Effects

文件：[volume-effects.ts](src/curve-processing/effects/volume-effects.ts)

- Boost: multiply value and slopes
- Increase: add offset to value and slopes
- Attenuation: time-based attenuation
- Gain: time-based amplification

### 主要函数详解（含示例）

#### 1. CurveEffectsProcessor.addEffects

位置：[processor.ts](src/curve-processing/processor.ts)

功能说明：

- 向处理器中注册一个新的 Effect 类型。
- 返回新建的 effect 实例，便于立即修改参数（如 `intensity`、`enabled`）。

示例：

```ts
import { CurveEffectsProcessor, Boost } from '@galacean/effects-helper';

const processor = new CurveEffectsProcessor();
const boost = processor.addEffects(Boost);

boost.intensity = 1.5;
```

#### 2. CurveEffectsProcessor.processCurve

位置：[processor.ts](src/curve-processing/processor.ts)

函数签名：

```ts
processCurve(keyframes: Keyframe[]): spec.BezierKeyframeValue[]
```

功能说明：

- 输入：运行时 `Keyframe[]`（不是规范 BezierKeyframeValue[]）。
- 行为：按当前 effect 链顺序处理曲线。
- 输出：规范格式 `spec.BezierKeyframeValue[]`，便于回写到特效数据结构。
- 细节：内部会先复制一份 keyframe，避免直接修改调用方传入数组。

示例：

```ts
import type { spec } from '@galacean/effects';
import { oldBezierKeyframesToNew } from '@galacean/effects';
import { CurveEffectsProcessor } from '@galacean/effects-helper';

const input: spec.BezierKeyframeValue[] = [
	[4, [0, 0]],
	[4, [1, 1]],
];

const processor = new CurveEffectsProcessor({
	intensity: 1,
	loopCount: 2,
	noise: 0.2,
});

const output = processor.processCurve(oldBezierKeyframesToNew(input));
```

#### 3. newBezierKeyframesToOld

位置：[bezier-conversion.ts](src/curve-processing/bezier-conversion.ts)

函数签名：

```ts
newBezierKeyframesToOld(keyframes: Keyframe[]): spec.BezierKeyframeValue[]
```

功能说明：

- 将运行时 `Keyframe[]` 转换为规范 Bezier 关键帧格式。
- 会根据 `tangentMode` 决定输出 HOLD 或 EASE 关键帧。
- 对空输入返回空数组。

示例：

```ts
import { newBezierKeyframesToOld } from '@galacean/effects-helper';

const oldFormat = newBezierKeyframesToOld(runtimeKeyframes);
```

#### 4. getControlPoints

位置：[bezier-conversion.ts](src/curve-processing/bezier-conversion.ts)

函数签名：

```ts
getControlPoints(leftKeyframe, rightKeyframe, lineToBezier)
```

功能说明：

- 输入相邻两个规范关键帧。
- 自动识别 ease/line/hold 语义，计算对应控制点。
- 当 `lineToBezier=true` 时，会把线段补齐为三次贝塞尔控制点。

示例：

```ts
import { getControlPoints } from '@galacean/effects-helper';

const cp = getControlPoints(oldFrames[i], oldFrames[i + 1], true);
if (cp.type === 'ease') {
	// cp.p0, cp.p1, cp.p2, cp.p3
}
```

#### 5. keyframeInfo（工具集合）

位置：[bezier-conversion.ts](src/curve-processing/bezier-conversion.ts)

主要方法：

- `getPointInCurve`：提取关键帧在曲线上的锚点。
- `getPointIndexInCurve`：根据类型定位时间和值索引。
- `isLeftSideEase` / `isRightSideEase`：判定左右侧是否为缓动段。
- `isHoldInKeyframe` / `isHoldOutKeyframe`：判定 hold 语义。

示例：

```ts
import { keyframeInfo } from '@galacean/effects-helper';

const point = keyframeInfo.getPointInCurve(frame);
const isHoldOut = keyframeInfo.isHoldOutKeyframe(frame);
```

#### 6. processBezierKeyframe

位置：[bezier-variation.ts](src/curve-processing/bezier-variation.ts)

函数签名：

```ts
processBezierKeyframe(
	keyframes: Keyframe[],
	parameters: BezierKeyframeProcessParameters,
): Keyframe[]
```

功能说明：

- 对运行时 `Keyframe[]` 做程序化变体处理。
- 支持强度缩放、噪声扰动、插点增强、循环展开。
- 输出仍是运行时 `Keyframe[]`，通常可继续交给 `newBezierKeyframesToOld` 回写。

示例：

```ts
import { processBezierKeyframe, newBezierKeyframesToOld } from '@galacean/effects-helper';

const varied = processBezierKeyframe(runtimeKeyframes, {
	intensity: 1.2,
	speed: 1.0,
	loopCount: 3,
	noise: 0.25,
});

const output = newBezierKeyframesToOld(varied);
```

#### 7. Effect 基类与子类的 processCurve

位置：

- 基类：[model.ts](src/curve-processing/model.ts)
- 实现类：[effects](src/curve-processing/effects)

功能说明：

- 所有 effect 都通过 `processCurve(context, result)` 改写 `result.keyFrames`。
- `Distortion`：添加噪声扰动。
- `Looper`：展开循环并重映射时间。
- `Resampler`：按固定采样数重建曲线。
- `Boost`/`Increase`/`Attenuation`/`Gain`：做振幅与时序增减。

示例（自定义 effect）：

```ts
import { CurveEffects } from '@galacean/effects-helper';

export class ClampValue extends CurveEffects {
	name = 'ClampValue';
	min = -1;
	max = 1;

	override processCurve (_context, result) {
		for (const keyframe of result.keyFrames) {
			if (keyframe.value < this.min) {
				keyframe.value = this.min;
			}
			if (keyframe.value > this.max) {
				keyframe.value = this.max;
			}
		}
	}
}
```

### 使用示例

```ts
import type { spec } from '@galacean/effects';
import { oldBezierKeyframesToNew } from '@galacean/effects';
import { CurveEffectsProcessor, processBezierKeyframe } from '@galacean/effects-helper';

const processor = new CurveEffectsProcessor({
	intensity: 1.0,
	loopCount: 2,
	noise: 0.3,
});

const input: spec.BezierKeyframeValue[] = [
	[4, [0, 0]],
	[4, [1, 1]],
];

const processed = processor.processCurve(oldBezierKeyframesToNew(input));

const runtimeKeyframes = oldBezierKeyframesToNew(processed);
const varied = processBezierKeyframe(runtimeKeyframes, {
	intensity: 1.2,
	speed: 1.0,
	loopCount: 3,
	noise: 0.25,
});
```

### 自定义扩展 Effect

新增自定义 effect 的步骤：

1. 继承 CurveEffects
2. 实现 processCurve
3. 通过 addEffects 注册到 CurveEffectsProcessor
4. 如需对外公开，请在 [effects/index.ts](src/curve-processing/effects/index.ts) 中导出

示例模式：

```ts
import { CurveEffects } from '@galacean/effects-helper';

export class MyCurveEffect extends CurveEffects {
	name = 'MyCurveEffect';

	override processCurve (_context, result) {
		for (const k of result.keyFrames) {
			k.value += 0.1;
		}
	}
}
```

### 说明

- 对同一输入与同一 effect 配置，曲线处理结果是确定性的。
- effect 顺序会影响输出语义，调整时请谨慎。
- 建议在包内测试目录补充聚焦测试，验证行为变更。
