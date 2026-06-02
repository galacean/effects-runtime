import type { TrackAsset, spec } from '@galacean/effects';
import { TransformPlayableAsset } from '@galacean/effects';
import { COLORS } from './theme';
import type { KeyframeData, TransformPropertyChannel, TransformPropertyGroup, CurveSegmentData, CurveChannelData, CurvePropertyGroup, CurveCanvasChannel } from './types';
import type { SequencerState } from './sequencer-state';
import { getCurveChannelId } from './selection';

/**
 * 从 TransformTrack 的 clips 中提取属性分组数据
 * Position -> [X, Y, Z]，Rotation -> [X, Y, Z] 等
 */
export function getTransformPropertyGroups (trackAsset: TrackAsset): TransformPropertyGroup[] {
  const groups: TransformPropertyGroup[] = [];
  const clips = trackAsset.getClips();

  for (const clip of clips) {
    const asset = clip.asset;

    if (!(asset instanceof TransformPlayableAsset)) {
      continue;
    }

    const data = asset.transformAnimationData;

    if (!data) {
      continue;
    }

    const clipStart = clip.start;
    const clipDuration = clip.duration;

    // Position 分组
    const positionChannels: TransformPropertyChannel[] = [];

    if (data.positionOverLifetime?.path) {
      const pathComponents = extractVec3PathComponents(data.positionOverLifetime.path);

      if (pathComponents) {
        positionChannels.push({ label: 'X', keyframes: pathComponents.x, color: COLORS.channelX });
        positionChannels.push({ label: 'Y', keyframes: pathComponents.y, color: COLORS.channelY });
        positionChannels.push({ label: 'Z', keyframes: pathComponents.z, color: COLORS.channelZ });
      }
    }

    if (data.positionOverLifetime) {
      addChannelFromExpression(positionChannels, data.positionOverLifetime.linearX, 'X', COLORS.channelX);
      addChannelFromExpression(positionChannels, data.positionOverLifetime.linearY, 'Y', COLORS.channelY);
      addChannelFromExpression(positionChannels, data.positionOverLifetime.linearZ, 'Z', COLORS.channelZ);
    }

    if (positionChannels.length > 0) {
      groups.push({ name: 'Position', channels: positionChannels, clipStart, clipDuration });
    }

    // Rotation 分组
    const rotationChannels: TransformPropertyChannel[] = [];

    if (data.rotationOverLifetime) {
      if (data.rotationOverLifetime.separateAxes) {
        addChannelFromExpression(rotationChannels, data.rotationOverLifetime.x, 'X', COLORS.channelX);
        addChannelFromExpression(rotationChannels, data.rotationOverLifetime.y, 'Y', COLORS.channelY);
      }
      addChannelFromExpression(rotationChannels, data.rotationOverLifetime.z, 'Z', COLORS.channelZ);
    }

    if (rotationChannels.length > 0) {
      groups.push({ name: 'Rotation', channels: rotationChannels, clipStart, clipDuration });
    }

    // Scale 分组
    const scaleChannels: TransformPropertyChannel[] = [];

    if (data.sizeOverLifetime) {
      if (data.sizeOverLifetime.separateAxes) {
        addChannelFromExpression(scaleChannels, data.sizeOverLifetime.x, 'X', COLORS.channelX);
        addChannelFromExpression(scaleChannels, data.sizeOverLifetime.y, 'Y', COLORS.channelY);
        addChannelFromExpression(scaleChannels, data.sizeOverLifetime.z, 'Z', COLORS.channelZ);
      } else {
        addChannelFromExpression(scaleChannels, data.sizeOverLifetime.size, 'Scale', COLORS.channelDefault);
      }
    }

    if (scaleChannels.length > 0) {
      groups.push({ name: 'Scale', channels: scaleChannels, clipStart, clipDuration });
    }
  }

  return groups;
}

/**
 * 聚合 clip 内所有关键帧的绝对时间（用于 Section 级关键帧菱形标记）
 */
export function getClipAggregatedKeyframeTimes (clip: { asset: unknown, start: number, duration: number }): number[] {
  const asset = clip.asset;

  if (!(asset instanceof TransformPlayableAsset)) {
    return [];
  }

  const data = asset.transformAnimationData;

  if (!data) {
    return [];
  }

  const timeSet = new Set<number>();
  const clipStart = clip.start;
  const clipDuration = clip.duration;

  const collectFromExpression = (expr: spec.FixedNumberExpression | undefined) => {
    if (!expr || !Array.isArray(expr)) {
      return;
    }
    const type = expr[0] as number;

    if (type === 21) { // BEZIER_CURVE: time is nested in kf[1][0]
      const keyframes = expr[1] as unknown[][];

      if (Array.isArray(keyframes)) {
        for (const kf of keyframes) {
          if (Array.isArray(kf) && kf.length >= 2 && Array.isArray(kf[1])) {
            const absTime = clipStart + (kf[1] as number[])[0] * clipDuration;

            timeSet.add(Math.round(absTime * 1000) / 1000);
          }
        }
      }
    } else if (type === 5) { // LINEAR: time is kf[0]
      const keyframes = expr[1] as number[][];

      if (Array.isArray(keyframes)) {
        for (const kf of keyframes) {
          if (Array.isArray(kf) && kf.length >= 2) {
            const absTime = clipStart + kf[0] * clipDuration;

            timeSet.add(Math.round(absTime * 1000) / 1000);
          }
        }
      }
    }
  };

  // 收集所有通道的关键帧
  if (data.positionOverLifetime) {
    collectFromExpression(data.positionOverLifetime.linearX);
    collectFromExpression(data.positionOverLifetime.linearY);
    collectFromExpression(data.positionOverLifetime.linearZ);
    if (data.positionOverLifetime.path) {
      const pathComponents = extractVec3PathComponents(data.positionOverLifetime.path);

      if (pathComponents) {
        for (const kf of [...pathComponents.x, ...pathComponents.y, ...pathComponents.z]) {
          const absTime = clipStart + kf.time * clipDuration;

          timeSet.add(Math.round(absTime * 1000) / 1000);
        }
      }
    }
  }

  if (data.rotationOverLifetime) {
    if (data.rotationOverLifetime.separateAxes) {
      collectFromExpression(data.rotationOverLifetime.x);
      collectFromExpression(data.rotationOverLifetime.y);
    }
    collectFromExpression(data.rotationOverLifetime.z);
  }

  if (data.sizeOverLifetime) {
    if (data.sizeOverLifetime.separateAxes) {
      collectFromExpression(data.sizeOverLifetime.x);
      collectFromExpression(data.sizeOverLifetime.y);
      collectFromExpression(data.sizeOverLifetime.z);
    } else {
      collectFromExpression(data.sizeOverLifetime.size);
    }
  }

  return [...timeSet].sort((a, b) => a - b);
}

/**
 * 辅助：从表达式提取通道数据
 */
export function addChannelFromExpression (
  channels: TransformPropertyChannel[],
  expr: spec.FixedNumberExpression | undefined,
  label: string,
  color: TransformPropertyChannel['color'],
): void {
  if (!expr || !Array.isArray(expr)) {
    return;
  }

  const keyframes = extractKeyframesFromNumberExpression(expr);

  if (keyframes.length > 0) {
    channels.push({ label, keyframes, color });
  }
}

/**
 * 从 FixedNumberExpression 中提取关键帧（时间 + 值）
 */
export function extractKeyframesFromNumberExpression (expr: spec.FixedNumberExpression): KeyframeData[] {
  if (!Array.isArray(expr) || expr.length < 2) {
    return [];
  }

  const valueType = expr[0] as number;
  const keyframeData = expr[1];

  if (!Array.isArray(keyframeData)) {
    return [];
  }

  const result: KeyframeData[] = [];

  // BEZIER_CURVE = 21: [[type, [time, value, ...]], ...]
  if (valueType === 21) {
    for (const kf of keyframeData as unknown[][]) {
      if (Array.isArray(kf) && kf.length >= 2 && Array.isArray(kf[1])) {
        const time = (kf[1] as number[])[0];
        const value = (kf[1] as number[])[1];

        if (time >= 0 && time <= 1) {
          result.push({ time, value });
        }
      }
    }
  }

  // LINE = 5: [[time, value], ...]
  if (valueType === 5) {
    for (const kf of keyframeData as number[][]) {
      if (Array.isArray(kf) && kf.length >= 2 && kf[0] >= 0 && kf[0] <= 1) {
        result.push({ time: kf[0], value: kf[1] });
      }
    }
  }

  return result;
}

/**
 * 从 Vec3 路径表达式中提取 X/Y/Z 分量的关键帧数据
 */
export function extractVec3PathComponents (expr: spec.FixedVec3Expression): { x: KeyframeData[], y: KeyframeData[], z: KeyframeData[] } | null {
  if (!Array.isArray(expr) || expr.length < 2) {
    return null;
  }

  const valueType = expr[0] as number;
  const pathData = expr[1];

  if (!Array.isArray(pathData)) {
    return null;
  }

  const xKeyframes: KeyframeData[] = [];
  const yKeyframes: KeyframeData[] = [];
  const zKeyframes: KeyframeData[] = [];

  // BEZIER_PATH(7) / LINEAR_PATH(12) / BEZIER_CURVE_PATH(22)
  // 格式: [easing[], points[]] 其中 points 包含 [x, y, z] 坐标
  if (valueType === 7 || valueType === 12 || valueType === 22) {
    const easing = pathData[0];
    const points = pathData[1];

    if (Array.isArray(easing) && Array.isArray(points)) {
      for (let i = 0; i < easing.length && i < points.length; i++) {
        const easingEntry = easing[i] as number | number[];
        let time = 0;

        if (Array.isArray(easingEntry)) {
          time = Array.isArray(easingEntry[1]) ? (easingEntry[1] as unknown as number[])[0] : easingEntry[0];
        } else if (typeof easingEntry === 'number') {
          time = easingEntry;
        }

        if (time >= 0 && time <= 1) {
          const point = points[i] as number[];

          if (Array.isArray(point) && point.length >= 3) {
            xKeyframes.push({ time, value: point[0] });
            yKeyframes.push({ time, value: point[1] });
            zKeyframes.push({ time, value: point[2] });
          }
        }
      }
    }
  }

  if (xKeyframes.length === 0 && yKeyframes.length === 0 && zKeyframes.length === 0) {
    return null;
  }

  return { x: xKeyframes, y: yKeyframes, z: zKeyframes };
}

// BezierKeyframeType 数值常量
const KF_EASE = 1;
const KF_EASE_IN = 2;
const KF_EASE_OUT = 3;
const KF_LINE = 4;
const KF_HOLD = 5;
const KF_LINE_OUT = 6;

/**
 * 从贝塞尔关键帧数据中提取曲线上的点坐标
 */
function getPointFromBezierKeyframe (kf: unknown[]): { x: number, y: number } {
  const type = kf[0] as number;
  const data = kf[1] as number[];
  let idx: number;

  if (type === KF_EASE_IN || type === KF_EASE) {
    idx = 2;
  } else if (type === KF_HOLD) {
    const markType = kf[2] as number | undefined;

    idx = (markType === KF_EASE_IN) ? 2 : 0;
  } else {
    idx = 0;
  }

  return { x: data[idx], y: data[idx + 1] };
}

/**
 * 关键帧右侧是否有缓动控制点
 */
function hasRightSideEase (kf: unknown[]): boolean {
  const type = kf[0] as number;

  if (type === KF_HOLD) {
    const markType = kf[2] as number | undefined;

    return markType === KF_EASE || markType === KF_EASE_OUT;
  }

  return type === KF_EASE || type === KF_EASE_OUT;
}

/**
 * 关键帧左侧是否有缓动控制点
 */
function hasLeftSideEase (kf: unknown[]): boolean {
  const type = kf[0] as number;

  if (type === KF_HOLD) {
    const markType = kf[2] as number | undefined;

    return markType === KF_EASE || markType === KF_EASE_IN;
  }

  return type === KF_EASE || type === KF_EASE_IN;
}

/**
 * 是否为定格出（hold-out）关键帧
 */
function isHoldOutKeyframe (kf: unknown[]): boolean {
  const type = kf[0] as number;
  const markType = kf[2] as number | undefined;

  return type === KF_HOLD && (markType === KF_HOLD || markType === KF_LINE || markType === KF_EASE_IN);
}

/**
 * 是否为定格进（hold-in）关键帧
 */
function isHoldInKeyframe (kf: unknown[]): boolean {
  const type = kf[0] as number;
  const markType = kf[2] as number | undefined;

  return type === KF_HOLD && (markType === KF_HOLD || markType === KF_LINE_OUT || markType === KF_EASE_OUT);
}

/**
 * 从相邻两个贝塞尔关键帧构建曲线段控制点
 */
function buildCurveSegment (leftKf: unknown[], rightKf: unknown[]): CurveSegmentData {
  const leftHold = isHoldOutKeyframe(leftKf);
  const rightHold = isHoldInKeyframe(rightKf);

  const leftData = leftKf[1] as number[];
  const rightData = rightKf[1] as number[];

  const leftEase = !rightHold && hasRightSideEase(leftKf);
  const rightEase = !leftHold && hasLeftSideEase(rightKf);

  let p0: { x: number, y: number };
  let p1: { x: number, y: number };
  let p2: { x: number, y: number };
  let p3: { x: number, y: number };
  let interpolation: 'bezier' | 'linear' | 'constant' = 'bezier';

  if (leftEase && rightEase) {
    // 两侧都有缓动
    p0 = { x: leftData[leftData.length - 4], y: leftData[leftData.length - 3] };
    p1 = { x: leftData[leftData.length - 2], y: leftData[leftData.length - 1] };
    p2 = { x: rightData[0], y: rightData[1] };
    p3 = { x: rightData[2], y: rightData[3] };
  } else if (leftEase && !rightEase) {
    // 仅左侧有缓动
    p0 = { x: leftData[leftData.length - 4], y: leftData[leftData.length - 3] };
    p1 = { x: leftData[leftData.length - 2], y: leftData[leftData.length - 1] };
    const rp = getPointFromBezierKeyframe(rightKf);

    p3 = rp;
    p2 = { x: p3.x - (p3.x - p0.x) / 10, y: p3.y };
  } else if (!leftEase && rightEase) {
    // 仅右侧有缓动
    const lp = getPointFromBezierKeyframe(leftKf);

    p0 = lp;
    p2 = { x: rightData[0], y: rightData[1] };
    p3 = { x: rightData[2], y: rightData[3] };
    p1 = { x: p0.x + (p3.x - p0.x) / 10, y: p0.y };
  } else {
    // 两侧都是线性
    p0 = getPointFromBezierKeyframe(leftKf);
    p3 = getPointFromBezierKeyframe(rightKf);

    if (leftHold) {
      p3 = { x: p3.x, y: p0.y };
      interpolation = 'constant';
    } else {
      interpolation = 'linear';
    }

    // 线性段的控制点在直线上的三等分处
    p1 = { x: p0.x + (p3.x - p0.x) / 3, y: p0.y + (p3.y - p0.y) / 3 };
    p2 = { x: p0.x + (p3.x - p0.x) * 2 / 3, y: p0.y + (p3.y - p0.y) * 2 / 3 };
  }

  return {
    startTime: p0.x,
    startValue: p0.y,
    endTime: p3.x,
    endValue: p3.y,
    cp1: p1,
    cp2: p2,
    interpolation,
  };
}

/**
 * 从 FixedNumberExpression 中提取曲线段数据
 */
function extractCurveSegments (expr: spec.FixedNumberExpression): { keyframes: KeyframeData[], segments: CurveSegmentData[] } {
  if (!Array.isArray(expr) || expr.length < 2) {
    return { keyframes: [], segments: [] };
  }

  const valueType = expr[0] as number;
  const keyframeData = expr[1];

  if (!Array.isArray(keyframeData)) {
    return { keyframes: [], segments: [] };
  }

  const keyframes: KeyframeData[] = [];
  const segments: CurveSegmentData[] = [];

  if (valueType === 21) {
    // BEZIER_CURVE: 提取关键帧点和贝塞尔段
    const rawKfs = keyframeData as unknown[][];

    for (const kf of rawKfs) {
      if (!Array.isArray(kf) || kf.length < 2 || !Array.isArray(kf[1])) {
        continue;
      }
      const pt = getPointFromBezierKeyframe(kf);

      if (pt.x >= 0 && pt.x <= 1) {
        keyframes.push({ time: pt.x, value: pt.y });
      }
    }

    for (let i = 0; i < rawKfs.length - 1; i++) {
      const left = rawKfs[i];
      const right = rawKfs[i + 1];

      if (!Array.isArray(left) || left.length < 2 || !Array.isArray(left[1])) {
        continue;
      }
      if (!Array.isArray(right) || right.length < 2 || !Array.isArray(right[1])) {
        continue;
      }

      segments.push(buildCurveSegment(left, right));
    }
  } else if (valueType === 5) {
    // LINE: 线性插值段
    const lineData = keyframeData as number[][];

    for (const kf of lineData) {
      if (Array.isArray(kf) && kf.length >= 2 && kf[0] >= 0 && kf[0] <= 1) {
        keyframes.push({ time: kf[0], value: kf[1] });
      }
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
      const s = keyframes[i];
      const e = keyframes[i + 1];

      segments.push({
        startTime: s.time,
        startValue: s.value,
        endTime: e.time,
        endValue: e.value,
        cp1: { x: s.time + (e.time - s.time) / 3, y: s.value + (e.value - s.value) / 3 },
        cp2: { x: s.time + (e.time - s.time) * 2 / 3, y: s.value + (e.value - s.value) * 2 / 3 },
        interpolation: 'linear',
      });
    }
  }

  return { keyframes, segments };
}

/**
 * 计算曲线通道的值域范围（含控制点和 10% padding）
 */
function computeValueRange (keyframes: KeyframeData[], segments: CurveSegmentData[]): { min: number, max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const kf of keyframes) {
    min = Math.min(min, kf.value);
    max = Math.max(max, kf.value);
  }

  for (const seg of segments) {
    if (seg.interpolation === 'bezier') {
      min = Math.min(min, seg.cp1.y, seg.cp2.y);
      max = Math.max(max, seg.cp1.y, seg.cp2.y);
    }
  }

  if (!isFinite(min) || !isFinite(max)) {
    return { min: -1, max: 1 };
  }

  const range = max - min;
  const padding = range > 0 ? range * 0.1 : 0.5;

  return { min: min - padding, max: max + padding };
}

/**
 * 从 Vec3 路径表达式提取 X/Y/Z 分量的曲线通道数据（含 segments）
 */
function addCurveChannelsFromPath (
  channels: CurveChannelData[],
  pathExpr: spec.FixedVec3Expression | undefined,
  colors: { x: CurveChannelData['color'], y: CurveChannelData['color'], z: CurveChannelData['color'] },
): void {
  const pathComponents = extractVec3PathComponents(pathExpr as spec.FixedVec3Expression);

  if (!pathComponents) {
    return;
  }

  const components: { label: string, keyframes: KeyframeData[], color: CurveChannelData['color'] }[] = [
    { label: 'X', keyframes: pathComponents.x, color: colors.x },
    { label: 'Y', keyframes: pathComponents.y, color: colors.y },
    { label: 'Z', keyframes: pathComponents.z, color: colors.z },
  ];

  for (const comp of components) {
    if (comp.keyframes.length === 0) {
      continue;
    }

    // 生成线性 segments
    const segments: CurveSegmentData[] = [];

    for (let i = 0; i < comp.keyframes.length - 1; i++) {
      const s = comp.keyframes[i];
      const e = comp.keyframes[i + 1];

      segments.push({
        startTime: s.time,
        startValue: s.value,
        endTime: e.time,
        endValue: e.value,
        cp1: { x: s.time + (e.time - s.time) / 3, y: s.value + (e.value - s.value) / 3 },
        cp2: { x: s.time + (e.time - s.time) * 2 / 3, y: s.value + (e.value - s.value) * 2 / 3 },
        interpolation: 'linear',
      });
    }

    const { min, max } = computeValueRange(comp.keyframes, segments);

    channels.push({
      label: comp.label,
      keyframes: comp.keyframes,
      segments,
      color: comp.color,
      valueMin: min,
      valueMax: max,
    });
  }
}

/**
 * 从表达式提取曲线通道数据
 */
function addCurveChannelFromExpression (
  channels: CurveChannelData[],
  expr: spec.FixedNumberExpression | undefined,
  label: string,
  color: CurveChannelData['color'],
): void {
  if (!expr || !Array.isArray(expr)) {
    return;
  }

  const { keyframes, segments } = extractCurveSegments(expr);

  if (keyframes.length === 0) {
    return;
  }

  const { min, max } = computeValueRange(keyframes, segments);

  channels.push({ label, keyframes, segments, color, valueMin: min, valueMax: max });
}

/**
 * 从 TransformTrack 的 clips 中提取曲线属性分组数据（含控制点信息）
 */
export function getCurvePropertyGroups (trackAsset: TrackAsset): CurvePropertyGroup[] {
  const groups: CurvePropertyGroup[] = [];
  const clips = trackAsset.getClips();

  for (const clip of clips) {
    const asset = clip.asset;

    if (!(asset instanceof TransformPlayableAsset)) {
      continue;
    }

    const data = asset.transformAnimationData;

    if (!data) {
      continue;
    }

    const clipStart = clip.start;
    const clipDuration = clip.duration;

    // Position
    const posChannels: CurveChannelData[] = [];

    if (data.positionOverLifetime) {
      // 优先从 path 提取
      if (data.positionOverLifetime.path) {
        addCurveChannelsFromPath(posChannels, data.positionOverLifetime.path, {
          x: COLORS.channelX, y: COLORS.channelY, z: COLORS.channelZ,
        });
      }
      // 补充从 linearX/Y/Z 提取（如果 path 没有数据）
      if (posChannels.length === 0) {
        addCurveChannelFromExpression(posChannels, data.positionOverLifetime.linearX, 'X', COLORS.channelX);
        addCurveChannelFromExpression(posChannels, data.positionOverLifetime.linearY, 'Y', COLORS.channelY);
        addCurveChannelFromExpression(posChannels, data.positionOverLifetime.linearZ, 'Z', COLORS.channelZ);
      }
    }

    if (posChannels.length > 0) {
      groups.push({ name: 'Position', channels: posChannels, clipStart, clipDuration });
    }

    // Rotation
    const rotChannels: CurveChannelData[] = [];

    if (data.rotationOverLifetime) {
      if (data.rotationOverLifetime.separateAxes) {
        addCurveChannelFromExpression(rotChannels, data.rotationOverLifetime.x, 'X', COLORS.channelX);
        addCurveChannelFromExpression(rotChannels, data.rotationOverLifetime.y, 'Y', COLORS.channelY);
      }
      addCurveChannelFromExpression(rotChannels, data.rotationOverLifetime.z, 'Z', COLORS.channelZ);
    }

    if (rotChannels.length > 0) {
      groups.push({ name: 'Rotation', channels: rotChannels, clipStart, clipDuration });
    }

    // Scale
    const scaleChannels: CurveChannelData[] = [];

    if (data.sizeOverLifetime) {
      if (data.sizeOverLifetime.separateAxes) {
        addCurveChannelFromExpression(scaleChannels, data.sizeOverLifetime.x, 'X', COLORS.channelX);
        addCurveChannelFromExpression(scaleChannels, data.sizeOverLifetime.y, 'Y', COLORS.channelY);
        addCurveChannelFromExpression(scaleChannels, data.sizeOverLifetime.z, 'Z', COLORS.channelZ);
      } else {
        addCurveChannelFromExpression(scaleChannels, data.sizeOverLifetime.size, 'Scale', COLORS.channelDefault);
      }
    }

    if (scaleChannels.length > 0) {
      groups.push({ name: 'Scale', channels: scaleChannels, clipStart, clipDuration });
    }
  }

  return groups;
}

/**
 * 根据当前选中状态收集应在画布中显示的曲线通道
 * - selectedChannel 有值 → 只返回该通道
 * - selectedPropertyGroup 有值 → 返回该分组下所有通道
 * - 否则 → 返回选中轨道下所有通道
 */
export function collectCurveChannelsForSelection (state: SequencerState, trackAsset: TrackAsset): CurveCanvasChannel[] {
  const trackId = trackAsset.getInstanceId().toString();
  const groups = getCurvePropertyGroups(trackAsset);
  const result: CurveCanvasChannel[] = [];

  for (const group of groups) {
    const groupId = `${trackId}_${group.name}`;

    for (const channel of group.channels) {
      const channelId = getCurveChannelId(trackId, group.name, channel.label);

      if (state.selectedChannel !== null) {
        if (channelId !== state.selectedChannel) {
          continue;
        }
      } else if (state.selectedPropertyGroup !== null) {
        if (groupId !== state.selectedPropertyGroup) {
          continue;
        }
      }

      result.push({
        id: channelId,
        trackId,
        groupName: group.name,
        channelLabel: channel.label,
        channelData: channel,
        clipStart: group.clipStart,
        clipDuration: group.clipDuration,
      });
    }
  }

  return result;
}

/**
 * 对通道列表计算共享值域
 */
export function computeSharedValueRange (channels: CurveCanvasChannel[]): { min: number, max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const ch of channels) {
    min = Math.min(min, ch.channelData.valueMin);
    max = Math.max(max, ch.channelData.valueMax);
  }

  if (!isFinite(min) || !isFinite(max)) {
    return { min: -1, max: 1 };
  }

  if (max - min < 1e-6) {
    return { min: min - 0.5, max: max + 0.5 };
  }

  return { min, max };
}
