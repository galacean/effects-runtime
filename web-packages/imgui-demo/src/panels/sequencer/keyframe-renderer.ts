import { ImGui } from '../../imgui';
import { COLORS, LAYOUT } from './theme';
import type { SequencerState } from './sequencer-state';
import type { KeyframeData, TransformPropertyChannel } from './types';
import { getKeyframeId, toggleKeyframeSelection, clearKeyframeSelection } from './selection';
import { timeToPixel } from './timeline-utils';

export class KeyframeRenderer {
  constructor (private readonly state: SequencerState) {}

  /**
   * 绘制属性分组标题行（右侧面板）— 无关键帧，只有背景
   */
  drawPropertyGroupKeyframes (groupName: string): void {
    const state = this.state;
    const frameHeight = LAYOUT.channelHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const rowIndex = state.trackRowCounter++;
    const windowWidth = ImGui.GetContentRegionAvail().x;

    const groupBgColor = (rowIndex % 2 === 0)
      ? new ImGui.Vec4(0.10, 0.10, 0.11, 1.0)
      : new ImGui.Vec4(0.11, 0.11, 0.12, 1.0);

    drawList.AddRectFilled(
      lineStartPos,
      new ImGui.Vec2(lineStartPos.x + windowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(groupBgColor)
    );

    drawList.AddLine(
      new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight),
      new ImGui.Vec2(lineStartPos.x + windowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(COLORS.trackRowDivider),
      1
    );

    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight));
  }

  /**
   * 绘制属性子通道的关键帧（右侧面板）
   */
  drawPropertyChannelKeyframes (channel: TransformPropertyChannel, trackId: string, groupName: string, clipStart: number, clipDuration: number): void {
    const state = this.state;
    const frameHeight = LAYOUT.channelHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const rowIndex = state.trackRowCounter++;
    const windowWidth = ImGui.GetContentRegionAvail().x;

    // 背景
    const propertyBgColor = (rowIndex % 2 === 0)
      ? new ImGui.Vec4(0.08, 0.08, 0.09, 1.0)
      : new ImGui.Vec4(0.09, 0.09, 0.10, 1.0);

    drawList.AddRectFilled(
      lineStartPos,
      new ImGui.Vec2(lineStartPos.x + windowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(propertyBgColor)
    );

    drawList.AddLine(
      new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight),
      new ImGui.Vec2(lineStartPos.x + windowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(COLORS.trackRowDivider),
      1
    );

    const centerY = lineStartPos.y + frameHeight / 2;
    const mousePos = ImGui.GetMousePos();
    const diamondSize = LAYOUT.keySize;

    // 计算所有关键帧位置
    const keyframePositions: { x: number, kf: KeyframeData, index: number }[] = [];

    for (let kfIndex = 0; kfIndex < channel.keyframes.length; kfIndex++) {
      const keyframe = channel.keyframes[kfIndex];
      const absoluteTime = clipStart + keyframe.time * clipDuration;
      const pixelX = lineStartPos.x + LAYOUT.clipsAreaLeftPadding + timeToPixel(absoluteTime, state);

      keyframePositions.push({ x: pixelX, kf: keyframe, index: kfIndex });
    }

    // 重叠检测
    const overlapSet = new Set<number>();

    for (let i = 0; i < keyframePositions.length; i++) {
      for (let j = i + 1; j < keyframePositions.length; j++) {
        if (Math.abs(keyframePositions[i].x - keyframePositions[j].x) <= LAYOUT.keyOverlapThresholdPx) {
          overlapSet.add(keyframePositions[i].index);
          overlapSet.add(keyframePositions[j].index);
        }
      }
    }

    // KeyBar（使用分量颜色 + 首尾渐变）
    if (keyframePositions.length > 1) {
      const keyBarColor = channel.color;
      const keyBarHeight = 2;
      const keyBarHalfHeight = keyBarHeight / 2;

      for (let i = 0; i < keyframePositions.length - 1; i++) {
        const startX = keyframePositions[i].x;
        const endX = keyframePositions[i + 1].x;
        const barLength = endX - startX;

        if (barLength < 1) {
          continue;
        }

        const fadeLength = Math.min(8, barLength * 0.25);
        const fadedColorU32 = ImGui.GetColorU32(new ImGui.Vec4(keyBarColor.x, keyBarColor.y, keyBarColor.z, 0.25));
        const fullColorU32 = ImGui.GetColorU32(new ImGui.Vec4(keyBarColor.x, keyBarColor.y, keyBarColor.z, 1.0));
        const barTop = centerY - keyBarHalfHeight;
        const barBottom = centerY + keyBarHalfHeight;

        if (barLength <= fadeLength * 2) {
          const midAlpha = Math.max(0.25, barLength / (fadeLength * 2));
          const midColorU32 = ImGui.GetColorU32(new ImGui.Vec4(keyBarColor.x, keyBarColor.y, keyBarColor.z, midAlpha));

          drawList.AddRectFilled(
            new ImGui.Vec2(startX, barTop),
            new ImGui.Vec2(endX, barBottom),
            midColorU32
          );
        } else {
          drawList.AddRectFilledMultiColor(
            new ImGui.Vec2(startX, barTop),
            new ImGui.Vec2(startX + fadeLength, barBottom),
            fadedColorU32, fullColorU32, fullColorU32, fadedColorU32
          );

          drawList.AddRectFilled(
            new ImGui.Vec2(startX + fadeLength, barTop),
            new ImGui.Vec2(endX - fadeLength, barBottom),
            fullColorU32
          );

          drawList.AddRectFilledMultiColor(
            new ImGui.Vec2(endX - fadeLength, barTop),
            new ImGui.Vec2(endX, barBottom),
            fullColorU32, fadedColorU32, fadedColorU32, fullColorU32
          );
        }
      }
    }

    // 绘制关键帧菱形并检测悬浮
    let hoveredKeyframe: KeyframeData | null = null;
    let hoveredKeyframeIndex = -1;
    const channelLabel = `${groupName}.${channel.label}`;

    for (const { x: pixelX, kf: keyframe, index: kfIndex } of keyframePositions) {
      const isHovered = Math.abs(mousePos.x - pixelX) <= diamondSize + 4
        && Math.abs(mousePos.y - centerY) <= diamondSize + 4;

      const keyframeId = getKeyframeId(trackId, channelLabel, kfIndex);
      const isSelected = state.selectedKeyframes.has(keyframeId);
      const isOverlapping = overlapSet.has(kfIndex);

      this.drawKeyframeDiamond(drawList, pixelX, centerY, diamondSize, isHovered, isSelected, isOverlapping);

      if (isHovered) {
        hoveredKeyframe = keyframe;
        hoveredKeyframeIndex = kfIndex;
      }
    }

    // 交互区域
    ImGui.SetCursorScreenPos(lineStartPos);
    ImGui.PushID(`prop_kf_${channelLabel}_${rowIndex}`);

    if (ImGui.InvisibleButton('prop_kf', new ImGui.Vec2(windowWidth, frameHeight))) {
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

    // 悬浮tooltip
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

    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight));
  }

  /**
   * 绘制关键帧菱形标记
   */
  drawKeyframeDiamond (
    drawList: any,
    centerX: number,
    centerY: number,
    size: number = 6,
    isHovered: boolean = false,
    isSelected: boolean = false,
    isOverlapping: boolean = false,
  ): void {
    const borderWidth = LAYOUT.keyBorderWidth;
    const actualSize = isSelected ? size + 2 : (isHovered ? size + 1 : size);

    let borderTint: ImGui.Vec4;
    let fillTint: ImGui.Vec4 = new ImGui.Vec4(1.0, 1.0, 1.0, 1.0);

    if (isSelected) {
      borderTint = COLORS.selection;
    } else if (isOverlapping) {
      borderTint = COLORS.keyOverlapBorder;
    } else if (isHovered) {
      borderTint = new ImGui.Vec4(1.0, 1.0, 1.0, 1.0);
      fillTint = new ImGui.Vec4(1.0, 1.0, 1.0, 1.0);
    } else {
      borderTint = COLORS.keyBorder;
    }

    // 边框菱形（外层）
    const outerTop = new ImGui.Vec2(centerX, centerY - actualSize);
    const outerRight = new ImGui.Vec2(centerX + actualSize, centerY);
    const outerBottom = new ImGui.Vec2(centerX, centerY + actualSize);
    const outerLeft = new ImGui.Vec2(centerX - actualSize, centerY);

    drawList.AddQuadFilled(outerTop, outerRight, outerBottom, outerLeft, ImGui.GetColorU32(borderTint));

    // 填充菱形（内层）
    const innerSize = actualSize - borderWidth;

    const innerTop = new ImGui.Vec2(centerX, centerY - innerSize);
    const innerRight = new ImGui.Vec2(centerX + innerSize, centerY);
    const innerBottom = new ImGui.Vec2(centerX, centerY + innerSize);
    const innerLeft = new ImGui.Vec2(centerX - innerSize, centerY);

    drawList.AddQuadFilled(innerTop, innerRight, innerBottom, innerLeft, ImGui.GetColorU32(fillTint));
  }

  /**
   * 绘制时间游标线，贯通给定 Y 轴区域
   */
  drawTimeCursorLine (startY: number, endY: number): void {
    const drawList = ImGui.GetWindowDrawList();

    // 为了防止被后续的轨道的 background 等内容盖住，我们需要推迟或者置顶
    // 我们在这里使用原生的 windowDrawList 画出游标
    // 原来被 clip 盖住是因为 drawTimeCursorLine 在轨道绘制之后但在 ImGui 的 channel 或其它什么逻辑下，
    // 获取 ForegroundDrawList：
    const fgDrawList = ImGui.GetForegroundDrawList ? ImGui.GetForegroundDrawList() : drawList;

    fgDrawList.AddLine(
      new ImGui.Vec2(this.state.timeCursorPositionX, startY),
      new ImGui.Vec2(this.state.timeCursorPositionX, endY),
      ImGui.GetColorU32(COLORS.cursor),
      1
    );
  }
}
