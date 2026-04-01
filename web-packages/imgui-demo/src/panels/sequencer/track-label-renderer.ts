import type { TrackAsset } from '@galacean/effects';
import { ActivationTrack, Component, ParticleTrack, SpriteColorTrack, SubCompositionTrack, TransformTrack, VFXItem } from '@galacean/effects';
import { ImGui } from '../../imgui';
import { COLORS, LAYOUT } from './theme';
import type { SequencerState } from './sequencer-state';
import { selectTrack, isTrackSelected, isTrackExpanded, toggleTrackExpansion } from './selection';
import { getTrackColor } from './timeline-utils';
import { getTransformPropertyGroups } from './data-extraction';

export class TrackLabelRenderer {
  constructor (private readonly state: SequencerState) {}

  /**
   * 绘制轨道标签(左侧窗口)
   */
  drawTrackLabel (trackAsset: TrackAsset, trackName: string, sceneBindings: any[], depth: number): void {
    const state = this.state;
    const isTransformTrack = trackAsset instanceof TransformTrack;
    const hasKeyframeData = isTransformTrack && getTransformPropertyGroups(trackAsset).length > 0;
    const hasChildren = trackAsset.getChildTracks().length > 0 || hasKeyframeData;
    const frameHeight = LAYOUT.sectionHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const rowIndex = state.trackRowCounter++;
    const isSelected = isTrackSelected(state, trackAsset);
    const windowWidth = ImGui.GetContentRegionAvail().x;

    // 检测悬浮状态
    const currentMousePos = ImGui.GetMousePos();
    const isRowHovered = currentMousePos.x >= lineStartPos.x && currentMousePos.x <= lineStartPos.x + windowWidth
      && currentMousePos.y >= lineStartPos.y && currentMousePos.y <= lineStartPos.y + frameHeight;

    // === 背景渲染 ===
    const labelBaseColor = (rowIndex % 2 === 0) ? COLORS.trackLabelBg : COLORS.trackLabelBgAlt;

    // 现代圆角块状布局
    const marginX = 0;
    const marginY = 0;
    const bgStart = new ImGui.Vec2(lineStartPos.x + marginX, lineStartPos.y + marginY);
    const bgEnd = new ImGui.Vec2(lineStartPos.x + windowWidth - marginX, lineStartPos.y + frameHeight - marginY);

    drawList.AddRectFilled(
      bgStart,
      bgEnd,
      ImGui.GetColorU32(labelBaseColor),
      LAYOUT.sectionCornerRadius // 圆角
    );

    // 轨道颜色条（depth=0 的顶层轨道左侧 3px 颜色条）
    if (depth === 0) {
      const trackColor = getTrackColor(trackAsset, state);
      const colorStripWidth = 3;

      drawList.AddRectFilled(
        new ImGui.Vec2(bgStart.x, bgStart.y),
        new ImGui.Vec2(bgStart.x + colorStripWidth, bgEnd.y),
        ImGui.GetColorU32(trackColor),
        LAYOUT.sectionCornerRadius
      );
    }

    // 选中层
    if (isSelected) {
      const selectionOverlay = new ImGui.Vec4(
        COLORS.selection.x,
        COLORS.selection.y,
        COLORS.selection.z,
        0.25,
      );

      drawList.AddRectFilled(
        bgStart,
        bgEnd,
        ImGui.GetColorU32(selectionOverlay),
        LAYOUT.sectionCornerRadius
      );

      const outlineColor = new ImGui.Vec4(COLORS.selection.x, COLORS.selection.y, COLORS.selection.z, 0.8);

      drawList.AddRect(
        new ImGui.Vec2(bgStart.x + 1, bgStart.y + 1),
        new ImGui.Vec2(bgEnd.x - 1, bgEnd.y - 1),
        ImGui.GetColorU32(outlineColor),
        LAYOUT.sectionCornerRadius,
        0,
        1.5
      );
    }

    // 悬浮层
    if (isRowHovered && !isSelected) {
      const hoverOverlay = new ImGui.Vec4(1.0, 1.0, 1.0, 0.04);

      drawList.AddRectFilled(
        bgStart,
        bgEnd,
        ImGui.GetColorU32(hoverOverlay),
        LAYOUT.sectionCornerRadius
      );
    }

    // 选中指示条
    if (isSelected) {
      const indicatorWidth = 3;

      drawList.AddRectFilled(
        new ImGui.Vec2(bgStart.x, bgStart.y),
        new ImGui.Vec2(bgStart.x + indicatorWidth, bgEnd.y),
        ImGui.GetColorU32(COLORS.selection),
        LAYOUT.sectionCornerRadius
      );
    }

    const indentOffset = depth * LAYOUT.trackIndentWidth;
    const iconSize = LAYOUT.expanderIconSize;
    let textStartX = lineStartPos.x + LAYOUT.trackLabelPadding + indentOffset;

    const textColor = isSelected ? COLORS.trackTextSelected : COLORS.trackText;
    const textColorU32 = ImGui.GetColorU32(textColor);

    // 绘制折叠箭头（仅有子项时）
    if (hasChildren) {
      const iconCenter = new ImGui.Vec2(textStartX + iconSize / 2, lineStartPos.y + frameHeight / 2);
      const isIconHovered = currentMousePos.x >= iconCenter.x - iconSize && currentMousePos.x <= iconCenter.x + iconSize
        && currentMousePos.y >= iconCenter.y - iconSize && currentMousePos.y <= iconCenter.y + iconSize;

      this.drawExpanderIcon(drawList, iconCenter, iconSize, isTrackExpanded(state, trackAsset), textColorU32, isIconHovered);
    }
    textStartX += iconSize + 4;

    // 绘制轨道类型图标
    this.drawTrackTypeIcon(drawList, trackAsset, textStartX, lineStartPos.y, frameHeight, depth);
    textStartX += 14;

    // 绘制文本
    const textSize = ImGui.CalcTextSize(trackName);
    const textPosY = lineStartPos.y + (frameHeight - textSize.y) / 2;

    drawList.AddText(
      new ImGui.Vec2(textStartX, textPosY),
      textColorU32,
      trackName
    );

    // 创建交互区域
    ImGui.SetCursorScreenPos(lineStartPos);
    ImGui.PushID(`track_label_${trackAsset.getInstanceId()}`);

    if (ImGui.InvisibleButton('label', new ImGui.Vec2(windowWidth, frameHeight))) {
      const mousePos = ImGui.GetMousePos();
      const iconLeft = lineStartPos.x + LAYOUT.trackLabelPadding + indentOffset;
      const iconRight = iconLeft + iconSize;
      const iconTop = lineStartPos.y + (frameHeight - iconSize) / 2;
      const iconBottom = iconTop + iconSize;
      const clickedIcon = hasChildren && mousePos.x >= iconLeft - 3 && mousePos.x <= iconRight + 3 && mousePos.y >= iconTop - 3 && mousePos.y <= iconBottom + 3;

      if (clickedIcon) {
        toggleTrackExpansion(state, trackAsset);
      }

      selectTrack(state, trackAsset);
    }

    if (hasChildren && ImGui.IsItemHovered() && ImGui.IsMouseDoubleClicked(0)) {
      toggleTrackExpansion(state, trackAsset);
    }

    ImGui.PopID();

    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight + state.trackRowSpacing));

    // 递归绘制子轨道
    if (hasChildren && isTrackExpanded(state, trackAsset)) {
      for (const child of trackAsset.getChildTracks()) {
        if (child instanceof ActivationTrack) {
          continue;
        }

        let childBoundObject: object | null = null;

        for (const sceneBinding of sceneBindings) {
          if (sceneBinding.key.getInstanceId() === child.getInstanceId()) {
            childBoundObject = sceneBinding.value;

            break;
          }
        }

        let childTrackName = child.constructor.name;

        if (childBoundObject instanceof VFXItem) {
          childTrackName = childBoundObject.name || 'VFX Item';
        } else if (childBoundObject instanceof Component) {
          childTrackName = childBoundObject.constructor.name;
        }

        this.drawTrackLabel(child, childTrackName, sceneBindings, depth + 1);
      }
    }

    // TransformTrack 展开时，显示属性分组
    if (isTrackExpanded(state, trackAsset) && trackAsset instanceof TransformTrack) {
      const trackId = trackAsset.getInstanceId().toString();
      const propertyGroups = getTransformPropertyGroups(trackAsset);

      for (const group of propertyGroups) {
        const groupId = `${trackId}_${group.name}`;
        const groupHasChildren = group.channels.length > 0;
        const isExpanded = groupHasChildren && state.expandedPropertyGroups.has(groupId);

        this.drawPropertyGroupLabel(groupId, group.name, depth + 1, groupHasChildren);

        if (isExpanded) {
          for (const channel of group.channels) {
            this.drawPropertyLabel(channel.label, depth + 2, channel.color);
          }
        }
      }
    }
  }

  /**
   * 绘制属性分组标题行
   */
  drawPropertyGroupLabel (groupId: string, groupName: string, depth: number, hasChildren: boolean): void {
    const state = this.state;
    const frameHeight = LAYOUT.channelHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const rowIndex = state.trackRowCounter++;
    const windowWidth = ImGui.GetContentRegionAvail().x;

    const groupBgColor = (rowIndex % 2 === 0)
      ? new ImGui.Vec4(0.10, 0.10, 0.10, 1.0)
      : new ImGui.Vec4(0.11, 0.11, 0.11, 1.0);

    const marginX = 0;
    const marginY = 0;
    const bgStart = new ImGui.Vec2(lineStartPos.x + marginX, lineStartPos.y + marginY);
    const bgEnd = new ImGui.Vec2(lineStartPos.x + windowWidth - marginX, lineStartPos.y + frameHeight - marginY);

    drawList.AddRectFilled(
      bgStart,
      bgEnd,
      ImGui.GetColorU32(groupBgColor),
      LAYOUT.sectionCornerRadius
    );

    const indentOffset = depth * LAYOUT.trackIndentWidth;
    let textStartX = lineStartPos.x + LAYOUT.trackLabelPadding + indentOffset;

    const isExpanded = hasChildren && state.expandedPropertyGroups.has(groupId);
    const iconSize = LAYOUT.expanderIconSize;

    if (hasChildren) {
      const iconCenter = new ImGui.Vec2(textStartX + iconSize / 2, lineStartPos.y + frameHeight / 2);

      this.drawExpanderIcon(drawList, iconCenter, iconSize, isExpanded, ImGui.GetColorU32(new ImGui.Vec4(0.7, 0.7, 0.7, 1.0)), false);
      textStartX += iconSize + 4;
    } else {
      textStartX += iconSize + 4;
    }

    const textSize = ImGui.CalcTextSize(groupName);
    const textPosY = lineStartPos.y + (frameHeight - textSize.y) / 2;

    drawList.AddText(
      new ImGui.Vec2(textStartX, textPosY),
      ImGui.GetColorU32(new ImGui.Vec4(0.85, 0.85, 0.85, 1.0)),
      groupName
    );

    ImGui.SetCursorScreenPos(lineStartPos);
    ImGui.PushID(groupId);

    if (hasChildren && ImGui.InvisibleButton('group', new ImGui.Vec2(windowWidth, frameHeight))) {
      if (state.expandedPropertyGroups.has(groupId)) {
        state.expandedPropertyGroups.delete(groupId);
      } else {
        state.expandedPropertyGroups.add(groupId);
      }
    } else if (!hasChildren) {
      ImGui.Dummy(new ImGui.Vec2(windowWidth, frameHeight));
    }

    ImGui.PopID();

    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight));
  }

  /**
   * 绘制属性子行标签
   */
  drawPropertyLabel (label: string, depth: number, color?: ImGui.Vec4): void {
    const state = this.state;
    const frameHeight = LAYOUT.channelHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();
    const rowIndex = state.trackRowCounter++;
    const windowWidth = ImGui.GetContentRegionAvail().x;

    const propertyBgColor = (rowIndex % 2 === 0)
      ? new ImGui.Vec4(0.08, 0.08, 0.08, 1.0)
      : new ImGui.Vec4(0.09, 0.09, 0.09, 1.0);

    const marginX = 0;
    const marginY = 0;
    const bgStart = new ImGui.Vec2(lineStartPos.x + marginX, lineStartPos.y + marginY);
    const bgEnd = new ImGui.Vec2(lineStartPos.x + windowWidth - marginX, lineStartPos.y + frameHeight - marginY);

    drawList.AddRectFilled(
      bgStart,
      bgEnd,
      ImGui.GetColorU32(propertyBgColor),
      LAYOUT.sectionCornerRadius
    );

    const indentOffset = depth * LAYOUT.trackIndentWidth;
    let textStartX = lineStartPos.x + LAYOUT.trackLabelPadding + indentOffset;

    if (color) {
      const barWidth = 2;

      drawList.AddRectFilled(
        new ImGui.Vec2(textStartX, lineStartPos.y + 2),
        new ImGui.Vec2(textStartX + barWidth, lineStartPos.y + frameHeight - 2),
        ImGui.GetColorU32(color)
      );
      textStartX += barWidth + 4;
    }

    const textSize = ImGui.CalcTextSize(label);
    const textPosY = lineStartPos.y + (frameHeight - textSize.y) / 2;

    drawList.AddText(
      new ImGui.Vec2(textStartX, textPosY),
      ImGui.GetColorU32(new ImGui.Vec4(0.8, 0.8, 0.8, 1.0)),
      label
    );

    ImGui.SetCursorScreenPos(lineStartPos);
    ImGui.PushID(`prop_label_${label}_${rowIndex}`);
    ImGui.InvisibleButton('prop', new ImGui.Vec2(windowWidth, frameHeight));
    ImGui.PopID();

    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight));
  }

  /**
   * 绘制展开/折叠箭头
   */
  drawExpanderIcon (drawList: any, center: ImGui.Vec2, size: number, expanded: boolean, color: number, isHovered: boolean = false): void {
    const half = size / 2;

    if (isHovered) {
      const bgPadding = 3;
      const bgColor = new ImGui.Vec4(1.0, 1.0, 1.0, 0.1);

      drawList.AddCircleFilled(
        center,
        half + bgPadding,
        ImGui.GetColorU32(bgColor),
        12
      );
    }

    let drawColor = color;

    if (isHovered) {
      const r = ((color >> 24) & 0xFF) / 255;
      const g = ((color >> 16) & 0xFF) / 255;
      const b = ((color >> 8) & 0xFF) / 255;
      const a = (color & 0xFF) / 255;

      const brightR = Math.min(1.0, r + 0.3);
      const brightG = Math.min(1.0, g + 0.3);
      const brightB = Math.min(1.0, b + 0.3);

      drawColor = ImGui.GetColorU32(new ImGui.Vec4(brightR, brightG, brightB, a));
    }

    const innerOffset = size * 0.15;
    const actualHalf = half - innerOffset;

    if (expanded) {
      const topY = center.y - actualHalf * 0.7;
      const bottomY = center.y + actualHalf * 0.8;
      const leftX = center.x - actualHalf;
      const rightX = center.x + actualHalf;

      drawList.AddTriangleFilled(
        new ImGui.Vec2(leftX, topY),
        new ImGui.Vec2(rightX, topY),
        new ImGui.Vec2(center.x, bottomY),
        drawColor
      );
    } else {
      const leftX = center.x - actualHalf * 0.7;
      const rightX = center.x + actualHalf * 0.8;
      const topY = center.y - actualHalf;
      const bottomY = center.y + actualHalf;

      drawList.AddTriangleFilled(
        new ImGui.Vec2(leftX, topY),
        new ImGui.Vec2(leftX, bottomY),
        new ImGui.Vec2(rightX, center.y),
        drawColor
      );
    }
  }

  /**
   * 绘制轨道类型图标
   */
  drawTrackTypeIcon (drawList: any, trackAsset: TrackAsset, x: number, rowY: number, rowHeight: number, depth: number): void {
    const centerX = x + 5;
    const centerY = rowY + rowHeight / 2;
    const trackColor = depth === 0
      ? getTrackColor(trackAsset, this.state)
      : new ImGui.Vec4(0.5, 0.5, 0.55, 1.0);
    const colorU32 = ImGui.GetColorU32(trackColor);

    if (trackAsset instanceof TransformTrack) {
      // 菱形 — 变换
      const s = 4;

      drawList.AddQuadFilled(
        new ImGui.Vec2(centerX, centerY - s),
        new ImGui.Vec2(centerX + s, centerY),
        new ImGui.Vec2(centerX, centerY + s),
        new ImGui.Vec2(centerX - s, centerY),
        colorU32
      );
    } else if (trackAsset instanceof ActivationTrack) {
      // 电源/开关图标 — 圆环 + 顶部竖线
      const r = 3.5;

      drawList.AddCircle(new ImGui.Vec2(centerX, centerY), r, colorU32, 12, 1.5);
      drawList.AddLine(
        new ImGui.Vec2(centerX, centerY - r - 1),
        new ImGui.Vec2(centerX, centerY - 1),
        colorU32,
        1.5
      );
    } else if (trackAsset instanceof SpriteColorTrack) {
      // 图片帧图标 — 矩形 + 内部对角线（山形）
      const hw = 4, hh = 3.5;

      drawList.AddRect(
        new ImGui.Vec2(centerX - hw, centerY - hh),
        new ImGui.Vec2(centerX + hw, centerY + hh),
        colorU32, 0, 0, 1.5
      );
      // 山形折线
      drawList.AddLine(
        new ImGui.Vec2(centerX - hw + 1, centerY + hh - 1.5),
        new ImGui.Vec2(centerX - 1, centerY),
        colorU32, 1
      );
      drawList.AddLine(
        new ImGui.Vec2(centerX - 1, centerY),
        new ImGui.Vec2(centerX + 1.5, centerY + 1),
        colorU32, 1
      );
      drawList.AddLine(
        new ImGui.Vec2(centerX + 1.5, centerY + 1),
        new ImGui.Vec2(centerX + hw - 1, centerY - hh + 2),
        colorU32, 1
      );
    } else if (trackAsset instanceof SubCompositionTrack) {
      // 嵌套方块图标 — 外框 + 内部小方块
      const outer = 4;

      drawList.AddRect(
        new ImGui.Vec2(centerX - outer, centerY - outer),
        new ImGui.Vec2(centerX + outer, centerY + outer),
        colorU32, 0, 0, 1.5
      );
      const inner = 2;

      drawList.AddRectFilled(
        new ImGui.Vec2(centerX - inner + 1, centerY - inner + 1),
        new ImGui.Vec2(centerX + inner + 1, centerY + inner + 1),
        colorU32
      );
    } else if (trackAsset instanceof ParticleTrack) {
      // 星形/粒子图标 — 四角星
      const outerR = 4.5, innerR = 1.8;

      // 四角星用 4 个三角形拼合
      drawList.AddTriangleFilled(
        new ImGui.Vec2(centerX, centerY - outerR),
        new ImGui.Vec2(centerX - innerR, centerY - innerR),
        new ImGui.Vec2(centerX + innerR, centerY - innerR),
        colorU32
      );
      drawList.AddTriangleFilled(
        new ImGui.Vec2(centerX + outerR, centerY),
        new ImGui.Vec2(centerX + innerR, centerY - innerR),
        new ImGui.Vec2(centerX + innerR, centerY + innerR),
        colorU32
      );
      drawList.AddTriangleFilled(
        new ImGui.Vec2(centerX, centerY + outerR),
        new ImGui.Vec2(centerX + innerR, centerY + innerR),
        new ImGui.Vec2(centerX - innerR, centerY + innerR),
        colorU32
      );
      drawList.AddTriangleFilled(
        new ImGui.Vec2(centerX - outerR, centerY),
        new ImGui.Vec2(centerX - innerR, centerY + innerR),
        new ImGui.Vec2(centerX - innerR, centerY - innerR),
        colorU32
      );
    } else {
      // 默认 — 实心圆
      drawList.AddCircleFilled(
        new ImGui.Vec2(centerX, centerY),
        3.5,
        colorU32,
        12
      );
    }
  }
}
