import type { Composition } from '@galacean/effects';
import { Component, CompositionComponent, TransformTrack, VFXItem } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { GalaceanEffects } from '../../ge';
import { ImGui } from '../../imgui';
import { EditorWindow } from '../editor-window';
import { Selection } from '../../core/selection';
import { COLORS, LAYOUT } from './theme';
import { SequencerState } from './sequencer-state';
import { splitter } from '../../widgets';
import { TrackLabelRenderer } from './track-label-renderer';
import { ClipRenderer } from './clip-renderer';
import { KeyframeRenderer } from './keyframe-renderer';
import { CurveRenderer } from './curve-renderer';
import { timeToPixel, pixelToTime, drawTimeMarkers, beginScrub, endScrub } from './timeline-utils';
import { collectCurveChannelsForSelection, computeSharedValueRange } from './data-extraction';

@editorWindow()
export class Sequencer extends EditorWindow {
  private state = new SequencerState();
  private trackLabelRenderer: TrackLabelRenderer;
  private clipRenderer: ClipRenderer;
  private keyframeRenderer: KeyframeRenderer;
  private curveRenderer: CurveRenderer;

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
    this.curveRenderer = new CurveRenderer(this.state);

    // 注入渲染器到 ClipRenderer 避免循环依赖
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
      state.selectedTrack = null;
      state.selectedClip = null;
      state.selectedClipTrack = null;
      state.selectedKeyframeInfo = null;
      state.selectedKeyframes.clear();
      state.selectedPropertyGroup = null;
      state.selectedChannel = null;
      state.expandedTracks.clear();
      state.expandedPropertyGroups.clear();
      state.lastCompositionId = compositionId;
      // 合成切换时重置时间轴可见范围（不在每帧重置，否则会覆盖 ctrl+滚轮缩放）
      state.timelineStartTime = 0;
      if (typeof currentComposition.getDuration === 'function') {
        state.timelineEndTime = currentComposition.getDuration();
      }
    }

    let compositionComponent = currentComposition.sceneRoot.getComponent(CompositionComponent);

    const selectedObject = Selection.getSelectedObjects()[0];

    if (selectedObject instanceof VFXItem && selectedObject.getComponent(CompositionComponent)) {
      compositionComponent = selectedObject.getComponent(CompositionComponent);
    }

    if (!compositionComponent) {
      return;
    }

    // 更新窗口尺寸信息
    this.updateWindowDimensions();

    const splitterEdgeGap = 24;
    const splitterWidth = 2;
    const mainAreaWidth = state.windowContentWidth;

    // 开始左侧主区域
    if (ImGui.BeginChild('MainArea', new ImGui.Vec2(mainAreaWidth, 0), ImGui.ChildFlags.None)) {
      // 控制按钮区域
      this.drawControlButtons(currentComposition);

      // === 时间轴标尺区域 ===
      const mainAreaContentHeight = ImGui.GetContentRegionAvail().y;

      // 计算左右窗口宽度
      const desiredLabelWidth = Math.min(Math.max(state.trackUIOffset, state.trackLabelMinWidth), state.trackLabelMaxWidth);
      const leftPanelWidth = desiredLabelWidth;
      const innerSplitterWidth = 2; // thinner splitter
      const rightPanelWidth = Math.max(splitterEdgeGap, mainAreaWidth - leftPanelWidth - innerSplitterWidth);
      const maxDuration = typeof currentComposition.getDuration === 'function' ? currentComposition.getDuration() : 0;

      // === 时间轴导航条 + 缩放 + 平移（整个面板可用） ===
      {
        const overviewRowPos = ImGui.GetCursorScreenPos();
        const overviewX = overviewRowPos.x + leftPanelWidth + innerSplitterWidth;

        this.drawTimelineOverview(leftPanelWidth, innerSplitterWidth, rightPanelWidth, maxDuration);
        // Ctrl+滚轮缩放 / 中键平移（锚点用右侧时间轴区，整个面板均可触发）
        this.handleTimelineZoom(overviewX, rightPanelWidth, maxDuration);
        this.handleTimelinePan(maxDuration);
      }

      // 左侧 "Tracks" 标题区域
      if (ImGui.BeginChild('TracksHeader', new ImGui.Vec2(leftPanelWidth, state.timelineHeight), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar)) {
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
      if (ImGui.BeginChild('TimelineRuler', new ImGui.Vec2(rightPanelWidth, state.timelineHeight), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar)) {
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
      if (ImGui.BeginChild('TrackLabelsArea', new ImGui.Vec2(leftPanelWidth, availHeight), ImGui.ChildFlags.None)) {
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
      if (ImGui.BeginChild('ClipsArea', new ImGui.Vec2(rightPanelWidth, availHeight), ImGui.ChildFlags.None)) {
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

        if (state.curveMode && state.selectedTrack instanceof TransformTrack) {
          // 曲线画布模式：右侧整体渲染曲线画布
          const channels = collectCurveChannelsForSelection(state, state.selectedTrack);
          const canvasHeight = Math.max(clipsAreaHeight, 200);

          this.curveRenderer.drawCurveCanvas(channels, canvasHeight);
        } else {
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
        }

        // 绘制时间游标线，并覆盖掉间隙
        // 传递明确的全局坐标起点和终点，避免子窗口计算产生的舍入差异
        const cursorStartY = Math.floor(dividerStartPos.y + 16) + 0.5; // 与圆角矩形底端像素对齐
        const cursorEndY = Math.floor(ImGui.GetWindowPos().y + availHeight) + 0.5;

        this.keyframeRenderer.drawTimeCursorLine(cursorStartY, cursorEndY);
      }
      ImGui.EndChild();

      // === 贯通分割线和拖拽按钮 ===
      const handleHalfWidth = state.trackLabelResizeHandleWidth / 2;
      const handleStartX = dividerStartPos.x - handleHalfWidth;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(handleStartX, dividerStartPos.y));
      ImGui.PushID('TrackLabelSplitter');
      state.trackUIOffset = splitter('##track_label_splitter', state.trackUIOffset, {
        thickness: state.trackLabelResizeHandleWidth,
        length: mainAreaContentHeight,
        min: state.trackLabelMinWidth,
        max: Math.max(state.trackLabelMinWidth, mainAreaWidth - splitterEdgeGap - innerSplitterWidth),
      });

      ImGui.PopID();

      // === 绘制完整贯通游标线 ===
      // （由于没有 ForegroundDrawList 支持，我们在各自 Child Window 内绘制，避免被遮挡）
    }
    ImGui.EndChild();
  }

  /**
   * 更新窗口尺寸相关信息
   */
  private updateWindowDimensions (): void {
    const state = this.state;
    const splitterWidth = 2;
    const splitterEdgeGap = 24;

    state.windowContentWidth = ImGui.GetContentRegionAvail().x;
    state.propertiesPanelWidth = Math.min(
      Math.max(splitterEdgeGap, state.propertiesPanelWidth),
      Math.max(splitterEdgeGap, state.windowContentWidth - splitterEdgeGap - splitterWidth),
    );

    const mainAreaWidth = Math.max(splitterEdgeGap, state.windowContentWidth - state.propertiesPanelWidth - splitterWidth);
    const maxLabelWidth = Math.max(splitterEdgeGap, mainAreaWidth - splitterEdgeGap - splitterWidth);

    state.trackLabelMinWidth = splitterEdgeGap;
    state.trackLabelMaxWidth = maxLabelWidth;

    const desiredLabelWidth = Math.min(Math.max(state.trackUIOffset, state.trackLabelMinWidth), state.trackLabelMaxWidth);
    const labelWidth = Math.min(desiredLabelWidth, maxLabelWidth);

    state.currentLabelWidth = labelWidth;
    state.timelineAreaWidth = Math.max(0, mainAreaWidth - labelWidth - splitterWidth);

    const duration = Math.max(0, state.timelineEndTime - state.timelineStartTime);

    if (duration > 0 && state.timelineAreaWidth > 0) {
      state.pixelsPerSecond = state.timelineAreaWidth / duration;
    }
  }

  /**
   * Ctrl + 滚轮缩放时间轴：以鼠标 x 对应的时间为锚点，缩放 [timelineStartTime, timelineEndTime] 可见窗口。
   * pixelsPerSecond 由 width/duration 每帧重算，故缩放只需改 duration（起止时间）。
   * 整个时间轴面板均可触发（不限定 hover 在轨道区）。
   */
  private handleTimelineZoom (areaScreenX: number, areaWidth: number, maxDuration: number): void {
    const state = this.state;
    const io = ImGui.GetIO();

    if (!io.KeyCtrl || io.MouseWheel === 0 || ImGui.IsAnyItemActive()) {
      return;
    }
    const mousePos = ImGui.GetMousePos();
    const relX = mousePos.x - areaScreenX - LAYOUT.clipsAreaLeftPadding;

    if (relX < 0 || relX > areaWidth) {
      return;
    }
    const anchorTime = pixelToTime(relX, state);
    const duration = state.timelineEndTime - state.timelineStartTime;
    // 上滚放大（可见区间变小），下滚缩小（可见区间变大）
    const zoom = io.MouseWheel > 0 ? 0.8 : 1.25;
    let newDuration = Math.max(0.05, duration * zoom);

    newDuration = Math.min(newDuration, maxDuration);
    const ratio = (anchorTime - state.timelineStartTime) / Math.max(1e-6, duration);
    let newStart = anchorTime - ratio * newDuration;

    newStart = Math.max(0, Math.min(newStart, maxDuration - newDuration));
    state.timelineStartTime = newStart;
    state.timelineEndTime = newStart + newDuration;
  }

  /**
   * 鼠标中键按住左右移动平移时间轴可见窗口（duration 不变，整体左右移）。
   */
  private handleTimelinePan (maxDuration: number): void {
    const state = this.state;
    const io = ImGui.GetIO();

    if (!ImGui.IsMouseDown(ImGui.MouseButton.Middle) || ImGui.IsAnyItemActive()) {
      return;
    }
    const delta = ImGui.GetMouseDragDelta(ImGui.MouseButton.Middle);

    if (Math.abs(delta.x) < 1) {
      return;
    }
    const duration = state.timelineEndTime - state.timelineStartTime;
    // 像素 → 时间：用当前 pixelsPerSecond 换算（右移 delta>0 → 时间往左看更早，故减）
    const timeDelta = -delta.x / Math.max(1e-6, state.pixelsPerSecond);
    let newStart = state.timelineStartTime + timeDelta;

    newStart = Math.max(0, Math.min(newStart, maxDuration - duration));
    state.timelineStartTime = newStart;
    state.timelineEndTime = newStart + duration;
    ImGui.ResetMouseDragDelta(ImGui.MouseButton.Middle);
  }

  /**
   * 绘制时间轴导航条（overview）：左侧留白与轨道区对齐，右侧画整段时长 + 可见窗口框，
   * 点击/拖动平移可见窗口。用正常 Dummy+SameLine+InvisibleButton 布局，不破坏后续行。
   */
  private drawTimelineOverview (leftPanelWidth: number, splitterWidth: number, areaWidth: number, maxDuration: number): void {
    const state = this.state;
    const drawList = ImGui.GetWindowDrawList();
    const overviewHeight = 16;

    // 左侧留白（与 TracksHeader/TrackLabelsArea 对齐）
    ImGui.Dummy(new ImGui.Vec2(leftPanelWidth + splitterWidth, overviewHeight));
    ImGui.SameLine();
    // 右侧 overview 命中区
    ImGui.PushID('TimelineOverview');
    ImGui.InvisibleButton('overview', new ImGui.Vec2(areaWidth, overviewHeight));
    ImGui.PopID();

    const overviewMin = ImGui.GetItemRectMin();
    const overviewMax = ImGui.GetItemRectMax();
    const overviewRadius = 6;
    const frameRadius = 3;
    const isOverviewHovered = ImGui.IsItemHovered();
    const isOverviewActive = ImGui.IsItemActive();

    // 背景（圆角，无边框；hover/active 时提亮）
    const bgAlpha = isOverviewActive ? 0.16 : (isOverviewHovered ? 0.14 : 0.11);

    drawList.AddRectFilled(overviewMin, overviewMax, ImGui.GetColorU32(new ImGui.Vec4(0.12, 0.12, 0.14, bgAlpha)), overviewRadius);

    if (maxDuration <= 0) {
      return;
    }

    // 交互：按住拖动平移可见窗口（增量平移，按下不瞬移）
    if (isOverviewActive && ImGui.IsMouseDragging(ImGui.MouseButton.Left)) {
      const delta = ImGui.GetMouseDragDelta(ImGui.MouseButton.Left);

      if (Math.abs(delta.x) >= 1) {
        const duration = state.timelineEndTime - state.timelineStartTime;
        // 像素 → 时间：overview 全宽对应 maxDuration
        const timeDelta = (delta.x / areaWidth) * maxDuration;
        let newStart = state.timelineStartTime + timeDelta;

        newStart = Math.max(0, Math.min(newStart, maxDuration - duration));
        state.timelineStartTime = newStart;
        state.timelineEndTime = newStart + duration;
        ImGui.ResetMouseDragDelta(ImGui.MouseButton.Left);
      }
    }

    // 可见窗口框（圆角，无边框；hover/active 时增强）
    const startRatio = Math.max(0, state.timelineStartTime / maxDuration);
    const endRatio = Math.min(1, state.timelineEndTime / maxDuration);
    const frameX0 = overviewMin.x + startRatio * areaWidth;
    const frameX1 = overviewMin.x + endRatio * areaWidth;
    const frameMin = new ImGui.Vec2(frameX0, overviewMin.y);
    const frameMax = new ImGui.Vec2(Math.max(frameX1, frameX0 + 4), overviewMax.y);
    const frameBase = COLORS.selection;
    const frameAlpha = isOverviewActive ? 0.9 : (isOverviewHovered ? 0.7 : 0.5);

    drawList.AddRectFilled(
      frameMin, frameMax,
      ImGui.GetColorU32(new ImGui.Vec4(frameBase.x, frameBase.y, frameBase.z, frameAlpha)),
      frameRadius,
    );

    // 当前可见窗口 tooltip
    if (isOverviewHovered) {
      ImGui.SetTooltip(`${state.timelineStartTime.toFixed(2)}s - ${state.timelineEndTime.toFixed(2)}s`);
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

    // === 曲线模式切换按钮 ===
    const curvePos = ImGui.GetCursorScreenPos();
    const curveActive = state.curveMode;

    if (ImGui.InvisibleButton('##curve_mode', new ImGui.Vec2(btnSize, btnSize))) {
      state.curveMode = !state.curveMode;
    }
    if (ImGui.IsItemHovered()) {
      drawList.AddRectFilled(curvePos, new ImGui.Vec2(curvePos.x + btnSize, curvePos.y + btnSize), ImGui.GetColorU32(COLORS.hover));
      ImGui.SetTooltip(curveActive ? 'Switch to Keyframe View' : 'Switch to Curve View');
    }
    // 曲线图标 — S 形波浪线
    const curveCx = curvePos.x + btnSize / 2;
    const curveCy = curvePos.y + btnSize / 2;
    const curveIconColor = curveActive
      ? ImGui.GetColorU32(COLORS.selection)
      : iconColor;

    drawList.AddBezierCubic(
      new ImGui.Vec2(curveCx - 6, curveCy + 4),
      new ImGui.Vec2(curveCx - 2, curveCy + 4),
      new ImGui.Vec2(curveCx + 2, curveCy - 4),
      new ImGui.Vec2(curveCx + 6, curveCy - 4),
      curveIconColor,
      1.5
    );

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
