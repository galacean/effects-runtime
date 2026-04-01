import type { Composition } from '@galacean/effects';
import { Component, CompositionComponent, VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { GalaceanEffects } from '../../ge';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import { Selection } from '../../core/selection';
import { COLORS, LAYOUT } from './theme';
import { SequencerState } from './sequencer-state';
import { TrackLabelRenderer } from './track-label-renderer';
import { ClipRenderer } from './clip-renderer';
import { KeyframeRenderer } from './keyframe-renderer';
import { PropertiesPanelRenderer } from './properties-panel-renderer';
import { timeToPixel, pixelToTime, drawTimeMarkers, beginScrub, endScrub } from './timeline-utils';

@editorWindow()
export class Sequencer extends EditorWindow {
  private state = new SequencerState();
  private trackLabelRenderer: TrackLabelRenderer;
  private clipRenderer: ClipRenderer;
  private keyframeRenderer: KeyframeRenderer;
  private propertiesPanelRenderer: PropertiesPanelRenderer;

  @menuItem('Window/Sequencer')
  static showWindow () {
    EditorWindow.getWindow(Sequencer).open();
  }

  constructor () {
    super();
    this.title = 'Sequencer';
    this.open();

    this.trackLabelRenderer = new TrackLabelRenderer(this.state);
    this.clipRenderer = new ClipRenderer(this.state);
    this.keyframeRenderer = new KeyframeRenderer(this.state);
    this.propertiesPanelRenderer = new PropertiesPanelRenderer(this.state);

    // 注入 KeyframeRenderer 到 ClipRenderer 避免循环依赖
    this.clipRenderer.setKeyframeRenderer(this.keyframeRenderer);
  }

  protected override onGUI (): void {
    if (GalaceanEffects.player.getCompositions().length === 0) {
      return;
    }

    const state = this.state;

    state.currentComposition = GalaceanEffects.player.getCompositions()[0];
    const currentComposition = state.currentComposition;

    // 清除轨道颜色缓存当 composition 变化时
    const compositionId = currentComposition.name ?? '';

    if (state.lastCompositionId !== compositionId) {
      state.trackColorMap.clear();
      state.lastCompositionId = compositionId;
    }

    let compositionComponent = currentComposition.rootItem.getComponent(CompositionComponent);

    const selectedObject = Selection.getSelectedObjects()[0];

    if (selectedObject instanceof VFXItem && selectedObject.getComponent(CompositionComponent)) {
      compositionComponent = selectedObject.getComponent(CompositionComponent);
    }

    if (!compositionComponent) {
      return;
    }

    // 使用当前 Composition 的时长作为时间轴最大时长
    if (typeof currentComposition.getDuration === 'function') {
      state.timelineEndTime = currentComposition.getDuration();
    }

    // 更新窗口尺寸信息
    this.updateWindowDimensions();

    // 使用可拖拽的分割器来分离主区域和属性面板
    const splitterWidth = 2; // thinner splitter
    const mainAreaWidth = state.windowContentWidth - state.propertiesPanelWidth - splitterWidth;

    // 开始左侧主区域
    if (ImGui.BeginChild('MainArea', new ImGui.Vec2(mainAreaWidth, 0), false)) {
      // 控制按钮区域
      this.drawControlButtons(currentComposition);

      // === 时间轴标尺区域 ===
      const mainAreaContentHeight = ImGui.GetContentRegionAvail().y;

      // 计算左右窗口宽度
      const desiredLabelWidth = Math.min(Math.max(state.trackUIOffset, state.trackLabelMinWidth), state.trackLabelMaxWidth);
      const leftPanelWidth = desiredLabelWidth;
      const innerSplitterWidth = 2; // thinner splitter
      const rightPanelWidth = mainAreaWidth - leftPanelWidth - innerSplitterWidth;

      // 左侧 "Tracks" 标题区域
      if (ImGui.BeginChild('TracksHeader', new ImGui.Vec2(leftPanelWidth, state.timelineHeight), false, ImGui.WindowFlags.NoScrollbar)) {
        const windowPos = ImGui.GetCursorScreenPos();
        const drawList = ImGui.GetWindowDrawList();

        drawList.AddRectFilled(
          windowPos,
          new ImGui.Vec2(windowPos.x + leftPanelWidth, windowPos.y + state.timelineHeight),
          ImGui.GetColorU32(COLORS.trackLabelBg)
        );

        const headerText = 'Tracks';
        const headerTextSize = ImGui.CalcTextSize(headerText);
        const headerTextPos = new ImGui.Vec2(
          windowPos.x + LAYOUT.trackLabelPadding,
          windowPos.y + (state.timelineHeight - headerTextSize.y) / 2
        );

        drawList.AddText(headerTextPos, ImGui.GetColorU32(COLORS.trackText), headerText);
        state.currentLabelWidth = leftPanelWidth;
      }
      ImGui.EndChild();

      // 中间分割器
      ImGui.SameLine();
      const dividerStartPos = ImGui.GetCursorScreenPos();
      const drawList = ImGui.GetWindowDrawList();
      const dividerColor = ImGui.GetColorU32(COLORS.trackRowDivider);

      ImGui.Dummy(new ImGui.Vec2(innerSplitterWidth, state.timelineHeight));

      // 右侧时间轴标尺区域
      ImGui.SameLine();
      if (ImGui.BeginChild('TimelineRuler', new ImGui.Vec2(rightPanelWidth, state.timelineHeight), false, ImGui.WindowFlags.NoScrollbar)) {
        const windowPos = ImGui.GetCursorScreenPos();
        const timelineStart = windowPos;
        const timelineEndX = windowPos.x + rightPanelWidth;
        const timelineEndPos = new ImGui.Vec2(timelineEndX, windowPos.y + state.timelineHeight);

        state.timelineAreaWidth = rightPanelWidth;
        const duration = Math.max(0, state.timelineEndTime - state.timelineStartTime);

        if (duration > 0 && rightPanelWidth > 0) {
          state.pixelsPerSecond = rightPanelWidth / duration;
        }

        // 时间轴背景
        drawList.AddRectFilled(timelineStart, timelineEndPos, ImGui.GetColorU32(COLORS.timelineBg));

        // 绘制时间刻度
        drawTimeMarkers(drawList, timelineStart, timelineEndX, state);

        // 时间轴交互层
        ImGui.SetCursorScreenPos(timelineStart);
        ImGui.PushID('TimelineInteraction');
        ImGui.InvisibleButton('timeline_interact', new ImGui.Vec2(rightPanelWidth, state.timelineHeight));

        if (ImGui.IsItemActivated()) {
          beginScrub(state);
        }

        if (ImGui.IsItemActive()) {
          const mousePos = ImGui.GetMousePos();
          const clickPosX = mousePos.x - timelineStart.x - LAYOUT.clipsAreaLeftPadding;
          const clickedTime = pixelToTime(clickPosX, state);

          state.currentTime = Math.max(state.timelineStartTime, Math.min(clickedTime, state.timelineEndTime));
          state.currentComposition.setTime(state.currentTime);
        }

        if (ImGui.IsItemDeactivated()) {
          endScrub(state);
        }

        ImGui.PopID();

        // === 绘制时间游标手柄 ===
        // 对齐到整数防亚像素渲染导致的模糊/变粗
        const cursorPixel = timeToPixel(state.currentTime, state);
        const cursorX = Math.floor(timelineStart.x + LAYOUT.clipsAreaLeftPadding + cursorPixel) + 0.5;

        state.timeCursorPositionX = Math.min(Math.max(cursorX, timelineStart.x + LAYOUT.clipsAreaLeftPadding), timelineEndX);

        const cursorColorU32 = ImGui.GetColorU32(COLORS.cursor);
        const handleHalfWidth = 5;
        const handleHeight = 14;
        const handleTopY = Math.floor(windowPos.y + 2) + 0.5;

        drawList.AddRectFilled(
          new ImGui.Vec2(state.timeCursorPositionX - handleHalfWidth, handleTopY),
          new ImGui.Vec2(state.timeCursorPositionX + handleHalfWidth, handleTopY + handleHeight),
          cursorColorU32,
          3.0 // corner radius
        );

        // 此时，连线下半部分已经挪到所有 clip 画完后单独补齐，但为了从手柄顶无缝连下来，
        // 最好是在 keyframeRenderer.drawTimeCursorLine 统一绘制以防粗细不一
        // 这段下引线可以暂时留一段但不需要了，我们将依赖 fgDrawList 一次画完，以防重叠导致半透重叠变色或粗细感

        // 游标交互区域
        ImGui.SetCursorScreenPos(new ImGui.Vec2(state.timeCursorPositionX - 8, windowPos.y));
        ImGui.PushID('TimeCursor');
        ImGui.InvisibleButton('##cursor_handle', new ImGui.Vec2(16, state.timelineHeight));

        if (ImGui.IsItemActivated()) {
          beginScrub(state);
        }

        if (ImGui.IsItemActive()) {
          const mousePos = ImGui.GetMousePos();
          const relativeX = Math.min(Math.max(0, mousePos.x - timelineStart.x - LAYOUT.clipsAreaLeftPadding), rightPanelWidth - LAYOUT.clipsAreaLeftPadding);
          const newTime = Math.min(Math.max(pixelToTime(relativeX, state), state.timelineStartTime), state.timelineEndTime);

          state.currentTime = newTime;
          state.currentComposition.setTime(newTime);
        }

        if (ImGui.IsItemDeactivated()) {
          endScrub(state);
        }

        ImGui.PopID();
      }
      ImGui.EndChild();

      // === 轨道区域 ===
      const trackAreaStartY = ImGui.GetCursorScreenPos().y;
      const availHeight = ImGui.GetContentRegionAvail().y;

      // 左侧轨道名称子窗口
      if (ImGui.BeginChild('TrackLabelsArea', new ImGui.Vec2(leftPanelWidth, availHeight), false)) {
        // 滚动同步：检测本面板是否被用户滚动（滚轮/滚动条拖拽）
        const leftNativeScroll = ImGui.GetScrollY();

        if (Math.abs(leftNativeScroll - state.leftPanelLastScrollY) > 0.1) {
          state.trackLabelsScrollY = leftNativeScroll;
        }
        ImGui.SetScrollY(state.trackLabelsScrollY);
        state.leftPanelLastScrollY = state.trackLabelsScrollY;

        state.trackRowCounter = 0;
        //@ts-expect-error
        const sceneBindings = compositionComponent.sceneBindings;

        //@ts-expect-error
        for (const track of compositionComponent.timelineAsset.tracks) {
          const trackAsset = track;
          const trackId = trackAsset.getInstanceId().toString();

          if (!state.initializedTrackIds.has(trackId)) {
            state.initializedTrackIds.add(trackId);
          }

          let boundObject: object | null = null;
          let trackName = '';

          for (const sceneBinding of sceneBindings) {
            if (sceneBinding.key.getInstanceId() === trackAsset.getInstanceId()) {
              boundObject = sceneBinding.value;

              break;
            }
          }

          if (boundObject instanceof VFXItem) {
            trackName = boundObject.name || 'VFX Item';
          } else if (boundObject instanceof Component) {
            trackName = boundObject.constructor.name;
          } else {
            trackName = trackAsset.constructor.name;
          }

          this.trackLabelRenderer.drawTrackLabel(trackAsset, trackName, sceneBindings, 0);
        }
      }
      ImGui.EndChild();

      // 中间分割器区域
      ImGui.SameLine();
      ImGui.Dummy(new ImGui.Vec2(innerSplitterWidth, availHeight));

      // 右侧clips区域子窗口
      ImGui.SameLine();
      if (ImGui.BeginChild('ClipsArea', new ImGui.Vec2(rightPanelWidth, availHeight), false)) {
        // 滚动同步：检测本面板是否被用户滚动
        const rightNativeScroll = ImGui.GetScrollY();

        if (Math.abs(rightNativeScroll - state.rightPanelLastScrollY) > 0.1) {
          state.trackLabelsScrollY = rightNativeScroll;
        }
        ImGui.SetScrollY(state.trackLabelsScrollY);
        state.rightPanelLastScrollY = state.trackLabelsScrollY;

        // 垂直网格线
        const clipsDrawList = ImGui.GetWindowDrawList();
        const clipsAreaPos = ImGui.GetCursorScreenPos();
        const clipsAreaHeight = ImGui.GetContentRegionAvail().y;
        const gridColor = ImGui.GetColorU32(COLORS.gridLine);

        for (const tickX of state.majorTickXPositions) {
          clipsDrawList.AddLine(
            new ImGui.Vec2(tickX, clipsAreaPos.y),
            new ImGui.Vec2(tickX, clipsAreaPos.y + clipsAreaHeight),
            gridColor,
            1
          );
        }

        state.trackRowCounter = 0;
        //@ts-expect-error
        const sceneBindings = compositionComponent.sceneBindings;

        //@ts-expect-error
        for (const track of compositionComponent.timelineAsset.tracks) {
          const trackAsset = track;

          let boundObject: object | null = null;
          let trackName = '';

          for (const sceneBinding of sceneBindings) {
            if (sceneBinding.key.getInstanceId() === trackAsset.getInstanceId()) {
              boundObject = sceneBinding.value;

              break;
            }
          }

          if (boundObject instanceof VFXItem) {
            trackName = boundObject.name || 'VFX Item';
          } else if (boundObject instanceof Component) {
            trackName = boundObject.constructor.name;
          } else {
            trackName = trackAsset.constructor.name;
          }

          this.clipRenderer.drawTrackClips(trackAsset, trackName, sceneBindings, 0);
        }

        // 绘制时间游标线，并覆盖掉间隙
        // 传递明确的全局坐标起点和终点，避免子窗口计算产生的舍入差异
        const cursorStartY = Math.floor(dividerStartPos.y + 16) + 0.5; // 与圆角矩形底端像素对齐
        const cursorEndY = Math.floor(ImGui.GetWindowPos().y + availHeight) + 0.5;

        this.keyframeRenderer.drawTimeCursorLine(cursorStartY, cursorEndY);
      }
      ImGui.EndChild();

      // === 贯通分割线和拖拽按钮 ===
      drawList.AddRectFilled(
        dividerStartPos,
        new ImGui.Vec2(dividerStartPos.x + innerSplitterWidth, dividerStartPos.y + mainAreaContentHeight),
        ImGui.GetColorU32(COLORS.trackSeparator)
      );

      drawList.AddLine(
        new ImGui.Vec2(dividerStartPos.x, dividerStartPos.y),
        new ImGui.Vec2(dividerStartPos.x, dividerStartPos.y + mainAreaContentHeight),
        dividerColor,
        1
      );

      const handleHalfWidth = state.trackLabelResizeHandleWidth / 2;
      const handleStartX = dividerStartPos.x - handleHalfWidth;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(handleStartX, dividerStartPos.y));
      ImGui.PushID('TrackLabelSplitter');

      ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0.0);
      ImGui.PushStyleColor(ImGui.Col.Button, ImGui.GetColorU32(COLORS.trackSeparator));
      ImGui.PushStyleColor(ImGui.Col.ButtonHovered, ImGui.GetColorU32(COLORS.selectionAlpha));
      ImGui.PushStyleColor(ImGui.Col.ButtonActive, ImGui.GetColorU32(COLORS.selection));
      ImGui.InvisibleButton('##track_label_splitter', new ImGui.Vec2(state.trackLabelResizeHandleWidth, mainAreaContentHeight));
      ImGui.PopStyleColor(3);
      ImGui.PopStyleVar();

      if (ImGui.IsItemHovered()) {
        ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);
      }

      if (ImGui.IsItemActive()) {
        const deltaX = ImGui.GetIO().MouseDelta.x;

        state.trackUIOffset += deltaX;
        state.trackUIOffset = Math.min(
          state.trackLabelMaxWidth,
          Math.max(state.trackLabelMinWidth, state.trackUIOffset)
        );
      }

      ImGui.PopID();

      // === 绘制完整贯通游标线 ===
      // （由于没有 ForegroundDrawList 支持，我们在各自 Child Window 内绘制，避免被遮挡）
    }
    ImGui.EndChild();

    // 绘制可拖拽的分割器
    ImGui.SameLine();
    this.drawResizableSplitter();

    // 右侧属性面板
    ImGui.SameLine();
    if (ImGui.BeginChild('PropertiesPanel', new ImGui.Vec2(state.propertiesPanelWidth, 0), false)) {
      this.propertiesPanelRenderer.drawTrackPropertiesPanel();
    }
    ImGui.EndChild();
  }

  /**
   * 绘制可拖拽的分割器
   */
  private drawResizableSplitter (): void {
    const state = this.state;
    const splitterWidth = 2; // thinner splitter
    const windowHeight = ImGui.GetContentRegionAvail().y;

    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0.0);
    // 隐藏按钮边框和背景，让它看起来像一条分割线
    ImGui.PushStyleColor(ImGui.Col.Button, ImGui.GetColorU32(COLORS.trackSeparator));
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, ImGui.GetColorU32(COLORS.selectionAlpha));
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, ImGui.GetColorU32(COLORS.selection));
    ImGui.Button('##PropertiesSplitter', new ImGui.Vec2(splitterWidth, windowHeight));
    ImGui.PopStyleColor(3);
    ImGui.PopStyleVar();

    if (ImGui.IsItemHovered()) {
      ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);
    }

    if (ImGui.IsItemActive()) {
      const mouseDelta = ImGui.GetIO().MouseDelta.x;

      state.propertiesPanelWidth -= mouseDelta;

      const minWidth = 150;
      const maxWidth = state.windowContentWidth * 0.6;

      state.propertiesPanelWidth = Math.max(minWidth, Math.min(maxWidth, state.propertiesPanelWidth));
    }
  }

  /**
   * 更新窗口尺寸相关信息
   */
  private updateWindowDimensions (): void {
    const state = this.state;

    state.windowContentWidth = ImGui.GetContentRegionAvail().x;
    const mainAreaWidth = state.windowContentWidth - state.propertiesPanelWidth - 10;
    const maxLabelWidth = Math.max(0, mainAreaWidth - state.timelineRightPadding);
    const desiredLabelWidth = Math.min(Math.max(state.trackUIOffset, state.trackLabelMinWidth), state.trackLabelMaxWidth);
    const labelWidth = Math.min(desiredLabelWidth, maxLabelWidth);

    state.currentLabelWidth = labelWidth;
    state.timelineAreaWidth = Math.max(0, mainAreaWidth - labelWidth - state.timelineRightPadding);

    const duration = Math.max(0, state.timelineEndTime - state.timelineStartTime);

    if (duration > 0 && state.timelineAreaWidth > 0) {
      state.pixelsPerSecond = state.timelineAreaWidth / duration;
    }
  }

  /**
   * 绘制控制按钮区域
   */
  private drawControlButtons (currentComposition: Composition): void {
    const state = this.state;
    const btnSize = 20;
    const drawList = ImGui.GetWindowDrawList();
    const iconColor = ImGui.GetColorU32(new ImGui.Vec4(0.85, 0.85, 0.85, 1.0));

    // === 跳转到开头按钮 ===
    const skipPos = ImGui.GetCursorScreenPos();

    if (ImGui.InvisibleButton('##skip_start', new ImGui.Vec2(btnSize, btnSize))) {
      currentComposition.setTime(0);
    }
    if (ImGui.IsItemHovered()) {
      drawList.AddRectFilled(skipPos, new ImGui.Vec2(skipPos.x + btnSize, skipPos.y + btnSize), ImGui.GetColorU32(COLORS.hover));
      ImGui.SetTooltip('Skip to Start');
    }
    // 竖线 + 左三角
    const skipCx = skipPos.x + btnSize / 2;
    const skipCy = skipPos.y + btnSize / 2;

    drawList.AddLine(new ImGui.Vec2(skipCx - 4, skipCy - 5), new ImGui.Vec2(skipCx - 4, skipCy + 5), iconColor, 2);
    drawList.AddTriangleFilled(
      new ImGui.Vec2(skipCx + 4, skipCy - 5),
      new ImGui.Vec2(skipCx + 4, skipCy + 5),
      new ImGui.Vec2(skipCx - 2, skipCy),
      iconColor
    );

    ImGui.SameLine();

    // === 播放/暂停按钮 ===
    const isPlaying = !currentComposition.getPaused();
    const playPos = ImGui.GetCursorScreenPos();

    if (ImGui.InvisibleButton('##play_pause', new ImGui.Vec2(btnSize, btnSize))) {
      if (isPlaying) {
        currentComposition.pause();
      } else {
        void currentComposition.resume();
      }
    }
    if (ImGui.IsItemHovered()) {
      drawList.AddRectFilled(playPos, new ImGui.Vec2(playPos.x + btnSize, playPos.y + btnSize), ImGui.GetColorU32(COLORS.hover));
      ImGui.SetTooltip(isPlaying ? 'Pause' : 'Play');
    }
    const playCx = playPos.x + btnSize / 2;
    const playCy = playPos.y + btnSize / 2;

    if (isPlaying) {
      // 暂停图标 — 两条竖线
      drawList.AddRectFilled(new ImGui.Vec2(playCx - 4, playCy - 5), new ImGui.Vec2(playCx - 1, playCy + 5), iconColor);
      drawList.AddRectFilled(new ImGui.Vec2(playCx + 1, playCy - 5), new ImGui.Vec2(playCx + 4, playCy + 5), iconColor);
    } else {
      // 播放图标 — 右三角
      drawList.AddTriangleFilled(
        new ImGui.Vec2(playCx - 4, playCy - 6),
        new ImGui.Vec2(playCx - 4, playCy + 6),
        new ImGui.Vec2(playCx + 5, playCy),
        iconColor
      );
    }

    ImGui.SameLine();

    // === 停止按钮 ===
    const stopPos = ImGui.GetCursorScreenPos();

    if (ImGui.InvisibleButton('##stop', new ImGui.Vec2(btnSize, btnSize))) {
      currentComposition.setTime(0);
      currentComposition.pause();
    }
    if (ImGui.IsItemHovered()) {
      drawList.AddRectFilled(stopPos, new ImGui.Vec2(stopPos.x + btnSize, stopPos.y + btnSize), ImGui.GetColorU32(COLORS.hover));
      ImGui.SetTooltip('Stop');
    }
    // 停止图标 — 实心方块
    const stopCx = stopPos.x + btnSize / 2;
    const stopCy = stopPos.y + btnSize / 2;

    drawList.AddRectFilled(new ImGui.Vec2(stopCx - 4, stopCy - 4), new ImGui.Vec2(stopCx + 4, stopCy + 4), iconColor);

    ImGui.SameLine();

    const timeText = `${currentComposition.time.toFixed(2)}s / ${state.timelineEndTime.toFixed(1)}s`;
    const timeTextWidth = ImGui.CalcTextSize(timeText).x;
    const availWidth = ImGui.GetContentRegionAvail().x;

    if (availWidth > timeTextWidth + 8) {
      ImGui.SameLine(ImGui.GetCursorPosX() + availWidth - timeTextWidth - 8);
    }
    ImGui.Text(timeText);

    state.currentTime = currentComposition.time;

    ImGui.Separator();
  }
}
