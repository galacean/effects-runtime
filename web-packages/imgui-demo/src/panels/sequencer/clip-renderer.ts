import type { TrackAsset } from '@galacean/effects';
import { ActivationTrack, Component, spec, TransformTrack, VFXItem } from '@galacean/effects';
import { ImGui } from '../../imgui';
import { COLORS, LAYOUT } from './theme';
import type { SequencerState } from './sequencer-state';
import { isTrackExpanded } from './selection';
import { timeToPixel, pixelToTime, getTrackColor, getEndBehaviorDescription, processSectionColor } from './timeline-utils';
import { getTransformPropertyGroups, getClipAggregatedKeyframeTimes } from './data-extraction';
import type { KeyframeRenderer } from './keyframe-renderer';

export class ClipRenderer {
  private keyframeRenderer: KeyframeRenderer | null = null;

  constructor (private readonly state: SequencerState) {}

  setKeyframeRenderer (renderer: KeyframeRenderer): void {
    this.keyframeRenderer = renderer;
  }

  /**
   * 绘制轨道clips(右侧窗口)
   */
  drawTrackClips (trackAsset: TrackAsset, trackName: string, sceneBindings: any[], depth: number): void {
    const state = this.state;
    const isTransformTrack = trackAsset instanceof TransformTrack;
    const hasKeyframeData = isTransformTrack && getTransformPropertyGroups(trackAsset).length > 0;
    const hasChildren = trackAsset.getChildTracks().length > 0 || hasKeyframeData;
    const frameHeight = LAYOUT.sectionHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const clipRowDrawList = ImGui.GetWindowDrawList();
    const clipRowWidth = ImGui.GetContentRegionAvail().x;
    const rowIndex = state.trackRowCounter;

    // clips 区域交替行背景
    const clipsBgColor = (rowIndex % 2 === 0) ? COLORS.header : COLORS.headerAlt;

    clipRowDrawList.AddRectFilled(
      lineStartPos,
      new ImGui.Vec2(lineStartPos.x + clipRowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(clipsBgColor)
    );

    // 行底部分割线
    clipRowDrawList.AddLine(
      new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight),
      new ImGui.Vec2(lineStartPos.x + clipRowWidth, lineStartPos.y + frameHeight),
      ImGui.GetColorU32(COLORS.trackRowDivider),
      1
    );

    state.trackRowCounter++;

    // 绘制clips
    this.drawClips(trackAsset, trackName);

    // 移动光标到下一行（submit a zero-height Dummy with no ItemSpacing to satisfy
    // SetCursorScreenPos boundary extension without affecting layout)
    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y + frameHeight + state.trackRowSpacing));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));
    ImGui.Dummy(new ImGui.Vec2(0, 0));
    ImGui.PopStyleVar();

    // 递归绘制子轨道clips
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

        this.drawTrackClips(child, childTrackName, sceneBindings, depth + 1);
      }
    }

    // TransformTrack 展开时，绘制属性分组的关键帧或曲线
    if (isTrackExpanded(state, trackAsset) && trackAsset instanceof TransformTrack) {
      const trackId = trackAsset.getInstanceId().toString();

      {
        const propertyGroups = getTransformPropertyGroups(trackAsset);

        for (const group of propertyGroups) {
          const groupId = `${trackId}_${group.name}`;
          const groupHasChildren = group.channels.length > 0;
          const isExpanded = groupHasChildren && state.expandedPropertyGroups.has(groupId);

          this.keyframeRenderer?.drawPropertyGroupKeyframes(group.name);

          if (isExpanded) {
            for (const channel of group.channels) {
              this.keyframeRenderer?.drawPropertyChannelKeyframes(channel, trackId, group.name, group.clipStart, group.clipDuration);
            }
          }
        }
      }
    }
  }

  /**
   * 绘制轨道上的clips — Section 渲染
   */
  private drawClips (trackAsset: TrackAsset, trackName: string = ''): void {
    const state = this.state;
    const clips = trackAsset.getClips();
    const rowStartPos = ImGui.GetCursorScreenPos();
    const rowHeight = LAYOUT.sectionHeight;

    // 查找 ActivationTrack 子轨道的 clips
    let activationClips: any[] = [];

    for (const childTrack of trackAsset.getChildTracks()) {
      if (childTrack instanceof ActivationTrack) {
        activationClips = childTrack.getClips();

        break;
      }
    }

    const allClips = [...clips];
    const clipSourceMap = new Map<any, 'normal' | 'activation'>();

    clips.forEach(clip => clipSourceMap.set(clip, 'normal'));
    activationClips.forEach(clip => {
      allClips.push(clip);
      clipSourceMap.set(clip, 'activation');
    });

    if (allClips.length === 0) {
      return;
    }

    const drawList = ImGui.GetWindowDrawList();
    const handleWidth = 6;
    const minClipDuration = 0.01;

    for (let i = 0; i < allClips.length; i++) {
      const clip = allClips[i];
      const isActivationClip = clipSourceMap.get(clip) === 'activation';

      const clipStartPixel = timeToPixel(clip.start, state);
      const clipWidth = clip.duration * state.pixelsPerSecond;

      const clipTop = rowStartPos.y + LAYOUT.clipVerticalPadding;
      const clipBottom = rowStartPos.y + rowHeight - LAYOUT.clipVerticalPadding;
      const clipHeight = Math.max(1, clipBottom - clipTop);

      const clipPos = new ImGui.Vec2(rowStartPos.x + LAYOUT.clipsAreaLeftPadding + clipStartPixel, clipTop);
      const clipEndPos = new ImGui.Vec2(clipPos.x + clipWidth, clipBottom);

      // Section 背景 — 仅使用轨道颜色
      const trackColor = getTrackColor(trackAsset, state);
      let sectionColor = processSectionColor(trackColor);

      const cornerRadius = Math.min(LAYOUT.clipCornerRadius, Math.min(clipHeight, clipWidth) * 0.4);

      // 选中轨道的 Clip 高亮
      const isClipTrackSelected = state.selectedTrack === trackAsset;
      const isClipSelected = state.selectedClip === clip;

      // 如果 Clip 自身被选中，整体提亮并偏向高亮色
      if (isClipSelected) {
        sectionColor = new ImGui.Vec4(
          Math.min(1.0, sectionColor.x * 1.3 + 0.2),
          Math.min(1.0, sectionColor.y * 1.3 + 0.2),
          Math.min(1.0, sectionColor.z * 1.3 + 0.2),
          1.0
        );
      }

      drawList.AddRectFilled(clipPos, clipEndPos, ImGui.GetColorU32(sectionColor), cornerRadius);

      if (isClipSelected) {
        // 深色粗边框和强烈的蓝色系 Overlay 再次增强选中感
        const activeOverlay = new ImGui.Vec4(COLORS.selection.x, COLORS.selection.y, COLORS.selection.z, 0.35);

        drawList.AddRectFilled(clipPos, clipEndPos, ImGui.GetColorU32(activeOverlay), cornerRadius);
      } else if (isClipTrackSelected) {
        const selectionOverlay = new ImGui.Vec4(
          COLORS.selection.x,
          COLORS.selection.y,
          COLORS.selection.z,
          0.15,
        );

        drawList.AddRectFilled(clipPos, clipEndPos, ImGui.GetColorU32(selectionOverlay), cornerRadius);
      }

      // === 交互区域 ===
      // 点击区域向两侧扩展，保证极窄 clip 也有足够的抓取面积
      const clipId = `##clip_${trackAsset.getInstanceId()}_${isActivationClip ? 'activation_' : ''}${i}`;
      const minHitWidth = handleWidth * 3;
      const hitWidth = Math.max(minHitWidth, clipWidth);
      const hitOffset = (hitWidth - clipWidth) / 2;
      const hitLeft = clipPos.x - hitOffset;

      ImGui.PushID(clipId);
      ImGui.SetCursorScreenPos(new ImGui.Vec2(hitLeft, clipPos.y));

      if (ImGui.InvisibleButton('clip', new ImGui.Vec2(hitWidth, clipHeight))) {
        state.selectedClip = clip;
        state.selectedClipTrack = trackAsset;
        state.selectedTrack = trackAsset; // Auto select corresponding track
        state.selectedKeyframeInfo = null;
      }

      const isClipHovered = ImGui.IsItemHovered();
      const isClipActive = ImGui.IsItemActive();

      // 悬浮时根据鼠标离左右边缘的距离显示光标
      if (isClipHovered && !isClipActive) {
        const mx = ImGui.GetMousePos().x;
        const distToLeft = Math.abs(mx - clipPos.x);
        const distToRight = Math.abs(mx - clipEndPos.x);
        const minDist = Math.min(distToLeft, distToRight);

        if (minDist <= handleWidth || clipWidth < handleWidth * 2) {
          ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);
        }
      }

      // 按下瞬间根据离边缘距离确定拖拽模式
      if (ImGui.IsItemActivated()) {
        const mx = ImGui.GetMousePos().x;
        const distToLeft = Math.abs(mx - clipPos.x);
        const distToRight = Math.abs(mx - clipEndPos.x);

        if (clipWidth < handleWidth * 2) {
          // 窄 clip：永远是 resize，选择更近的边
          state.clipDragMode = distToLeft <= distToRight ? 'resize-left' : 'resize-right';
        } else if (distToLeft <= handleWidth) {
          state.clipDragMode = 'resize-left';
        } else if (distToRight <= handleWidth) {
          state.clipDragMode = 'resize-right';
        } else {
          state.clipDragMode = 'move';
        }
      }

      // 拖拽中应用变换
      if (isClipActive && ImGui.IsMouseDragging(0)) {
        const delta = ImGui.GetMouseDragDelta(0);
        const timeDelta = pixelToTime(delta.x, state) - pixelToTime(0, state);

        if (state.clipDragMode === 'resize-left') {
          const maxShrink = clip.duration - minClipDuration;
          const clampedDelta = Math.max(-clip.start, Math.min(timeDelta, maxShrink));

          clip.start += clampedDelta;
          clip.duration -= clampedDelta;
        } else if (state.clipDragMode === 'resize-right') {
          clip.duration = Math.max(minClipDuration, clip.duration + timeDelta);
        } else if (state.clipDragMode === 'move') {
          clip.start = Math.max(0, clip.start + timeDelta);
        }

        if (state.clipDragMode !== 'none') {
          ImGui.ResetMouseDragDelta(0);
        }
        ImGui.SetMouseCursor(
          state.clipDragMode === 'move' ? ImGui.MouseCursor.Arrow : ImGui.MouseCursor.ResizeEW
        );
      }

      // 释放时重置模式
      if (ImGui.IsItemDeactivated()) {
        state.clipDragMode = 'none';
      }

      // 悬浮层 & tooltip
      if (isClipHovered || isClipActive) {
        const hoverOverlay = new ImGui.Vec4(1.0, 1.0, 1.0, 0.08);

        drawList.AddRectFilled(clipPos, clipEndPos, ImGui.GetColorU32(hoverOverlay), cornerRadius);

        if (isClipActive) {
          const activeBorder = new ImGui.Vec4(1.0, 1.0, 1.0, 0.6);

          drawList.AddRect(clipPos, clipEndPos, ImGui.GetColorU32(activeBorder), cornerRadius, 0, 2.0);
        }

        const clipType = isActivationClip ? 'Activation Clip' : 'Normal Clip';
        const tooltipText = isActivationClip
          ? `${clipType}\nStart: ${clip.start.toFixed(2)}s\nDuration: ${clip.duration.toFixed(2)}s\n${getEndBehaviorDescription(clip.endBehavior)}`
          : `${clip.name || clipType}\nStart: ${clip.start.toFixed(2)}s\nDuration: ${clip.duration.toFixed(2)}s\n${getEndBehaviorDescription(clip.endBehavior)}`;

        ImGui.SetTooltip(tooltipText);
      }

      ImGui.PopID();

      // Section Handles 视觉指示
      if (clipWidth >= 20) {
        const handleVisualWidth = 3;
        const handleColor = new ImGui.Vec4(0.0, 0.0, 0.0, 0.25);

        // 使用 ImGui.DrawFlags_RoundCornersLeft | ImGui.DrawFlags_RoundCornersRight
        // 这里直接取全圆角即可，视觉上差别不大并能避免超出
        drawList.AddRectFilled(
          new ImGui.Vec2(clipPos.x, clipPos.y),
          new ImGui.Vec2(clipPos.x + handleVisualWidth, clipEndPos.y),
          ImGui.GetColorU32(handleColor),
          cornerRadius
        );

        drawList.AddRectFilled(
          new ImGui.Vec2(clipEndPos.x - handleVisualWidth, clipPos.y),
          new ImGui.Vec2(clipEndPos.x, clipEndPos.y),
          ImGui.GetColorU32(handleColor),
          cornerRadius
        );
      }

      // 最后再画高亮描边，保证在最上层
      if (isClipSelected) {
        const activeBorder = new ImGui.Vec4(COLORS.selection.x, COLORS.selection.y, COLORS.selection.z, 1.0);

        drawList.AddRect(clipPos, clipEndPos, ImGui.GetColorU32(activeBorder), cornerRadius, ImGui.DrawCornerFlags ? ImGui.DrawCornerFlags.All : 15 as any, 2.0);
      } else if (isClipTrackSelected) {
        const selectedBorderColor = new ImGui.Vec4(
          COLORS.selection.x,
          COLORS.selection.y,
          COLORS.selection.z,
          0.8,
        );

        drawList.AddRect(clipPos, clipEndPos, ImGui.GetColorU32(selectedBorderColor), cornerRadius, ImGui.DrawCornerFlags ? ImGui.DrawCornerFlags.All : 15 as any, 1.0);
      } else {
        const borderColor = new ImGui.Vec4(0.0, 0.0, 0.0, 0.5);

        drawList.AddRect(clipPos, clipEndPos, ImGui.GetColorU32(borderColor), cornerRadius, ImGui.DrawCornerFlags ? ImGui.DrawCornerFlags.All : 15 as any, 1.0);
      }

      // 悬浮层 & tooltip

      // clip 文本
      const clipText = isActivationClip ? trackName : (clip.name || 'Clip');
      const textSize = ImGui.CalcTextSize(clipText);

      if (clipWidth > textSize.x + 16) {
        const textPos = new ImGui.Vec2(
          clipPos.x + 6,
          clipPos.y + (clipHeight - textSize.y) / 2
        );

        const shadowPos = new ImGui.Vec2(textPos.x + 1, textPos.y + 1);

        drawList.AddText(shadowPos, ImGui.GetColorU32(new ImGui.Vec4(0.0, 0.0, 0.0, 0.4)), clipText);
        drawList.AddText(textPos, ImGui.GetColorU32(new ImGui.Vec4(0.95, 0.95, 0.95, 1.0)), clipText);
      }

      // Section 级关键帧菱形标记
      const aggregatedTimes = getClipAggregatedKeyframeTimes(clip);

      if (aggregatedTimes.length > 0) {
        const sectionKfSize = 3;
        const sectionKfColor = ImGui.GetColorU32(new ImGui.Vec4(0.9, 0.9, 0.9, 0.6));
        const sectionKfCenterY = clipPos.y + clipHeight / 2;
        const clipLeftBound = clipPos.x + 4;
        const clipRightBound = clipEndPos.x - 4;

        for (const absTime of aggregatedTimes) {
          const kfPixelX = rowStartPos.x + LAYOUT.clipsAreaLeftPadding + timeToPixel(absTime, state);

          if (kfPixelX >= clipLeftBound && kfPixelX <= clipRightBound) {
            drawList.AddQuadFilled(
              new ImGui.Vec2(kfPixelX, sectionKfCenterY - sectionKfSize),
              new ImGui.Vec2(kfPixelX + sectionKfSize, sectionKfCenterY),
              new ImGui.Vec2(kfPixelX, sectionKfCenterY + sectionKfSize),
              new ImGui.Vec2(kfPixelX - sectionKfSize, sectionKfCenterY),
              sectionKfColor
            );
          }
        }
      }

      // === EndBehavior 延长条 ===
      if (clip.endBehavior !== spec.EndBehavior.destroy) {
        const timelineEndPixel = timeToPixel(state.timelineEndTime, state);
        const extStartX = clipEndPos.x;
        const extEndX = rowStartPos.x + LAYOUT.clipsAreaLeftPadding + timelineEndPixel;

        if (extEndX > extStartX + 2) {
          const extColor = new ImGui.Vec4(
            sectionColor.x * 0.7, sectionColor.y * 0.7, sectionColor.z * 0.7, 0.6
          );
          const extTop = clipTop;
          const extBottom = clipBottom;

          drawList.AddRectFilled(
            new ImGui.Vec2(extStartX, extTop),
            new ImGui.Vec2(extEndX, extBottom),
            ImGui.GetColorU32(extColor),
            cornerRadius
          );

          // 边框
          const extBorderColor = new ImGui.Vec4(
            sectionColor.x * 0.5, sectionColor.y * 0.5, sectionColor.z * 0.5, 0.6
          );

          drawList.AddRect(
            new ImGui.Vec2(extStartX, extTop),
            new ImGui.Vec2(extEndX, extBottom),
            ImGui.GetColorU32(extBorderColor),
            cornerRadius
          );

          const iconColor = ImGui.GetColorU32(COLORS.extensionIcon);
          const extCenterY = (extTop + extBottom) / 2;

          if (clip.endBehavior === spec.EndBehavior.restart) {
            // Restart: 循环图标
            const iconX = extStartX + 10;
            const r = 3;

            // 循环圆弧（画四分之三圆）
            drawList.AddCircle(new ImGui.Vec2(iconX, extCenterY), r, iconColor, 12, 1.5);
            // 这里用一个缺口圆+小箭头表示循环
            // 背景遮挡掉部分圆
            drawList.AddRectFilled(
              new ImGui.Vec2(iconX, extCenterY - r - 1.5),
              new ImGui.Vec2(iconX + r + 2, extCenterY),
              ImGui.GetColorU32(extColor)
            );
            // 箭头
            drawList.AddTriangleFilled(
              new ImGui.Vec2(iconX + r - 1, extCenterY - 2),
              new ImGui.Vec2(iconX + r + 3, extCenterY - 2),
              new ImGui.Vec2(iconX + r + 1, extCenterY + 2),
              iconColor
            );

            // Restart: 按 clip 时长分割成多段
            const segmentPixels = clip.duration * state.pixelsPerSecond;

            if (segmentPixels > 4) {
              const dividerColor = ImGui.GetColorU32(COLORS.extensionDivider);
              let divX = extStartX + segmentPixels;

              while (divX < extEndX - 2) {
                // 虚线分割线
                const dashLen = 3;
                const gapLen = 2;
                let dy = extTop + 2;

                while (dy < extBottom - 2) {
                  const dashEnd = Math.min(dy + dashLen, extBottom - 2);

                  drawList.AddLine(
                    new ImGui.Vec2(divX, dy),
                    new ImGui.Vec2(divX, dashEnd),
                    dividerColor,
                    1
                  );
                  dy += dashLen + gapLen;
                }
                divX += segmentPixels;
              }
            }
          } else if (clip.endBehavior === spec.EndBehavior.freeze) {
            // Freeze: 两条竖线（暂停符号）
            const iconX = extStartX + 10;
            const barH = 4;
            const barGap = 2;

            drawList.AddRectFilled(
              new ImGui.Vec2(iconX - barGap - 1, extCenterY - barH),
              new ImGui.Vec2(iconX - barGap + 1, extCenterY + barH),
              iconColor
            );
            drawList.AddRectFilled(
              new ImGui.Vec2(iconX + barGap - 1, extCenterY - barH),
              new ImGui.Vec2(iconX + barGap + 1, extCenterY + barH),
              iconColor
            );
          } else if (clip.endBehavior === spec.EndBehavior.forward) {
            // Forward: 右箭头
            const iconX = extStartX + 10;
            const arrowSize = 4;

            drawList.AddLine(
              new ImGui.Vec2(iconX - arrowSize, extCenterY),
              new ImGui.Vec2(iconX + arrowSize, extCenterY),
              iconColor, 1.5
            );
            drawList.AddTriangleFilled(
              new ImGui.Vec2(iconX + arrowSize - 1, extCenterY - 3),
              new ImGui.Vec2(iconX + arrowSize - 1, extCenterY + 3),
              new ImGui.Vec2(iconX + arrowSize + 3, extCenterY),
              iconColor
            );
          }

          // 延长条 tooltip
          ImGui.SetCursorScreenPos(new ImGui.Vec2(extStartX, extTop));
          ImGui.PushID(`ext_${trackAsset.getInstanceId()}_${i}`);
          ImGui.InvisibleButton('ext', new ImGui.Vec2(extEndX - extStartX, extBottom - extTop));
          if (ImGui.IsItemHovered()) {
            ImGui.SetTooltip(getEndBehaviorDescription(clip.endBehavior));
          }
          ImGui.PopID();
        }
      }
    }
  }
}
