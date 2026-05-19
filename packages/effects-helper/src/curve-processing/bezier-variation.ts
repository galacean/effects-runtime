import type { Keyframe } from './model';
import { TangentMode, WeightedMode } from './model';

export type BezierKeyframeProcessParameters = {
  intensity: number,
  speed: number,
  loopCount: number,
  noise: number,
};

function clamp (v: number, a: number, b: number): number {
  return v < a ? a : (v > b ? b : v);
}

function isNum (x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * 对运行时关键帧执行程序化变体处理。
 *
 * 处理阶段：
 * 1) 强度缩放
 * 2) 可选噪声与自适应插点
 * 3) 循环展开与时间重映射
 */
export function processBezierKeyframe (
  keyframes: Keyframe[],
  parameters: BezierKeyframeProcessParameters,
): Keyframe[] {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    return [];
  }

  const intensity = clamp(isNum(parameters?.intensity) ? parameters.intensity : 1.0, 0.0, 2.0);
  const loopCount = Math.max(1, Math.floor(isNum(parameters?.loopCount) ? parameters.loopCount : 1));
  const noiseLevel = clamp(isNum(parameters?.noise) ? parameters.noise : 0.0, 0.0, 1.0);
  let base = keyframes.slice().sort((a, b) => a.time - b.time).map(k => ({ ...k }));
  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < base.length; i++) {
    if (base[i].value < minV) {
      minV = base[i].value;
    }
    if (base[i].value > maxV) {
      maxV = base[i].value;
    }
  }

  const valueRange = maxV - minV;
  let seed = 2166136261 >>> 0;

  // 确定性伪随机源：相同输入可复现相同结果。
  function hash (x: number) {
    seed ^= (x * 16777619) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);

    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  }

  // 邻域平滑随机值，避免局部抖动尖峰。
  function rSmooth (i: number, tag: number, n: number) {
    const r0 = hash(tag + i) * 2 - 1;
    const rl = hash(tag + (i > 0 ? i - 1 : i)) * 2 - 1;
    const rr = hash(tag + (i < n - 1 ? i + 1 : i)) * 2 - 1;
    const r = 0.25 * rl + 0.5 * r0 + 0.25 * rr;

    return r < -1 ? -1 : (r > 1 ? 1 : r);
  }

  // 先做全局强度缩放，再叠加噪声，确保噪声相对当前形态生效。
  for (let i = 0; i < base.length; i++) {
    const k = base[i];

    k.value = k.value * intensity;
    if (isNum(k.inSlope)) {
      k.inSlope = clamp(k.inSlope * intensity, -1e6, 1e6);
    }
    if (isNum(k.outSlope)) {
      k.outSlope = clamp(k.outSlope * intensity, -1e6, 1e6);
    }
  }

  if (noiseLevel > 0) {
    const n = base.length;
    const originalSlopes = base.map(k => ({
      inSlope: k.inSlope,
      outSlope: k.outSlope,
    }));
    const extendedBase: Keyframe[] = [];
    const insertPoints = Math.max(1, Math.floor(4 * noiseLevel));

    for (let i = 0; i < n - 1; i++) {
      const curr = base[i];
      const next = base[i + 1];

      if (i < n) {
        const rs = rSmooth(i, 5059, n);
        const slopeNoise = rs * Math.pow(noiseLevel, 2) * 0.2;

        if (isNum(curr.outSlope)) {
          const originalSlope = originalSlopes[i].outSlope;

          curr.outSlope = isNum(originalSlope)
            ? originalSlope + originalSlope * slopeNoise
            : curr.outSlope;
        }
        if (isNum(curr.inSlope)) {
          const originalSlope = originalSlopes[i].inSlope;

          curr.inSlope = isNum(originalSlope)
            ? originalSlope + originalSlope * slopeNoise
            : curr.inSlope;
        }
      }

      extendedBase.push(curr);

      if (insertPoints > 0) {
        // 用 Hermite 插值补点，尽量保持段间连续性。
        const avgSlope = (next.value - curr.value) / (next.time - curr.time);

        for (let j = 1; j <= insertPoints; j++) {
          const t = j / (insertPoints + 1);
          const time = curr.time + (next.time - curr.time) * t;
          const t2 = t * t;
          const t3 = t2 * t;
          const h00 = 2 * t3 - 3 * t2 + 1;
          const h10 = t3 - 2 * t2 + t;
          const h01 = -2 * t3 + 3 * t2;
          const h11 = t3 - t2;
          const baseValue = h00 * curr.value +
            h10 * (curr.outSlope || avgSlope) * (next.time - curr.time) +
            h01 * next.value +
            h11 * (next.inSlope || avgSlope) * (next.time - curr.time);
          const baseInSlope = avgSlope * 0.9 + (curr.outSlope || avgSlope) * 0.1;
          const baseOutSlope = avgSlope * 0.9 + (next.inSlope || avgSlope) * 0.1;

          extendedBase.push({
            time,
            value: baseValue,
            inSlope: baseInSlope,
            outSlope: baseOutSlope,
            inWeight: 0.33,
            outWeight: 0.33,
            weightedMode: WeightedMode.Both,
            tangentMode: TangentMode.Cubic,
          });
        }
      }
    }

    const last = base[n - 1];
    const rs = rSmooth(n - 1, 5059, n);
    const slopeNoise = rs * Math.pow(noiseLevel, 2) * 0.2;

    if (isNum(last.inSlope)) {
      const originalSlope = originalSlopes[n - 1].inSlope;

      last.inSlope = isNum(originalSlope)
        ? originalSlope + originalSlope * slopeNoise
        : last.inSlope;
    }
    extendedBase.push(last);

    if (noiseLevel > 0.1) {
      // 高噪声分支：对 value/slope/weight 施加更强扰动。
      const newN = extendedBase.length;
      const noiseStrength = Math.pow((noiseLevel - 0.1) / 0.9, 2);
      const ampValue = valueRange * (0.15 * noiseStrength);
      const ampSlopeRel = 0.15 * noiseStrength;
      const ampWeight = 0.1 * noiseStrength;

      for (let i = 0; i < newN; i++) {
        const k = extendedBase[i];

        if (base.some(orig => orig.time === k.time)) {
          continue;
        }

        const rv1 = rSmooth(i, 2029, newN);
        const rv2 = rSmooth(i * 2, 3037, newN * 2);
        const valueNoise = Math.pow(noiseLevel, 1.5) * (
          Math.cos(rv1 * Math.PI) * 0.7 +
          Math.cos(rv2 * Math.PI) * 0.3
        ) * ampValue;

        k.value += valueNoise;

        if (isNum(k.outSlope) || isNum(k.inSlope)) {
          const noiseSlopeBase = rSmooth(i, 5059, newN);
          const slopeNoise = Math.tanh(noiseSlopeBase * ampSlopeRel);

          if (isNum(k.outSlope)) {
            const newSlope = k.outSlope * (1 + slopeNoise * noiseStrength);

            k.outSlope = clamp(newSlope, k.outSlope * 0.9, k.outSlope * 1.1);
          }
          if (isNum(k.inSlope)) {
            const newSlope = k.inSlope * (1 + slopeNoise * noiseStrength);

            k.inSlope = clamp(newSlope, k.inSlope * 0.9, k.inSlope * 1.1);
          }
        }

        const weightStrength = Math.pow(noiseLevel, 2);

        if (k.weightedMode === WeightedMode.Both || k.weightedMode === WeightedMode.In) {
          const rwIn = rSmooth(i * 2, 6067, newN * 2);

          k.inWeight = clamp(0.33 + rwIn * ampWeight * weightStrength, 0.3, 0.7);
        }
        if (k.weightedMode === WeightedMode.Both || k.weightedMode === WeightedMode.Out) {
          const rwOut = rSmooth(i * 2 + 1, 7079, newN * 2);

          k.outWeight = clamp(0.33 + rwOut * ampWeight * weightStrength, 0.3, 0.7);
        }
      }
    }

    base = extendedBase;
  }

  const result: Keyframe[] = [];

  // 循环展开：每轮映射回 [0, 1] 时间域。
  for (let loopIndex = 0; loopIndex < loopCount; loopIndex++) {
    const tOffset = loopIndex / loopCount;
    const tScale = 1 / loopCount;

    for (let i = 0; i < base.length; i++) {
      if (loopIndex > 0 && i === 0) {
        continue;
      }
      const src = base[i];

      result.push({
        time: src.time * tScale + tOffset,
        value: src.value,
        inSlope: isNum(src.inSlope) ? src.inSlope * loopCount : src.inSlope,
        outSlope: isNum(src.outSlope) ? src.outSlope * loopCount : src.outSlope,
        inWeight: src.inWeight,
        outWeight: src.outWeight,
        weightedMode: src.weightedMode,
        tangentMode: src.tangentMode,
      });
    }
  }

  return result;
}
