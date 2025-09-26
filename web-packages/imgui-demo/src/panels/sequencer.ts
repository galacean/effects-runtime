import type { Composition, TrackAsset } from '@galacean/effects';
import { Component, CompositionComponent, VFXItem, spec } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';

@editorWindow()
export class Sequencer extends EditorWindow {
  isDragging = false;
  currentTime = 0;
  trackUIOffset = 200; // 减少偏移，为时间轴留更多空间
  timeCursorPositionX = 0;

  // 时间轴配置
  private timelineStartTime = 0;
  private timelineEndTime = 30; // 30秒时间轴
  private pixelsPerSecond = 20; // 每秒20像素，提供更好的精度
  private timelineHeight = 30; // 时间轴区域高度

  // 缓存窗口尺寸信息
  private windowContentWidth = 0;
  private timelineAreaWidth = 0;

  // 轨道选中状态
  private selectedTrack: TrackAsset | null = null;

  // 轨道展开状态
  private expandedTracks = new Set<string>();

  // 属性面板配置
  private propertiesPanelWidth = 300; // 属性面板宽度

  currentComposition: Composition;

  @menuItem('Window/Sequencer')
  static showWindow () {
    EditorWindow.getWindow(Sequencer).open();
  }

  constructor () {
    super();
    this.title = 'Sequencer';
    this.open();
  }

  protected override onGUI (): void {
    if (GalaceanEffects.player.getCompositions().length === 0) {
      return;
    }

    this.currentComposition = GalaceanEffects.player.getCompositions()[0];
    const currentComposition = this.currentComposition;
    const compositionComponent = currentComposition.rootItem.getComponent(CompositionComponent);

    if (!compositionComponent) {
      return;
    }

    // 更新窗口尺寸信息
    this.updateWindowDimensions();

    // 使用可拖拽的分割器来分离主区域和属性面板
    const splitterWidth = 4; // 分割器宽度
    const mainAreaWidth = this.windowContentWidth - this.propertiesPanelWidth - splitterWidth;

    // 开始左侧主区域
    if (ImGui.BeginChild('MainArea', new ImGui.Vec2(mainAreaWidth, 0), false)) {
      // 控制按钮区域
      this.drawControlButtons(currentComposition);

      // 绘制颜色图例
      this.drawColorLegend();

      // 绘制时间轴区域（包含时间游标）
      this.drawTimelineRuler();

      // 记录轨道区域开始位置
      const trackAreaStartPos = ImGui.GetCursorScreenPos();

      //@ts-expect-error
      const sceneBindings = compositionComponent.sceneBindings;

      //@ts-expect-error
      for (const track of compositionComponent.timelineAsset.tracks) {
        const trackAsset = track;
        let boundObject: object | null = null;
        let trackName = '';

        // 查找绑定对象
        for (const sceneBinding of sceneBindings) {
          if (sceneBinding.key.getInstanceId() === trackAsset.getInstanceId()) {
            boundObject = sceneBinding.value;

            break;
          }
        }

        // 根据绑定对象类型确定轨道名称
        if (boundObject instanceof VFXItem) {
          trackName = boundObject.name || 'VFX Item';
        } else if (boundObject instanceof Component) {
          // 对于 Component，显示其类名
          trackName = boundObject.constructor.name;
        } else {
          // 如果没有绑定对象，显示轨道类型
          trackName = trackAsset.constructor.name;
        }

        // 使用自定义绘制方式替代 CollapsingHeader，确保对齐
        this.drawMasterTrack(trackAsset, trackName, boundObject, sceneBindings);
      }

      // 绘制时间游标线
      this.drawTimeCursorLine(trackAreaStartPos);
    }
    ImGui.EndChild();

    // 绘制可拖拽的分割器
    ImGui.SameLine();
    this.drawResizableSplitter();

    // 右侧属性面板（去掉边框）
    ImGui.SameLine();
    if (ImGui.BeginChild('PropertiesPanel', new ImGui.Vec2(this.propertiesPanelWidth, 0), false)) {
      this.drawTrackPropertiesPanel();
    }
    ImGui.EndChild();
  }

  /**
   * 绘制可拖拽的分割器
   */
  private drawResizableSplitter (): void {
    const splitterWidth = 4;
    const windowHeight = ImGui.GetContentRegionAvail().y;
    const splitterPos = ImGui.GetCursorScreenPos();

    // 创建不可见按钮作为拖拽区域
    ImGui.PushStyleColor(ImGui.ImGuiCol.Button, new ImGui.Vec4(0.0, 0.0, 0.0, 0.0)); // 透明
    ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonHovered, new ImGui.Vec4(0.3, 0.3, 0.3, 0.3)); // 悬停时半透明
    ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonActive, new ImGui.Vec4(0.4, 0.4, 0.4, 0.5)); // 拖拽时更明显

    if (ImGui.Button('##splitter', new ImGui.Vec2(splitterWidth, windowHeight))) {
      // 点击逻辑（如果需要）
    }

    // 绘制分割线
    const drawList = ImGui.GetWindowDrawList();
    const lineX = splitterPos.x + splitterWidth / 2;
    const lineColor = ImGui.GetColorU32(new ImGui.Vec4(0.5, 0.5, 0.5, 0.8)); // 灰色分割线

    drawList.AddLine(
      new ImGui.Vec2(lineX, splitterPos.y),
      new ImGui.Vec2(lineX, splitterPos.y + windowHeight),
      lineColor,
      1
    );

    // 处理拖拽调整大小
    if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0)) {
      const mouseDelta = ImGui.GetMouseDragDelta(0);

      // 更新属性面板宽度（注意拖拽方向）
      const newWidth = this.propertiesPanelWidth - mouseDelta.x;
      const minWidth = 150; // 最小宽度
      const maxWidth = this.windowContentWidth * 0.6; // 最大宽度为窗口的60%

      this.propertiesPanelWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      // 重置拖拽增量
      ImGui.ResetMouseDragDelta(0);
    }

    // 设置鼠标光标样式为调整大小
    if (ImGui.IsItemHovered()) {
      ImGui.SetMouseCursor(ImGui.ImGuiMouseCursor.ResizeEW);
    }

    ImGui.PopStyleColor(3);
  }

  /**
   * 绘制轨道属性面板
   */
  private drawTrackPropertiesPanel (): void {
    // 绘制深色背景
    const windowPos = ImGui.GetCursorScreenPos();
    const windowSize = ImGui.GetContentRegionAvail();
    const drawList = ImGui.GetWindowDrawList();

    // 绘制深色背景矩形
    const bgColor = ImGui.GetColorU32(new ImGui.Vec4(0.1, 0.1, 0.1, 1.0));

    drawList.AddRectFilled(
      windowPos,
      new ImGui.Vec2(windowPos.x + windowSize.x, windowPos.y + windowSize.y),
      bgColor
    );

    // 设置文字颜色为亮色，确保可见
    ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.Vec4(0.95, 0.95, 0.95, 1.0));

    ImGui.Text('Track Properties');

    if (!this.selectedTrack) {
      ImGui.TextColored(new ImGui.Vec4(0.8, 0.8, 0.8, 1.0), 'No track selected. Click on a track to view its properties.');

      // 恢复颜色设置
      ImGui.PopStyleColor(1);

      return;
    }

    // 显示选中轨道的基本信息
    ImGui.Text(`Selected Track: ${this.selectedTrack.constructor.name}`);

    // 设置表格颜色样式，使用更强制和明显的颜色配置
    ImGui.PushStyleColor(ImGui.ImGuiCol.TableRowBg, new ImGui.Vec4(0.2, 0.2, 0.2, 1.0)); // 更明显的深灰背景
    ImGui.PushStyleColor(ImGui.ImGuiCol.TableRowBgAlt, new ImGui.Vec4(0.3, 0.3, 0.3, 1.0)); // 更明显的交替行色
    ImGui.PushStyleColor(ImGui.ImGuiCol.TableHeaderBg, new ImGui.Vec4(0.1, 0.3, 0.5, 1.0)); // 更深的蓝色标题背景
    ImGui.PushStyleColor(ImGui.ImGuiCol.TableBorderStrong, new ImGui.Vec4(0.6, 0.6, 0.6, 1.0)); // 更亮的强边框
    ImGui.PushStyleColor(ImGui.ImGuiCol.TableBorderLight, new ImGui.Vec4(0.4, 0.4, 0.4, 1.0)); // 更亮的轻边框

    // 同时强制设置子窗口背景颜色
    ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, new ImGui.Vec4(0.1, 0.1, 0.1, 1.0));

    // 使用表格布局显示属性信息
    if (ImGui.BeginTable('TrackProperties', 2, ImGui.ImGuiTableFlags.Borders | ImGui.ImGuiTableFlags.RowBg)) {
      // 表头
      ImGui.TableSetupColumn('Property', ImGui.ImGuiTableColumnFlags.WidthFixed, 120);
      ImGui.TableSetupColumn('Value', ImGui.ImGuiTableColumnFlags.WidthStretch);

      // 手动设置表头背景色
      ImGui.TableNextRow(ImGui.ImGuiTableRowFlags.Headers);
      ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, ImGui.GetColorU32(new ImGui.Vec4(0.1, 0.3, 0.5, 1.0)));
      ImGui.TableSetColumnIndex(0);
      ImGui.Text('Property');
      ImGui.TableSetColumnIndex(1);
      ImGui.Text('Value');

      // Instance ID
      ImGui.TableNextRow();
      ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.2, 0.2, 1.0)));
      ImGui.TableSetColumnIndex(0);
      ImGui.Text('Instance ID');
      ImGui.TableSetColumnIndex(1);
      ImGui.Text(this.selectedTrack.getInstanceId().toString());

      // 轨道类型
      ImGui.TableNextRow();
      ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, ImGui.GetColorU32(new ImGui.Vec4(0.3, 0.3, 0.3, 1.0)));
      ImGui.TableSetColumnIndex(0);
      ImGui.Text('Track Type');
      ImGui.TableSetColumnIndex(1);
      ImGui.Text(this.selectedTrack.constructor.name);

      // 子轨道数量
      ImGui.TableNextRow();
      ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.2, 0.2, 1.0)));
      ImGui.TableSetColumnIndex(0);
      ImGui.Text('Child Tracks');
      ImGui.TableSetColumnIndex(1);
      ImGui.Text(this.selectedTrack.getChildTracks().length.toString());

      // Clips数量
      ImGui.TableNextRow();
      ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, ImGui.GetColorU32(new ImGui.Vec4(0.3, 0.3, 0.3, 1.0)));
      ImGui.TableSetColumnIndex(0);
      ImGui.Text('Clips');
      ImGui.TableSetColumnIndex(1);
      ImGui.Text(this.selectedTrack.getClips().length.toString());

      // 如果有clips，显示clips信息
      if (this.selectedTrack.getClips().length > 0) {
        ImGui.TableNextRow();
        ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, ImGui.GetColorU32(new ImGui.Vec4(0.2, 0.2, 0.2, 1.0)));
        ImGui.TableSetColumnIndex(0);
        ImGui.Text('Clip Details');
        ImGui.TableSetColumnIndex(1);

        const clips = this.selectedTrack.getClips();

        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          const clipInfo = `${clip.name || `Clip ${i + 1}`}: ${clip.start.toFixed(2)}s - ${(clip.start + clip.duration).toFixed(2)}s`;

          ImGui.Text(clipInfo);

          if (i < clips.length - 1) {
            ImGui.Text(''); // 空行分隔
          }
        }
      }

      ImGui.EndTable();
    }

    // 恢复表格颜色设置 (6个颜色：5个表格颜色 + 1个子窗口背景)
    ImGui.PopStyleColor(6);

    // 恢复文字颜色设置 (1个文字颜色)
    ImGui.PopStyleColor(1);
  }

  /**
   * 选中轨道
   */
  private selectTrack (track: TrackAsset): void {
    this.selectedTrack = track;
  }

  /**
   * 检查轨道是否被选中
   */
  private isTrackSelected (track: TrackAsset): boolean {
    return this.selectedTrack === track;
  }

  /**
   * 切换轨道展开状态
   */
  private toggleTrackExpansion (track: TrackAsset): void {
    const trackId = track.getInstanceId().toString();

    if (this.expandedTracks.has(trackId)) {
      this.expandedTracks.delete(trackId);
    } else {
      this.expandedTracks.add(trackId);
    }
  }

  /**
   * 检查轨道是否展开
   */
  private isTrackExpanded (track: TrackAsset): boolean {
    return this.expandedTracks.has(track.getInstanceId().toString());
  }

  /**
   * 更新窗口尺寸相关信息
   */
  private updateWindowDimensions (): void {
    this.windowContentWidth = ImGui.GetContentRegionAvail().x;
    // 计算主区域宽度
    const mainAreaWidth = this.windowContentWidth - this.propertiesPanelWidth - 10;

    // 时间轴区域宽度应该基于主区域宽度
    this.timelineAreaWidth = mainAreaWidth - this.trackUIOffset;

    // 动态调整时间轴范围以适应窗口大小
    const minTimelineWidth = this.timelineAreaWidth;
    const requiredTimeForWidth = minTimelineWidth / this.pixelsPerSecond;

    if (requiredTimeForWidth > this.timelineEndTime) {
      this.timelineEndTime = Math.ceil(requiredTimeForWidth);
    }
  }

  /**
   * 绘制控制按钮区域
   */
  private drawControlButtons (currentComposition: Composition): void {
    if (ImGui.Button('Play')) {
      void currentComposition.resume();
    }
    ImGui.SameLine();
    if (ImGui.Button('Pause')) {
      currentComposition.pause();
    }
    ImGui.SameLine();
    if (ImGui.Button('Stop')) {
      currentComposition.setTime(0);
    }
    ImGui.SameLine();

    // 时间显示
    const timeText = `${currentComposition.time.toFixed(2)}s / ${this.timelineEndTime.toFixed(1)}s`;

    ImGui.Text(timeText);

    this.currentTime = currentComposition.time;

    ImGui.Separator();
  }

  /**
   * 绘制颜色图例
   */
  private drawColorLegend (): void {
    ImGui.Text('End Behaviors:');
    ImGui.SameLine();

    // Destroy - 红色
    const destroyColor = this.getEndBehaviorColor(spec.EndBehavior.destroy);
    const destroyColorU32 = ImGui.GetColorU32(destroyColor);

    ImGui.ColorButton('##destroy', destroyColor, 0, new ImGui.Vec2(12, 12));
    ImGui.SameLine();
    ImGui.Text('Destroy');
    ImGui.SameLine();

    // Freeze - 蓝色
    const freezeColor = this.getEndBehaviorColor(spec.EndBehavior.freeze);

    ImGui.ColorButton('##freeze', freezeColor, 0, new ImGui.Vec2(12, 12));
    ImGui.SameLine();
    ImGui.Text('Freeze');
    ImGui.SameLine();

    // Restart - 绿色
    const restartColor = this.getEndBehaviorColor(spec.EndBehavior.restart);

    ImGui.ColorButton('##restart', restartColor, 0, new ImGui.Vec2(12, 12));
    ImGui.SameLine();
    ImGui.Text('Restart');
    ImGui.SameLine();

    // Forward - 橙色
    const forwardColor = this.getEndBehaviorColor(spec.EndBehavior.forward);

    ImGui.ColorButton('##forward', forwardColor, 0, new ImGui.Vec2(12, 12));
    ImGui.SameLine();
    ImGui.Text('Forward');

    ImGui.Separator();
  }  /**
   * 绘制时间轴标尺
   */
  private drawTimelineRuler (): void {
    const windowPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();

    // 获取当前子窗口的可用宽度，而不是使用全局窗口宽度
    const currentAreaWidth = ImGui.GetContentRegionAvail().x;
    const timelineEnd = windowPos.x + currentAreaWidth;

    // 时间轴背景
    const timelineStart = new ImGui.Vec2(windowPos.x + this.trackUIOffset, windowPos.y);
    const timelineEndPos = new ImGui.Vec2(timelineEnd, windowPos.y + this.timelineHeight);

    drawList.AddRectFilled(
      timelineStart,
      timelineEndPos,
      ImGui.GetColorU32(ImGui.ImGuiCol.FrameBg)
    );

    // 绘制时间刻度
    this.drawTimeMarkers(drawList, timelineStart, timelineEnd);

    // 保存当前光标位置，用于后续恢复
    const originalCursorPos = ImGui.GetCursorPos();

    // 计算和绘制时间游标（在时间轴区域内）
    const timelineX = windowPos.x + this.trackUIOffset;

    this.timeCursorPositionX = timelineX + this.timeToPixel(this.currentTime);

    // 绘制游标手柄
    const cursorHandlePos = new ImGui.Vec2(this.timeCursorPositionX - 8, windowPos.y + 2);
    const savedCursorPos = ImGui.GetCursorScreenPos();

    ImGui.SetCursorScreenPos(cursorHandlePos);
    ImGui.PushID('TimeCursor');
    ImGui.PushStyleColor(ImGui.ImGuiCol.Button, new ImGui.Vec4(0.6, 0.3, 0.8, 0.9));
    ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonHovered, new ImGui.Vec4(0.7, 0.4, 0.9, 1.0));
    ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonActive, new ImGui.Vec4(0.8, 0.5, 1.0, 1.0));

    if (ImGui.Button('', new ImGui.Vec2(16, this.timelineHeight - 4))) {
      // 点击逻辑
    }

    // 处理时间游标拖拽
    if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0, 0.0)) {
      const mousePos = ImGui.GetMousePos();
      const relativeX = mousePos.x - timelineX;
      const newTime = Math.max(0, this.pixelToTime(relativeX));

      this.currentComposition.setTime(newTime);
    }

    ImGui.PopStyleColor(3);
    ImGui.PopID();

    // 恢复到时间轴下方的正确位置
    // 注意：使用最初记录的windowPos，而不是当前的光标位置
    const timelineBottomY = windowPos.y + this.timelineHeight + 5;

    ImGui.SetCursorScreenPos(new ImGui.Vec2(windowPos.x, timelineBottomY));
  }

  /**
   * 绘制时间刻度标记
   */
  private drawTimeMarkers (drawList: any, timelineStart: ImGui.Vec2, timelineEndX?: number): void {
    const textColor = ImGui.GetColorU32(ImGui.ImGuiCol.Text);
    const lineColor = ImGui.GetColorU32(ImGui.ImGuiCol.Border);

    // 计算时间轴的实际结束X坐标
    const endX = timelineEndX || (timelineStart.x + this.timelineAreaWidth);

    // 主刻度（每5秒）
    for (let time = this.timelineStartTime; time <= this.timelineEndTime; time += 5) {
      const x = timelineStart.x + this.timeToPixel(time);

      // 只绘制在可见范围内的刻度
      if (x > endX) {
        break;
      }

      // 主刻度线
      drawList.AddLine(
        new ImGui.Vec2(x, timelineStart.y + 5),
        new ImGui.Vec2(x, timelineStart.y + this.timelineHeight - 5),
        lineColor,
        2
      );

      // 时间文本
      const timeText = `${time}s`;
      const textSize = ImGui.CalcTextSize(timeText);

      drawList.AddText(
        new ImGui.Vec2(x - textSize.x / 2, timelineStart.y + 8),
        textColor,
        timeText
      );
    }

    // 次刻度（每1秒）
    for (let time = this.timelineStartTime; time <= this.timelineEndTime; time += 1) {
      if (time % 5 !== 0) { // 避免与主刻度重叠
        const x = timelineStart.x + this.timeToPixel(time);

        // 只绘制在可见范围内的刻度
        if (x > endX) {
          break;
        }

        drawList.AddLine(
          new ImGui.Vec2(x, timelineStart.y + 10),
          new ImGui.Vec2(x, timelineStart.y + this.timelineHeight - 10),
          lineColor,
          1
        );
      }
    }
  }

  /**
   * 时间转换为像素位置
   */
  private timeToPixel (time: number): number {
    return (time - this.timelineStartTime) * this.pixelsPerSecond;
  }

  /**
   * 像素位置转换为时间
   */
  private pixelToTime (pixel: number): number {
    return this.timelineStartTime + (pixel / this.pixelsPerSecond);
  }

  private drawTrack (track: TrackAsset) {
    for (const child of track.getChildTracks()) {
      this.drawSubTrack(child, 0); // 主轨道深度为0
    }
  }

  /**
   * 绘制主轨道，使用统一的行高和对齐方式
   */
  private drawMasterTrack (trackAsset: TrackAsset, trackName: string, boundObject: object | null, sceneBindings: any[]): void {
    const frameHeight = ImGui.GetFrameHeight();
    const lineStartPos = ImGui.GetCursorScreenPos();
    const hasChildren = trackAsset.getChildTracks().length > 0;
    const isSelected = this.isTrackSelected(trackAsset);

    // 如果轨道被选中，绘制选中背景
    if (isSelected) {
      const drawList = ImGui.GetWindowDrawList();
      const bgColor = ImGui.GetColorU32(new ImGui.Vec4(0.3, 0.5, 0.8, 0.3));
      const bgStart = new ImGui.Vec2(lineStartPos.x, lineStartPos.y);
      // 使用当前子窗口的可用宽度
      const currentAreaWidth = ImGui.GetContentRegionAvail().x;
      const bgEnd = new ImGui.Vec2(lineStartPos.x + currentAreaWidth, lineStartPos.y + frameHeight);

      drawList.AddRectFilled(bgStart, bgEnd, bgColor);
    }

    if (hasChildren) {
      // 有子轨道，使用自定义的展开/收起控制

      // 绘制展开/收起图标
      const isExpanded = this.isTrackExpanded(trackAsset);
      const arrowIcon = isExpanded ? '-' : '+';
      const displayText = `${arrowIcon} ${trackName}`;
      const textSize = ImGui.CalcTextSize(displayText);

      // 创建可点击区域
      const clickableStart = new ImGui.Vec2(lineStartPos.x, lineStartPos.y);
      const clickableEnd = new ImGui.Vec2(lineStartPos.x + this.trackUIOffset - 10, lineStartPos.y + frameHeight);

      ImGui.SetCursorScreenPos(clickableStart);
      ImGui.PushID(`master_track_${trackAsset.getInstanceId()}`);

      if (ImGui.InvisibleButton('track_btn', new ImGui.Vec2(clickableEnd.x - clickableStart.x, frameHeight))) {
        // 单击只选中
        this.selectTrack(trackAsset);
      }

      // 检查是否双击来展开/收起
      if (ImGui.IsItemHovered() && ImGui.IsMouseDoubleClicked(0)) {
        this.toggleTrackExpansion(trackAsset);
      }

      ImGui.PopID();

      // 绘制文本
      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y));
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.Vec4(0.9, 0.9, 0.9, 1.0));
      const textY = lineStartPos.y + (frameHeight - textSize.y) / 2;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, textY));
      ImGui.Text(displayText);
      ImGui.PopStyleColor();

      // 移动到clip区域
      const clipAreaY = lineStartPos.y;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x + this.trackUIOffset, clipAreaY));

      // 绘制主轨道的clips（如果有）
      this.drawClips(trackAsset);

      // 确保换行到下一轨道
      const nextLineY = lineStartPos.y + frameHeight + 4;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, nextLineY));

      // 如果展开，绘制子轨道
      const shouldDrawChildren = this.isTrackExpanded(trackAsset);

      if (shouldDrawChildren) {
        for (const child of trackAsset.getChildTracks()) {
          this.drawSubTrack(child, 1, sceneBindings); // 传递 sceneBindings 到子轨道
        }
      }
    } else {
      // 没有子轨道，显示图标 + 名称，并创建可点击区域
      const leafIcon = '';
      const displayText = `${leafIcon} ${trackName}`;
      const textSize = ImGui.CalcTextSize(displayText);

      // 创建可点击区域
      const clickableStart = new ImGui.Vec2(lineStartPos.x, lineStartPos.y);
      const clickableEnd = new ImGui.Vec2(lineStartPos.x + this.trackUIOffset - 10, lineStartPos.y + frameHeight);

      ImGui.SetCursorScreenPos(clickableStart);
      ImGui.PushID(`master_track_${trackAsset.getInstanceId()}`);

      if (ImGui.InvisibleButton('track_btn', new ImGui.Vec2(clickableEnd.x - clickableStart.x, frameHeight))) {
        this.selectTrack(trackAsset);
      }

      ImGui.PopID();

      // 绘制文本
      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, lineStartPos.y));
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.Vec4(0.7, 0.7, 0.7, 1.0));
      const textY = lineStartPos.y + (frameHeight - textSize.y) / 2;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, textY));
      ImGui.Text(displayText);
      ImGui.PopStyleColor();

      // 移动到clip区域
      const clipAreaY = lineStartPos.y;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x + this.trackUIOffset, clipAreaY));

      // 绘制主轨道的clips（如果有）
      this.drawClips(trackAsset);

      // 确保换行到下一轨道
      const nextLineY = lineStartPos.y + frameHeight + 4;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, nextLineY));
    }

    // 只有在叶子轨道（无子轨道）的情况下，才需要检查和强制设置下一行位置
    // 因为有子轨道的情况已经在上面的分支中正确处理了
  }

  private drawSubTrack (track: TrackAsset, depth: number = 0, sceneBindings: any[] = []) {
    const trackAsset = track;
    const indentWidth = depth * 20; // 每层缩进20像素
    const frameHeight = ImGui.GetFrameHeight(); // 统一行高
    const isSelected = this.isTrackSelected(trackAsset);

    // 记录当前行的开始位置
    const lineStartPos = ImGui.GetCursorScreenPos();

    // 如果轨道被选中，绘制选中背景
    if (isSelected) {
      const drawList = ImGui.GetWindowDrawList();
      const bgColor = ImGui.GetColorU32(new ImGui.Vec4(0.3, 0.5, 0.8, 0.3));
      const bgStart = new ImGui.Vec2(lineStartPos.x, lineStartPos.y);
      // 使用当前子窗口的可用宽度
      const currentAreaWidth = ImGui.GetContentRegionAvail().x;
      const bgEnd = new ImGui.Vec2(lineStartPos.x + currentAreaWidth, lineStartPos.y + frameHeight);

      drawList.AddRectFilled(bgStart, bgEnd, bgColor);
    }

    // 检查是否有子轨道
    const hasChildren = track.getChildTracks().length > 0;

    // 查找当前轨道的绑定对象 - 每个 ObjectBindingTrack 都从 sceneBindings 中查找
    let boundObject: object | null = null;

    for (const sceneBinding of sceneBindings) {
      if (sceneBinding.key.getInstanceId() === trackAsset.getInstanceId()) {
        boundObject = sceneBinding.value;

        break;
      }
    }

    // 根据绑定对象确定轨道名称
    let trackName = trackAsset.constructor.name;

    if (boundObject instanceof VFXItem) {
      trackName = boundObject.name || 'VFX Item';
    } else if (boundObject instanceof Component) {
      // 对于 Component，显示其类名
      trackName = boundObject.constructor.name;
    } else {
      // 如果没有绑定对象，显示轨道类型
      trackName = trackAsset.constructor.name;
    }

    // 设置缩进
    ImGui.SetCursorPosX(ImGui.GetCursorPosX() + indentWidth);

    if (hasChildren) {
      // 有子轨道，使用自定义的展开/收起控制
      const isExpanded = this.isTrackExpanded(trackAsset);
      const arrowIcon = isExpanded ? '-' : '+';
      const displayText = `${arrowIcon} ${trackName}`;
      const textSize = ImGui.CalcTextSize(displayText);
      const textY = ImGui.GetCursorPosY() + (frameHeight - textSize.y) / 2;

      // 创建可点击区域
      const clickableStart = new ImGui.Vec2(ImGui.GetCursorScreenPos().x, lineStartPos.y);
      const clickableEnd = new ImGui.Vec2(lineStartPos.x + this.trackUIOffset - 10, lineStartPos.y + frameHeight);

      ImGui.SetCursorScreenPos(clickableStart);
      ImGui.PushID(`sub_track_${trackAsset.getInstanceId()}`);

      if (ImGui.InvisibleButton('track_btn', new ImGui.Vec2(clickableEnd.x - clickableStart.x, frameHeight))) {
        // 单击只选中
        this.selectTrack(trackAsset);
      }

      // 检查是否双击来展开/收起
      if (ImGui.IsItemHovered() && ImGui.IsMouseDoubleClicked(0)) {
        this.toggleTrackExpansion(trackAsset);
      }

      ImGui.PopID();

      // 绘制文本
      ImGui.SetCursorScreenPos(new ImGui.Vec2(clickableStart.x, lineStartPos.y));
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.Vec4(0.8, 0.8, 0.8, 1.0));
      const subTextY = lineStartPos.y + (frameHeight - textSize.y) / 2;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(clickableStart.x, subTextY));
      ImGui.Text(displayText);
      ImGui.PopStyleColor();

      // 移动到clip渲染区域（右侧时间轴区域）
      const clipAreaY = lineStartPos.y;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x + this.trackUIOffset, clipAreaY));

      // 在同一行绘制clips
      this.drawClips(trackAsset);

      // 确保换行到下一轨道，使用统一的行高和适当的间距
      const nextLineY = lineStartPos.y + frameHeight + 4; // 增加4像素间距使布局更清晰

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, nextLineY));

      // 如果展开，递归绘制子轨道
      if (this.isTrackExpanded(trackAsset)) {
        for (const child of track.getChildTracks()) {
          this.drawSubTrack(child, depth + 1, sceneBindings);
        }
      }
    } else {
      // 没有子轨道，使用普通文本标签，加上图标前缀以增强视觉层次
      const leafIcon = ''; // 叶子节点图标
      const displayText = `${leafIcon} ${trackName}`;
      const textSize = ImGui.CalcTextSize(displayText);
      const textY = ImGui.GetCursorPosY() + (frameHeight - textSize.y) / 2;

      // 创建可点击区域
      const clickableStart = new ImGui.Vec2(ImGui.GetCursorScreenPos().x, lineStartPos.y);
      const clickableEnd = new ImGui.Vec2(lineStartPos.x + this.trackUIOffset - 10, lineStartPos.y + frameHeight);

      ImGui.SetCursorScreenPos(clickableStart);
      ImGui.PushID(`sub_track_${trackAsset.getInstanceId()}`);

      if (ImGui.InvisibleButton('track_btn', new ImGui.Vec2(clickableEnd.x - clickableStart.x, frameHeight))) {
        this.selectTrack(trackAsset);
      }

      ImGui.PopID();

      // 绘制文本
      ImGui.SetCursorScreenPos(new ImGui.Vec2(clickableStart.x, lineStartPos.y));
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.Vec4(0.8, 0.8, 0.8, 1.0));
      const leafTextY = lineStartPos.y + (frameHeight - textSize.y) / 2;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(clickableStart.x, leafTextY));
      ImGui.Text(displayText);
      ImGui.PopStyleColor();

      // 移动到clip渲染区域（右侧时间轴区域）
      const clipAreaY = lineStartPos.y;

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x + this.trackUIOffset, clipAreaY));

      // 在同一行绘制clips
      this.drawClips(trackAsset);

      // 确保换行到下一轨道，使用统一的行高和适当的间距
      const nextLineY = lineStartPos.y + frameHeight + 4; // 增加4像素间距使布局更清晰

      ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, nextLineY));
    }
  }

  /**
   * 绘制轨道上的clips
   */
  private drawClips (trackAsset: TrackAsset) {
    const clips = trackAsset.getClips();
    const rowStartPos = ImGui.GetCursorScreenPos();
    const rowHeight = ImGui.GetFrameHeight();

    // 如果没有clips，不需要绘制任何东西，光标位置保持不变
    if (clips.length === 0) {
      return;
    }

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];

      // 计算clip的像素位置和大小
      const clipStartPixel = this.timeToPixel(clip.start);
      const clipWidth = clip.duration * this.pixelsPerSecond;

      // 设置clip的绝对位置，确保与轨道标签垂直居中对齐
      const clipPos = new ImGui.Vec2(rowStartPos.x + clipStartPixel, rowStartPos.y);
      const clipEndPos = new ImGui.Vec2(clipPos.x + clipWidth, clipPos.y + rowHeight);

      // 绘制clip背景
      const drawList = ImGui.GetWindowDrawList();

      // 根据 endBehavior 获取 clip 颜色
      const endBehaviorColor = this.getEndBehaviorColor(clip.endBehavior);
      const clipColor = ImGui.GetColorU32(endBehaviorColor);
      const borderColor = ImGui.GetColorU32(ImGui.ImGuiCol.Border);

      drawList.AddRectFilled(clipPos, clipEndPos, clipColor);
      drawList.AddRect(clipPos, clipEndPos, borderColor);

      // 临时设置光标位置用于创建交互区域
      ImGui.SetCursorScreenPos(clipPos);

      // 创建不可见按钮用于交互
      const clipId = `##clip_${trackAsset.getInstanceId()}_${i}`;

      ImGui.PushID(clipId);
      if (ImGui.InvisibleButton('clip', new ImGui.Vec2(clipWidth, rowHeight))) {
        // Clip点击逻辑
      }
      ImGui.PopID();

      // 处理clip拖拽
      if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0)) {
        const mouseDelta = ImGui.GetMouseDragDelta(0);
        const timeDelta = this.pixelToTime(mouseDelta.x) - this.pixelToTime(0);

        clip.start = Math.max(0, clip.start + timeDelta);
        ImGui.ResetMouseDragDelta(0);
      }

      // 处理悬停效果
      if (ImGui.IsItemHovered()) {
        const endBehaviorHoverColor = this.getEndBehaviorHoverColor(clip.endBehavior);
        const clipHoverColor = ImGui.GetColorU32(endBehaviorHoverColor);

        drawList.AddRectFilled(clipPos, clipEndPos, clipHoverColor);

        // 显示clip信息的tooltip，包含endBehavior描述
        const endBehaviorDesc = this.getEndBehaviorDescription(clip.endBehavior);
        const tooltipText = `${clip.name}\nStart: ${clip.start.toFixed(2)}s\nDuration: ${clip.duration.toFixed(2)}s\n${endBehaviorDesc}`;

        ImGui.SetTooltip(tooltipText);
      }

      // 绘制clip文本，垂直居中对齐
      const clipText = clip.name || 'Clip';
      const textSize = ImGui.CalcTextSize(clipText);
      const textPos = new ImGui.Vec2(
        clipPos.x + 4,
        clipPos.y + (rowHeight - textSize.y) / 2
      );

      drawList.AddText(textPos, ImGui.GetColorU32(ImGui.ImGuiCol.Text), clipText);
    }

    // 不重置光标位置，让调用方来管理布局流程
  }

  /**
   * 绘制时间游标线
   */
  private drawTimeCursorLine (trackAreaStartPos: ImGui.Vec2): void {
    const drawList = ImGui.GetWindowDrawList();
    const cursorEndY = ImGui.GetCursorScreenPos().y;

    // 绘制红色时间线
    drawList.AddLine(
      new ImGui.Vec2(this.timeCursorPositionX, trackAreaStartPos.y),
      new ImGui.Vec2(this.timeCursorPositionX, cursorEndY),
      ImGui.GetColorU32(new ImGui.Vec4(1.0, 0.3, 0.3, 0.8)),
      2
    );
  }

  /**
   * 根据 EndBehavior 获取对应的颜色
   */
  private getEndBehaviorColor (endBehavior: spec.EndBehavior): ImGui.Vec4 {
    switch (endBehavior) {
      case spec.EndBehavior.destroy:
        // 红色系 - 表示销毁
        return new ImGui.Vec4(0.8, 0.3, 0.3, 1.0);
      case spec.EndBehavior.freeze:
        // 蓝色系 - 表示冻结
        return new ImGui.Vec4(0.3, 0.5, 0.8, 1.0);
      case spec.EndBehavior.restart:
        // 绿色系 - 表示重启循环
        return new ImGui.Vec4(0.4, 0.7, 0.4, 1.0);
      case spec.EndBehavior.forward:
        // 橙色系 - 表示继续前进
        return new ImGui.Vec4(0.8, 0.6, 0.3, 1.0);
      default:
        // 默认灰色
        return new ImGui.Vec4(0.5, 0.5, 0.5, 1.0);
    }
  }

  /**
   * 根据 EndBehavior 获取对应的悬停颜色（稍微明亮一些）
   */
  private getEndBehaviorHoverColor (endBehavior: spec.EndBehavior): ImGui.Vec4 {
    switch (endBehavior) {
      case spec.EndBehavior.destroy:
        return new ImGui.Vec4(0.9, 0.4, 0.4, 1.0);
      case spec.EndBehavior.freeze:
        return new ImGui.Vec4(0.4, 0.6, 0.9, 1.0);
      case spec.EndBehavior.restart:
        return new ImGui.Vec4(0.5, 0.8, 0.5, 1.0);
      case spec.EndBehavior.forward:
        return new ImGui.Vec4(0.9, 0.7, 0.4, 1.0);
      default:
        return new ImGui.Vec4(0.6, 0.6, 0.6, 1.0);
    }
  }

  /**
   * 根据 EndBehavior 获取描述文本
   */
  private getEndBehaviorDescription (endBehavior: spec.EndBehavior): string {
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
}