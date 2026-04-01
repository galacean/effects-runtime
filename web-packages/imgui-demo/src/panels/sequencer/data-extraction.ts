import type { TrackAsset, spec } from '@galacean/effects';
import { TransformPlayableAsset } from '@galacean/effects';
import { COLORS } from './theme';
import type { KeyframeData, TransformPropertyChannel, TransformPropertyGroup } from './types';

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

    if (type === 21 || type === 5) { // BEZIER_CURVE or LINEAR
      const keyframes = expr[1] as number[][];

      if (Array.isArray(keyframes)) {
        for (const kf of keyframes) {
          if (Array.isArray(kf) && kf.length >= 2) {
            const absTime = clipStart + kf[0] * clipDuration;

            timeSet.add(Math.round(absTime * 1000) / 1000); // 精度到 ms
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
