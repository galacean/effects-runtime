import type { TrackAsset } from '@galacean/effects';
import { ActivationTrack, ParticleTrack, spec, SpriteColorTrack, SubCompositionTrack, TransformTrack } from '@galacean/effects';
import { ImGui } from '../../imgui';
import { COLORS, LAYOUT } from './theme';
import type { SequencerState } from './sequencer-state';

/**
 * 时间转换为像素位置
 */
export function timeToPixel (time: number, state: SequencerState): number {
  return (time - state.timelineStartTime) * state.pixelsPerSecond;
}

/**
 * 像素位置转换为时间
 */
export function pixelToTime (pixel: number, state: SequencerState): number {
  return state.timelineStartTime + (pixel / state.pixelsPerSecond);
}

/**
 * 绘制时间刻度标记
 */
export function drawTimeMarkers (drawList: any, timelineStart: ImGui.Vec2, timelineEndX: number, state: SequencerState): void {
  const textColor = ImGui.GetColorU32(COLORS.timelineText);
  const lineColor = ImGui.GetColorU32(COLORS.timelineLine);
  const endX = timelineEndX;
  const rulerBottom = timelineStart.y + state.timelineHeight;

  // 基于缩放动态选择"好看"的主刻度步长（1/2/5 系列）
  const secondsPerPixel = 1 / Math.max(1e-6, state.pixelsPerSecond);
  const targetPixelsPerMajor = 100;
  const roughStep = secondsPerPixel * targetPixelsPerMajor;
  const majorStep = getNiceStep(roughStep);
  const minorDiv = getMinorDivisions(majorStep);
  const minorStep = majorStep / minorDiv;

  const startTime = state.timelineStartTime;
  const endTime = state.timelineEndTime;
  const firstMajor = Math.ceil(startTime / majorStep) * majorStep;

  // 避免文本重叠：主刻度标签之间至少留 60px
  const minLabelSpacing = 60;
  let lastLabelX = -Infinity;

  // 清空缓存，供网格线使用
  state.majorTickXPositions = [];

  for (let tMajor = firstMajor; tMajor <= endTime + 1e-9; tMajor += majorStep) {
    const xMajor = timelineStart.x + LAYOUT.clipsAreaLeftPadding + timeToPixel(tMajor, state);

    if (xMajor > endX + 1) {
      break;
    }

    if (xMajor < timelineStart.x + LAYOUT.clipsAreaLeftPadding - 1) {
      continue;
    }

    // 缓存主刻度位置
    state.majorTickXPositions.push(xMajor);

    // 主刻度从底部向上 9px，1px 宽
    drawList.AddLine(
      new ImGui.Vec2(xMajor, rulerBottom - 9),
      new ImGui.Vec2(xMajor, rulerBottom),
      lineColor,
      1
    );

    // 主刻度标签（避免重叠）
    if (xMajor - lastLabelX >= minLabelSpacing) {
      const label = formatTimeLabel(tMajor, majorStep);
      const size = ImGui.CalcTextSize(label);
      const textY = rulerBottom - 9 - size.y - 2;

      drawList.AddText(
        new ImGui.Vec2(xMajor - size.x / 2, textY),
        textColor,
        label
      );

      lastLabelX = xMajor;
    }

    // 次刻度
    for (let i = 1; i < minorDiv; i++) {
      const tMinor = tMajor + i * minorStep;

      if (tMinor > endTime + 1e-9) {
        break;
      }

      const xMinor = timelineStart.x + LAYOUT.clipsAreaLeftPadding + timeToPixel(tMinor, state);

      if (xMinor > endX + 1) {
        break;
      }

      if (xMinor < timelineStart.x + LAYOUT.clipsAreaLeftPadding - 1) {
        continue;
      }

      const minorHeight = (i % 2 === 0) ? 6 : 2;

      drawList.AddLine(
        new ImGui.Vec2(xMinor, rulerBottom - minorHeight),
        new ImGui.Vec2(xMinor, rulerBottom),
        lineColor,
        1
      );
    }
  }
}

/**
 * 选择"好看"的刻度步长：使用 1/2/5 x 10^k 的序列
 */
export function getNiceStep (rough: number): number {
  const minStep = 0.01;
  const maxStep = 3600;
  const d = Math.min(Math.max(rough, minStep), maxStep);
  const exp = Math.floor(Math.log10(d));
  const base = Math.pow(10, exp);
  const frac = d / base;

  let niceFrac = 1;

  if (frac < 1.5) {
    niceFrac = 1;
  } else if (frac < 3) {
    niceFrac = 2;
  } else if (frac < 7) {
    niceFrac = 5;
  } else {
    niceFrac = 10;
  }

  return niceFrac * base;
}

/**
 * 根据主刻度步长选择次刻度划分数
 */
export function getMinorDivisions (majorStep: number): number {
  const exp = Math.floor(Math.log10(majorStep));
  const base = Math.pow(10, exp);
  const frac = majorStep / base;

  if (Math.abs(frac - 2) < 1e-6) {
    return 2;
  }

  return 5;
}

/**
 * 根据步长动态格式化时间标签
 */
export function formatTimeLabel (seconds: number, step: number): string {
  const abs = Math.max(0, seconds);
  const minutes = Math.floor(abs / 60);
  const secs = abs % 60;
  const needMs = step < 1;

  if (minutes > 0) {
    const mm = String(minutes);
    const ss = needMs ? secs.toFixed(step < 0.1 ? 2 : 1) : Math.floor(secs).toString().padStart(2, '0');

    return `${mm}:${typeof ss === 'string' && ss.includes('.') ? ss.padStart(4, '0') : ss.padStart(2, '0')}`;
  } else {
    if (needMs) {
      const precision = step < 0.1 ? 2 : 1;

      return `${secs.toFixed(precision)}s`;
    }

    return `${Math.floor(secs)}s`;
  }
}

/**
 * 开始拖拽时间游标
 */
export function beginScrub (state: SequencerState): void {
  if (state.isScrubbing) {
    return;
  }

  state.isScrubbing = true;
  const isPaused = state.currentComposition.getPaused();

  state.resumeAfterScrub = !isPaused;

  if (!isPaused) {
    state.currentComposition.pause();
  }
}

/**
 * 结束拖拽时间游标
 */
export function endScrub (state: SequencerState): void {
  if (!state.isScrubbing) {
    return;
  }

  if (state.resumeAfterScrub) {
    state.currentComposition.resume();
  }

  state.resumeAfterScrub = false;
  state.isScrubbing = false;
}

/**
 * 按轨道类别获取颜色（带缓存）
 */
export function getTrackColor (trackAsset: TrackAsset, state: SequencerState): ImGui.Vec4 {
  const trackId = trackAsset.getInstanceId();
  const cached = state.trackColorMap.get(trackId);

  if (cached) {
    return cached;
  }

  let categoryKey = 'default';

  if (trackAsset instanceof TransformTrack) {
    categoryKey = 'TransformTrack';
  } else if (trackAsset instanceof ActivationTrack) {
    categoryKey = 'ActivationTrack';
  } else if (trackAsset instanceof SpriteColorTrack) {
    categoryKey = 'SpriteColorTrack';
  } else if (trackAsset instanceof SubCompositionTrack) {
    categoryKey = 'SubCompositionTrack';
  } else if (trackAsset instanceof ParticleTrack) {
    categoryKey = 'ParticleTrack';
  }

  const color = COLORS.trackCategory[categoryKey];

  state.trackColorMap.set(trackId, color);

  return color;
}

/**
 * 根据 EndBehavior 获取描述文本
 */
export function getEndBehaviorDescription (endBehavior: spec.EndBehavior): string {
  switch (endBehavior) {
    case spec.EndBehavior.destroy:
      return 'Destroy - 播放结束后销毁';
    case spec.EndBehavior.freeze:
      return 'Freeze - 播放结束后冻结在最后一帧';
    case spec.EndBehavior.restart:
      return 'Restart - 播放结束后重新开始循环';
    case spec.EndBehavior.forward:
      return 'Forward - 播放结束后继续前进';
    default:
      return 'Unknown EndBehavior';
  }
}

/**
 * Section 颜色处理：HSV 调整饱和度和亮度
 */
export function processSectionColor (baseColor: ImGui.Vec4): ImGui.Vec4 {
  const r = baseColor.x, g = baseColor.y, b = baseColor.z;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0, s = 0, v = max;

  if (max !== 0) {
    s = d / max;
  }

  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }

    h /= 6;

    if (h < 0) {
      h += 1;
    }
  }

  // 适度降低饱和度和亮度，保持颜色可辨识
  s *= 0.7;
  v *= 0.6;

  // HSV -> RGB
  const hi = Math.floor(h * 6);
  const f = h * 6 - hi;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let rr = 0, gg = 0, bb = 0;

  switch (hi % 6) {
    case 0:
      rr = v; gg = t; bb = p;

      break;
    case 1:
      rr = q; gg = v; bb = p;

      break;
    case 2:
      rr = p; gg = v; bb = t;

      break;
    case 3:
      rr = p; gg = q; bb = v;

      break;
    case 4:
      rr = t; gg = p; bb = v;

      break;
    case 5:
      rr = v; gg = p; bb = q;

      break;
    default:
      rr = v; gg = v; bb = v;
  }

  return new ImGui.Vec4(rr, gg, bb, baseColor.w);
}
