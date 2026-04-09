import { ImGui } from '../../imgui';
import { COLORS, LAYOUT } from './theme';
import type { SequencerState } from './sequencer-state';
import type { CurveChannelData, CurveCanvasChannel, KeyframeData } from './types';
import { getKeyframeId, toggleKeyframeSelection, clearKeyframeSelection } from './selection';
import { timeToPixel } from './timeline-utils';

/**
 * 值空间到屏幕 Y 坐标的映射
 * 值越大 → 屏幕 Y 越小（向上）
 */
function valueToPixelY (
  value: number,
  rowTopY: number,
  valueMin: number,
  valueMax: number,
): number {
  const padding = LAYOUT.curveVerticalPadding;
  const drawableHeight = LAYOUT.curveRowHeight - 2 * padding;
  const range = valueMax - valueMin;

  if (range < 1e-6) {
    return rowTopY + LAYOUT.curveRowHeight / 2;
  }

  const normalized = (value - valueMin) / range;

  return rowTopY + padding + (1 - normalized) * drawableHeight;
}

/**
 * 画布模式：值空间到屏幕 Y 坐标的映射（使用画布高度）
 */
function canvasValueToPixelY (
  value: number,
  canvasTopY: number,
  canvasHeight: number,
  valueMin: number,
  valueMax: number,
): number {
  const padding = LAYOUT.curveVerticalPadding;
  const drawableHeight = canvasHeight - 2 * padding;
  const range = valueMax - valueMin;

  if (range < 1e-6) {
    return canvasTopY + canvasHeight / 2;
  }

  const normalized = (value - valueMin) / range;

  return canvasTopY + padding + (1 - normalized) * drawableHeight;
}

/**
 * 归一化时间转换为屏幕 X 坐标
 */
function normalizedTimeToPixelX (
  normalizedTime: number,
  lineStartX: number,
  clipStart: number,
  clipDuration: number,
  state: SequencerState,
): number {
  const absoluteTime = clipStart + normalizedTime * clipDuration;

  return lineStartX + LAYOUT.clipsAreaLeftPadding + timeToPixel(absoluteTime, state);
}

export class CurveRenderer {
  constructor (private readonly state: SequencerState) {}

  /**
   * 绘制通道曲线视图（替代关键帧菱形视图）
   */
  drawChannelCurve (
    channel: CurveChannelData,
    trackId: string,
    groupName: string,
    clipStart: number,
    clipDuration: number,
  ): void {
    const state = this.state;
    const frameHeight = LAYOUT.curveRowHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const rowIndex = state.trackRowCounter++;
    const windowWidth = ImGui.GetContentRegionAvail().x;

    // 背景
    const bgColor = (rowIndex % 2 === 0)
      ? new ImGui.Vec4(0.08, 0.08, 0.09, 1.0)
      : new ImGui.Vec4(0.09, 0.09, 0.10, 1.0);

    drawList.AddRectFilled(
      lineStartPos,
      new ImGui.Vec2(lineStartPos.x + windowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(bgColor)
    );

    // 行底部分割线
    drawList.AddLine(
      new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight),
      new ImGui.Vec2(lineStartPos.x + windowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(COLORS.trackRowDivider),
      1
    );

    const rowTopY = lineStartPos.y;
    const { valueMin, valueMax } = channel;

    // 值轴网格线
    this.drawValueGrid(drawList, lineStartPos, windowWidth, rowTopY, valueMin, valueMax);

    // 绘制曲线段
    this.drawCurveSegments(drawList, channel, lineStartPos.x, rowTopY, clipStart, clipDuration);

    // 绘制关键帧圆点 + 交互
    const channelLabel = `${groupName}.${channel.label}`;

    this.drawKeyframeDots(drawList, channel, trackId, channelLabel, lineStartPos, windowWidth, rowTopY, clipStart, clipDuration);

    // 移动光标到下一行
    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight));
  }

  /**
   * 绘制值轴网格线和标签
   */
  private drawValueGrid (
    drawList: ReturnType<typeof ImGui.GetWindowDrawList>,
    lineStartPos: ImGui.Vec2,
    windowWidth: number,
    rowTopY: number,
    valueMin: number,
    valueMax: number,
  ): void {
    const gridColor = ImGui.GetColorU32(COLORS.curveGrid);
    const zeroColor = ImGui.GetColorU32(COLORS.curveGridZero);
    const labelColor = ImGui.GetColorU32(COLORS.curveValueLabel);
    const gridCount = LAYOUT.curveGridLineCount;
    const range = valueMax - valueMin;

    if (range < 1e-6) {
      return;
    }

    for (let i = 0; i <= gridCount; i++) {
      const frac = i / gridCount;
      const value = valueMin + frac * range;
      const y = valueToPixelY(value, rowTopY, valueMin, valueMax);

      const isZeroLine = Math.abs(value) < range * 0.02;
      const lineColor = isZeroLine ? zeroColor : gridColor;

      drawList.AddLine(
        new ImGui.Vec2(lineStartPos.x, y),
        new ImGui.Vec2(lineStartPos.x + windowWidth, y),
        lineColor,
        1
      );

      // 值标签
      const label = this.formatValue(value);
      const textSize = ImGui.CalcTextSize(label);

      drawList.AddText(
        new ImGui.Vec2(lineStartPos.x + 2, y - textSize.y - 1),
        labelColor,
        label
      );
    }
  }

  /**
   * 格式化值标签文本
   */
  private formatValue (value: number): string {
    const abs = Math.abs(value);

    if (abs >= 100) {
      return value.toFixed(0);
    }
    if (abs >= 10) {
      return value.toFixed(1);
    }
    if (abs >= 1) {
      return value.toFixed(2);
    }

    return value.toFixed(3);
  }

  /**
   * 绘制曲线段（贝塞尔/线性/常量）
   */
  private drawCurveSegments (
    drawList: ReturnType<typeof ImGui.GetWindowDrawList>,
    channel: CurveChannelData,
    lineStartX: number,
    rowTopY: number,
    clipStart: number,
    clipDuration: number,
  ): void {
    const state = this.state;
    const { valueMin, valueMax } = channel;
    const channelColorU32 = ImGui.GetColorU32(channel.color);
    const lineWidth = LAYOUT.curveLineWidth;

    for (const seg of channel.segments) {
      const x0 = normalizedTimeToPixelX(seg.startTime, lineStartX, clipStart, clipDuration, state);
      const y0 = valueToPixelY(seg.startValue, rowTopY, valueMin, valueMax);
      const x3 = normalizedTimeToPixelX(seg.endTime, lineStartX, clipStart, clipDuration, state);
      const y3 = valueToPixelY(seg.endValue, rowTopY, valueMin, valueMax);

      if (seg.interpolation === 'bezier') {
        const x1 = normalizedTimeToPixelX(seg.cp1.x, lineStartX, clipStart, clipDuration, state);
        const y1 = valueToPixelY(seg.cp1.y, rowTopY, valueMin, valueMax);
        const x2 = normalizedTimeToPixelX(seg.cp2.x, lineStartX, clipStart, clipDuration, state);
        const y2 = valueToPixelY(seg.cp2.y, rowTopY, valueMin, valueMax);

        drawList.AddBezierCubic(
          new ImGui.Vec2(x0, y0),
          new ImGui.Vec2(x1, y1),
          new ImGui.Vec2(x2, y2),
          new ImGui.Vec2(x3, y3),
          channelColorU32,
          lineWidth
        );
      } else if (seg.interpolation === 'linear') {
        drawList.AddLine(
          new ImGui.Vec2(x0, y0),
          new ImGui.Vec2(x3, y3),
          channelColorU32,
          lineWidth
        );
      } else if (seg.interpolation === 'constant') {
        // 水平保持线
        drawList.AddLine(
          new ImGui.Vec2(x0, y0),
          new ImGui.Vec2(x3, y0),
          channelColorU32,
          lineWidth
        );
        // 垂直跳变虚线
        const dashLen = 3;
        const gapLen = 2;
        const nextY = y3;
        const stepDir = nextY > y0 ? 1 : -1;
        let dy = y0;

        while ((stepDir > 0 && dy < nextY) || (stepDir < 0 && dy > nextY)) {
          const dashEnd = stepDir > 0
            ? Math.min(dy + dashLen, nextY)
            : Math.max(dy - dashLen, nextY);

          drawList.AddLine(
            new ImGui.Vec2(x3, dy),
            new ImGui.Vec2(x3, dashEnd),
            ImGui.GetColorU32(new ImGui.Vec4(channel.color.x, channel.color.y, channel.color.z, 0.4)),
            1
          );
          dy += stepDir * (dashLen + gapLen);
        }
      }
    }
  }

  /**
   * 绘制关键帧圆点、切线控制柄和交互
   */
  private drawKeyframeDots (
    drawList: ReturnType<typeof ImGui.GetWindowDrawList>,
    channel: CurveChannelData,
    trackId: string,
    channelLabel: string,
    lineStartPos: ImGui.Vec2,
    windowWidth: number,
    rowTopY: number,
    clipStart: number,
    clipDuration: number,
  ): void {
    const state = this.state;
    const { valueMin, valueMax, keyframes, segments } = channel;
    const mousePos = ImGui.GetMousePos();
    const dotRadius = LAYOUT.curveKeyDotRadius;
    const frameHeight = LAYOUT.curveRowHeight;

    // 计算所有关键帧屏幕位置
    const kfPositions: { x: number, y: number, kf: KeyframeData, index: number }[] = [];

    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i];
      const sx = normalizedTimeToPixelX(kf.time, lineStartPos.x, clipStart, clipDuration, state);
      const sy = valueToPixelY(kf.value, rowTopY, valueMin, valueMax);

      kfPositions.push({ x: sx, y: sy, kf, index: i });
    }

    // 绘制选中关键帧的切线控制柄
    for (const { x, y, index } of kfPositions) {
      const kfId = getKeyframeId(trackId, channelLabel, index);
      const isSelected = state.selectedKeyframes.has(kfId);

      if (!isSelected) {
        continue;
      }

      // 出切线：当前段的 cp1
      if (index < segments.length) {
        const seg = segments[index];
        const hx = normalizedTimeToPixelX(seg.cp1.x, lineStartPos.x, clipStart, clipDuration, state);
        const hy = valueToPixelY(seg.cp1.y, rowTopY, valueMin, valueMax);

        drawList.AddLine(
          new ImGui.Vec2(x, y),
          new ImGui.Vec2(hx, hy),
          ImGui.GetColorU32(COLORS.curveTangentLine),
          LAYOUT.curveTangentLineWidth
        );
        drawList.AddCircleFilled(
          new ImGui.Vec2(hx, hy),
          LAYOUT.curveTangentHandleRadius,
          ImGui.GetColorU32(COLORS.curveTangentHandle),
          8
        );
      }

      // 入切线：上一段的 cp2
      if (index > 0 && index - 1 < segments.length) {
        const seg = segments[index - 1];
        const hx = normalizedTimeToPixelX(seg.cp2.x, lineStartPos.x, clipStart, clipDuration, state);
        const hy = valueToPixelY(seg.cp2.y, rowTopY, valueMin, valueMax);

        drawList.AddLine(
          new ImGui.Vec2(x, y),
          new ImGui.Vec2(hx, hy),
          ImGui.GetColorU32(COLORS.curveTangentLine),
          LAYOUT.curveTangentLineWidth
        );
        drawList.AddCircleFilled(
          new ImGui.Vec2(hx, hy),
          LAYOUT.curveTangentHandleRadius,
          ImGui.GetColorU32(COLORS.curveTangentHandle),
          8
        );
      }
    }

    // 绘制关键帧圆点
    let hoveredKeyframe: KeyframeData | null = null;
    let hoveredKeyframeIndex = -1;

    for (const { x, y, kf, index } of kfPositions) {
      const isHovered = Math.abs(mousePos.x - x) <= dotRadius + 4
        && Math.abs(mousePos.y - y) <= dotRadius + 4;

      const kfId = getKeyframeId(trackId, channelLabel, index);
      const isSelected = state.selectedKeyframes.has(kfId);

      const radius = isSelected ? dotRadius + 2 : (isHovered ? dotRadius + 1 : dotRadius);

      if (isSelected) {
        // 选中：使用选择色外圈 + 白色填充
        drawList.AddCircleFilled(
          new ImGui.Vec2(x, y),
          radius + 1,
          ImGui.GetColorU32(COLORS.selection),
          12
        );
        drawList.AddCircleFilled(
          new ImGui.Vec2(x, y),
          radius,
          ImGui.GetColorU32(new ImGui.Vec4(1.0, 1.0, 1.0, 1.0)),
          12
        );
      } else {
        // 普通/悬浮：使用通道颜色
        const fillColor = isHovered
          ? new ImGui.Vec4(1.0, 1.0, 1.0, 1.0)
          : channel.color;

        drawList.AddCircleFilled(
          new ImGui.Vec2(x, y),
          radius,
          ImGui.GetColorU32(fillColor),
          12
        );
      }

      if (isHovered) {
        hoveredKeyframe = kf;
        hoveredKeyframeIndex = index;
      }
    }

    // 交互区域
    ImGui.SetCursorScreenPos(lineStartPos);
    ImGui.PushID(`curve_${channelLabel}_${state.trackRowCounter}`);

    if (ImGui.InvisibleButton('curve_interact', new ImGui.Vec2(windowWidth, frameHeight))) {
      if (hoveredKeyframe && hoveredKeyframeIndex >= 0) {
        toggleKeyframeSelection(
          state,
          getKeyframeId(trackId, channelLabel, hoveredKeyframeIndex),
          ImGui.GetIO().KeyCtrl
        );
        state.selectedKeyframeInfo = {
          trackId,
          channel: channelLabel,
          index: hoveredKeyframeIndex,
          data: hoveredKeyframe,
          clipStart,
          clipDuration,
        };
        state.selectedClip = null;
      } else {
        clearKeyframeSelection(state);
        state.selectedKeyframeInfo = null;
      }
    }

    // 悬浮 tooltip
    if (hoveredKeyframe) {
      ImGui.BeginTooltip();
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, channel.color);
      ImGui.Text(channelLabel);
      ImGui.PopStyleColor();
      ImGui.Separator();
      const absTime = clipStart + hoveredKeyframe.time * clipDuration;

      ImGui.Text(`Time: ${absTime.toFixed(3)}s (normalized: ${hoveredKeyframe.time.toFixed(3)})`);
      ImGui.Text(`Value: ${hoveredKeyframe.value.toFixed(4)}`);
      ImGui.EndTooltip();
    }

    ImGui.PopID();
  }

  /**
   * 画布模式主入口：在右侧面板整体区域绘制所有可见曲线
   */
  drawCurveCanvas (channels: CurveCanvasChannel[], canvasHeight: number): void {
    const state = this.state;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const windowWidth = ImGui.GetContentRegionAvail().x;

    if (channels.length === 0) {
      // 无曲线时显示提示
      const hint = 'Select a track to display curves';
      const textSize = ImGui.CalcTextSize(hint);

      drawList.AddRectFilled(
        lineStartPos,
        new ImGui.Vec2(lineStartPos.x + windowWidth, lineStartPos.y + canvasHeight),
        ImGui.GetColorU32(COLORS.curveCanvasBg)
      );
      drawList.AddText(
        new ImGui.Vec2(
          lineStartPos.x + (windowWidth - textSize.x) / 2,
          lineStartPos.y + (canvasHeight - textSize.y) / 2
        ),
        ImGui.GetColorU32(COLORS.curveValueLabel),
        hint
      );
      ImGui.Dummy(new ImGui.Vec2(windowWidth, canvasHeight));

      return;
    }

    // 计算共享值域
    let valueMin = Infinity;
    let valueMax = -Infinity;

    for (const ch of channels) {
      valueMin = Math.min(valueMin, ch.channelData.valueMin);
      valueMax = Math.max(valueMax, ch.channelData.valueMax);
    }

    if (!isFinite(valueMin) || !isFinite(valueMax) || valueMax - valueMin < 1e-6) {
      valueMin = -1;
      valueMax = 1;
    }

    state.curveCanvasValueMin = valueMin;
    state.curveCanvasValueMax = valueMax;

    const canvasTopY = lineStartPos.y;

    // 背景
    drawList.AddRectFilled(
      lineStartPos,
      new ImGui.Vec2(lineStartPos.x + windowWidth, canvasTopY + canvasHeight),
      ImGui.GetColorU32(COLORS.curveCanvasBg)
    );

    // 值轴网格
    this.drawCanvasValueGrid(drawList, lineStartPos, windowWidth, canvasHeight, valueMin, valueMax);

    // 绘制所有通道的曲线段
    for (const ch of channels) {
      this.drawCanvasCurveSegments(
        drawList, ch.channelData, lineStartPos.x, canvasTopY, canvasHeight,
        ch.clipStart, ch.clipDuration, valueMin, valueMax
      );
    }

    // 绘制所有通道的关键帧圆点
    let hoveredKf: { channel: CurveCanvasChannel, kf: KeyframeData, index: number } | null = null;

    for (const ch of channels) {
      const hovered = this.drawCanvasKeyframeDots(
        drawList, ch, lineStartPos, windowWidth, canvasTopY, canvasHeight, valueMin, valueMax
      );

      if (hovered) {
        hoveredKf = hovered;
      }
    }

    // 交互区域
    ImGui.SetCursorScreenPos(lineStartPos);
    ImGui.PushID('curve_canvas');

    if (ImGui.InvisibleButton('canvas_interact', new ImGui.Vec2(windowWidth, canvasHeight))) {
      if (hoveredKf) {
        const kfId = getKeyframeId(hoveredKf.channel.trackId, `${hoveredKf.channel.groupName}.${hoveredKf.channel.channelLabel}`, hoveredKf.index);

        toggleKeyframeSelection(state, kfId, ImGui.GetIO().KeyCtrl);
        state.selectedKeyframeInfo = {
          trackId: hoveredKf.channel.trackId,
          channel: `${hoveredKf.channel.groupName}.${hoveredKf.channel.channelLabel}`,
          index: hoveredKf.index,
          data: hoveredKf.kf,
          clipStart: hoveredKf.channel.clipStart,
          clipDuration: hoveredKf.channel.clipDuration,
        };
        state.selectedClip = null;
      } else {
        clearKeyframeSelection(state);
        state.selectedKeyframeInfo = null;
      }
    }

    // 悬浮 tooltip
    if (hoveredKf) {
      const ch = hoveredKf.channel;
      const kf = hoveredKf.kf;
      const absTime = ch.clipStart + kf.time * ch.clipDuration;

      ImGui.BeginTooltip();
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, ch.channelData.color);
      ImGui.Text(`${ch.groupName}.${ch.channelLabel}`);
      ImGui.PopStyleColor();
      ImGui.Separator();
      ImGui.Text(`Time: ${absTime.toFixed(3)}s`);
      ImGui.Text(`Value: ${kf.value.toFixed(4)}`);
      ImGui.EndTooltip();
    }

    ImGui.PopID();
  }

  /**
   * 画布值轴网格线和标签
   */
  private drawCanvasValueGrid (
    drawList: ReturnType<typeof ImGui.GetWindowDrawList>,
    lineStartPos: ImGui.Vec2,
    windowWidth: number,
    canvasHeight: number,
    valueMin: number,
    valueMax: number,
  ): void {
    const gridColor = ImGui.GetColorU32(COLORS.curveGrid);
    const zeroColor = ImGui.GetColorU32(COLORS.curveGridZero);
    const labelColor = ImGui.GetColorU32(COLORS.curveValueLabel);
    const gridCount = LAYOUT.curveGridLineCount;
    const range = valueMax - valueMin;

    if (range < 1e-6) {
      return;
    }

    for (let i = 0; i <= gridCount; i++) {
      const frac = i / gridCount;
      const value = valueMin + frac * range;
      const y = canvasValueToPixelY(value, lineStartPos.y, canvasHeight, valueMin, valueMax);

      const isZeroLine = Math.abs(value) < range * 0.02;
      const lineColor = isZeroLine ? zeroColor : gridColor;

      drawList.AddLine(
        new ImGui.Vec2(lineStartPos.x, y),
        new ImGui.Vec2(lineStartPos.x + windowWidth, y),
        lineColor,
        1
      );

      const label = this.formatCanvasValue(value);
      const textSize = ImGui.CalcTextSize(label);

      drawList.AddText(
        new ImGui.Vec2(lineStartPos.x + 2, y - textSize.y - 1),
        labelColor,
        label
      );
    }
  }

  /**
   * 绘制单通道曲线段（画布模式）
   */
  private drawCanvasCurveSegments (
    drawList: ReturnType<typeof ImGui.GetWindowDrawList>,
    channel: CurveChannelData,
    lineStartX: number,
    canvasTopY: number,
    canvasHeight: number,
    clipStart: number,
    clipDuration: number,
    valueMin: number,
    valueMax: number,
  ): void {
    const state = this.state;
    const channelColorU32 = ImGui.GetColorU32(channel.color);
    const lineWidth = LAYOUT.curveLineWidth;

    for (const seg of channel.segments) {
      const x0 = normalizedTimeToPixelX(seg.startTime, lineStartX, clipStart, clipDuration, state);
      const y0 = canvasValueToPixelY(seg.startValue, canvasTopY, canvasHeight, valueMin, valueMax);
      const x3 = normalizedTimeToPixelX(seg.endTime, lineStartX, clipStart, clipDuration, state);
      const y3 = canvasValueToPixelY(seg.endValue, canvasTopY, canvasHeight, valueMin, valueMax);

      if (seg.interpolation === 'bezier') {
        const x1 = normalizedTimeToPixelX(seg.cp1.x, lineStartX, clipStart, clipDuration, state);
        const y1 = canvasValueToPixelY(seg.cp1.y, canvasTopY, canvasHeight, valueMin, valueMax);
        const x2 = normalizedTimeToPixelX(seg.cp2.x, lineStartX, clipStart, clipDuration, state);
        const y2 = canvasValueToPixelY(seg.cp2.y, canvasTopY, canvasHeight, valueMin, valueMax);

        drawList.AddBezierCubic(
          new ImGui.Vec2(x0, y0),
          new ImGui.Vec2(x1, y1),
          new ImGui.Vec2(x2, y2),
          new ImGui.Vec2(x3, y3),
          channelColorU32,
          lineWidth
        );
      } else if (seg.interpolation === 'linear') {
        drawList.AddLine(
          new ImGui.Vec2(x0, y0),
          new ImGui.Vec2(x3, y3),
          channelColorU32,
          lineWidth
        );
      } else if (seg.interpolation === 'constant') {
        drawList.AddLine(
          new ImGui.Vec2(x0, y0),
          new ImGui.Vec2(x3, y0),
          channelColorU32,
          lineWidth
        );
        // 垂直跳变虚线
        const dashLen = 3;
        const gapLen = 2;
        const nextY = y3;
        const stepDir = nextY > y0 ? 1 : -1;
        let dy = y0;

        while ((stepDir > 0 && dy < nextY) || (stepDir < 0 && dy > nextY)) {
          const dashEnd = stepDir > 0
            ? Math.min(dy + dashLen, nextY)
            : Math.max(dy - dashLen, nextY);

          drawList.AddLine(
            new ImGui.Vec2(x3, dy),
            new ImGui.Vec2(x3, dashEnd),
            ImGui.GetColorU32(new ImGui.Vec4(channel.color.x, channel.color.y, channel.color.z, 0.4)),
            1
          );
          dy += stepDir * (dashLen + gapLen);
        }
      }
    }
  }

  /**
   * 绘制关键帧圆点（画布模式），返回悬浮的关键帧信息
   */
  private drawCanvasKeyframeDots (
    drawList: ReturnType<typeof ImGui.GetWindowDrawList>,
    canvasChannel: CurveCanvasChannel,
    lineStartPos: ImGui.Vec2,
    windowWidth: number,
    canvasTopY: number,
    canvasHeight: number,
    valueMin: number,
    valueMax: number,
  ): { channel: CurveCanvasChannel, kf: KeyframeData, index: number } | null {
    const state = this.state;
    const channel = canvasChannel.channelData;
    const { keyframes, segments } = channel;
    const mousePos = ImGui.GetMousePos();
    const dotRadius = LAYOUT.curveKeyDotRadius;
    const trackId = canvasChannel.trackId;
    const channelLabel = `${canvasChannel.groupName}.${canvasChannel.channelLabel}`;

    let hoveredResult: { channel: CurveCanvasChannel, kf: KeyframeData, index: number } | null = null;

    // 计算所有关键帧屏幕位置
    const kfPositions: { x: number, y: number, kf: KeyframeData, index: number }[] = [];

    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i];
      const sx = normalizedTimeToPixelX(kf.time, lineStartPos.x, canvasChannel.clipStart, canvasChannel.clipDuration, state);
      const sy = canvasValueToPixelY(kf.value, canvasTopY, canvasHeight, valueMin, valueMax);

      kfPositions.push({ x: sx, y: sy, kf, index: i });
    }

    // 绘制选中关键帧的切线控制柄
    for (const { x, y, index } of kfPositions) {
      const kfId = getKeyframeId(trackId, channelLabel, index);

      if (!state.selectedKeyframes.has(kfId)) {
        continue;
      }

      if (index < segments.length) {
        const seg = segments[index];
        const hx = normalizedTimeToPixelX(seg.cp1.x, lineStartPos.x, canvasChannel.clipStart, canvasChannel.clipDuration, state);
        const hy = canvasValueToPixelY(seg.cp1.y, canvasTopY, canvasHeight, valueMin, valueMax);

        drawList.AddLine(new ImGui.Vec2(x, y), new ImGui.Vec2(hx, hy), ImGui.GetColorU32(COLORS.curveTangentLine), LAYOUT.curveTangentLineWidth);
        drawList.AddCircleFilled(new ImGui.Vec2(hx, hy), LAYOUT.curveTangentHandleRadius, ImGui.GetColorU32(COLORS.curveTangentHandle), 8);
      }

      if (index > 0 && index - 1 < segments.length) {
        const seg = segments[index - 1];
        const hx = normalizedTimeToPixelX(seg.cp2.x, lineStartPos.x, canvasChannel.clipStart, canvasChannel.clipDuration, state);
        const hy = canvasValueToPixelY(seg.cp2.y, canvasTopY, canvasHeight, valueMin, valueMax);

        drawList.AddLine(new ImGui.Vec2(x, y), new ImGui.Vec2(hx, hy), ImGui.GetColorU32(COLORS.curveTangentLine), LAYOUT.curveTangentLineWidth);
        drawList.AddCircleFilled(new ImGui.Vec2(hx, hy), LAYOUT.curveTangentHandleRadius, ImGui.GetColorU32(COLORS.curveTangentHandle), 8);
      }
    }

    // 绘制关键帧圆点
    for (const { x, y, kf, index } of kfPositions) {
      const isHovered = Math.abs(mousePos.x - x) <= dotRadius + 4
        && Math.abs(mousePos.y - y) <= dotRadius + 4;

      const kfId = getKeyframeId(trackId, channelLabel, index);
      const isSelected = state.selectedKeyframes.has(kfId);
      const radius = isSelected ? dotRadius + 2 : (isHovered ? dotRadius + 1 : dotRadius);

      if (isSelected) {
        drawList.AddCircleFilled(new ImGui.Vec2(x, y), radius + 1, ImGui.GetColorU32(COLORS.selection), 12);
        drawList.AddCircleFilled(new ImGui.Vec2(x, y), radius, ImGui.GetColorU32(new ImGui.Vec4(1.0, 1.0, 1.0, 1.0)), 12);
      } else {
        const fillColor = isHovered ? new ImGui.Vec4(1.0, 1.0, 1.0, 1.0) : channel.color;

        drawList.AddCircleFilled(new ImGui.Vec2(x, y), radius, ImGui.GetColorU32(fillColor), 12);
      }

      if (isHovered) {
        hoveredResult = { channel: canvasChannel, kf, index };
      }
    }

    return hoveredResult;
  }

  private formatCanvasValue (value: number): string {
    const abs = Math.abs(value);

    if (abs >= 100) {
      return value.toFixed(0);
    }
    if (abs >= 10) {
      return value.toFixed(1);
    }
    if (abs >= 1) {
      return value.toFixed(2);
    }

    return value.toFixed(3);
  }
}
