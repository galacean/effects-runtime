import type { Composition, TrackAsset } from '@galacean/effects';
import { Component, CompositionComponent, VFXItem, spec, EffectsObject } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { GalaceanEffects } from '../ge';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';

@editorWindow()
export class Sequencer extends EditorWindow {
  currentTime = 0;
  trackUIOffset = 200; // 减少偏移，为时间轴留更多空间
  timeCursorPositionX = 0;
  private currentLabelWidth = this.trackUIOffset;
  private trackLabelMinWidth = 120;
  private trackLabelMaxWidth = 420;
  private trackLabelResizeHandleWidth = 4;
  // 统一的时间游标颜色（手柄与竖线一致）
  private cursorColor = new ImGui.Vec4(0.6, 0.3, 0.8, 0.9);

  // 时间轴配置
  private timelineStartTime = 0;
  private timelineEndTime = 30; // 30秒时间轴
  private pixelsPerSecond = 20; // 每秒20像素，提供更好的精度
  private timelineHeight = 30; // 时间轴区域高度
  private timelineRightPadding = 20; // 时间轴尾部预留空间，避免内容被裁剪

  // 视觉风格配置
  private timelineBgColor = new ImGui.Vec4(0.08, 0.08, 0.08, 1.0);
  private timelineLineColor = new ImGui.Vec4(0.3, 0.3, 0.3, 0.8);
  private timelineTextColor = new ImGui.Vec4(0.95, 0.95, 0.95, 1.0);
  private trackRowBgColor = new ImGui.Vec4(0.20, 0.20, 0.20, 1.0);
  private trackRowAltBgColor = new ImGui.Vec4(0.17, 0.17, 0.17, 1.0);
  private trackRowSelectedBgColor = new ImGui.Vec4(0.3, 0.5, 0.8, 0.3);
  private trackRowDividerColor = new ImGui.Vec4(0.12, 0.12, 0.12, 1.0);
  private trackTextColor = new ImGui.Vec4(0.85, 0.85, 0.85, 1.0);
  private trackTextSelectedColor = new ImGui.Vec4(0.85, 0.85, 0.85, 1.0);
  private clipBorderColor = new ImGui.Vec4(0.12, 0.12, 0.12, 1.0);
  private trackLabelBgColor = new ImGui.Vec4(0.16, 0.16, 0.16, 1.0);
  private trackLabelAltBgColor = new ImGui.Vec4(0.14, 0.14, 0.14, 1.0);
  private trackLabelSelectedBgColor = new ImGui.Vec4(0.3, 0.5, 0.8, 0.25);
  private trackLabelDividerColor = new ImGui.Vec4(0.08, 0.08, 0.08, 1.0);
  private trackSeparatorColor = new ImGui.Vec4(0.07, 0.07, 0.07, 1.0);

  // 布局配置
  private trackRowHeight = 28;
  private trackRowSpacing = 2;
  private trackIndentWidth = 16;
  private trackLabelPadding = 12;
  private expanderIconSize = 9;
  private clipVerticalPadding = 4;
  private trackLabelClipGap = 0;
  private clipCornerRadiusMax = 6;

  // 缓存窗口尺寸信息
  private windowContentWidth = 0;
  private timelineAreaWidth = 0;
  private isScrubbing = false;
  private resumeAfterScrub = false;
  private trackRowCounter = 0;

  // 轨道选中状态
  private selectedTrack: TrackAsset | null = null;

  // 轨道展开状态
  private expandedTracks = new Set<string>();
  private initializedTrackIds = new Set<string>();

  // 属性面板配置
  private propertiesPanelWidth = 300; // 属性面板宽度
  // 属性表格行计数（保留以备需要），当前采用统一灰色行底色
  private propertyRowIndex = 0;
  // 统一的属性表格行底色
  private propertyRowBgColor = new ImGui.Vec4(0.22, 0.22, 0.22, 1.0);

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

    // 使用当前 Composition 的时长作为时间轴最大时长
    // 不再根据窗口宽度自动拉长，确保以 Composition 为默认上限
    if (typeof currentComposition.getDuration === 'function') {
      this.timelineEndTime = currentComposition.getDuration();
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

      this.trackRowCounter = 0;
      //@ts-expect-error
      const sceneBindings = compositionComponent.sceneBindings;

      //@ts-expect-error
      for (const track of compositionComponent.timelineAsset.tracks) {
        const trackAsset = track;
        const trackId = trackAsset.getInstanceId().toString();

        if (!this.initializedTrackIds.has(trackId)) {
          this.initializedTrackIds.add(trackId);

          if (trackAsset.getChildTracks().length > 0) {
            this.expandedTracks.add(trackId);
          }
        }
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
        this.drawMasterTrack(trackAsset, trackName, sceneBindings);
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

    // 参考animation graph的标准分割器写法
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0.0);
    ImGui.Button('##PropertiesSplitter', new ImGui.Vec2(splitterWidth, windowHeight));
    ImGui.PopStyleVar();

    if (ImGui.IsItemHovered()) {
      ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);
    }

    // 处理拖拽调整大小 - 使用更流畅的方式
    if (ImGui.IsItemActive()) {
      const mouseDelta = ImGui.GetIO().MouseDelta.x;

      // 直接根据鼠标增量调整面板宽度（注意拖拽方向）
      this.propertiesPanelWidth -= mouseDelta;

      const minWidth = 150; // 最小宽度
      const maxWidth = this.windowContentWidth * 0.6; // 最大宽度为窗口的60%

      this.propertiesPanelWidth = Math.max(minWidth, Math.min(maxWidth, this.propertiesPanelWidth));
    }
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

    // 使用表格布局显示属性信息
    if (ImGui.BeginTable('TrackProperties', 2, ImGui.ImGuiTableFlags.Borders | ImGui.ImGuiTableFlags.RowBg | ImGui.ImGuiTableFlags.Resizable)) {
      // 每次绘制表格时重置行计数，避免颜色闪烁
      this.propertyRowIndex = 0;
      // 表头
      ImGui.TableSetupColumn('Property', ImGui.ImGuiTableColumnFlags.WidthFixed, 120);
      ImGui.TableSetupColumn('Value', ImGui.ImGuiTableColumnFlags.WidthStretch);

      // 表头行
      ImGui.TableNextRow(ImGui.ImGuiTableRowFlags.Headers);
      // 表头保持原来的蓝色（同时设置 RowBg0/RowBg1 避免叠加导致色偏）
      const headerBgU32 = ImGui.GetColorU32(new ImGui.Vec4(0.1, 0.3, 0.5, 1.0));

      ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, headerBgU32);
      ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg1, headerBgU32);
      ImGui.TableSetColumnIndex(0);
      {
        // 使用与内容行相同的样式，保证对齐
        const leafFlags = ImGui.ImGuiTreeNodeFlags.Leaf | ImGui.ImGuiTreeNodeFlags.NoTreePushOnOpen | ImGui.ImGuiTreeNodeFlags.SpanFullWidth | ImGui.ImGuiTreeNodeFlags.FramePadding;

        ImGui.TreeNodeEx('Property', leafFlags);
      }
      ImGui.TableSetColumnIndex(1);
      ImGui.Text('Value');

      // 固定信息：实例ID与类型
      ImGui.TableNextRow();
      {
        const rowU32 = ImGui.GetColorU32(this.propertyRowBgColor);

        ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, rowU32);
        ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg1, rowU32);
        this.propertyRowIndex++;
      }
      ImGui.TableSetColumnIndex(0);
      {
        const leafFlags = ImGui.ImGuiTreeNodeFlags.Leaf | ImGui.ImGuiTreeNodeFlags.NoTreePushOnOpen | ImGui.ImGuiTreeNodeFlags.SpanFullWidth | ImGui.ImGuiTreeNodeFlags.FramePadding;

        ImGui.TreeNodeEx('Instance ID', leafFlags);
      }
      ImGui.TableSetColumnIndex(1);
      ImGui.Text(this.selectedTrack.getInstanceId().toString());

      ImGui.TableNextRow();
      {
        const rowU32 = ImGui.GetColorU32(this.propertyRowBgColor);

        ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, rowU32);
        ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg1, rowU32);
        this.propertyRowIndex++;
      }
      ImGui.TableSetColumnIndex(0);
      {
        const leafFlags = ImGui.ImGuiTreeNodeFlags.Leaf | ImGui.ImGuiTreeNodeFlags.NoTreePushOnOpen | ImGui.ImGuiTreeNodeFlags.SpanFullWidth | ImGui.ImGuiTreeNodeFlags.FramePadding;

        ImGui.TreeNodeEx('Track Type', leafFlags);
      }
      ImGui.TableSetColumnIndex(1);
      ImGui.Text(this.selectedTrack.constructor.name);

      // 反射：仅收集 Track 的数据属性（标记普通对象用于展开）
      const props = this.reflectTrackProperties(this.selectedTrack);

      for (let i = 0; i < props.length; i++) {
        const p = props[i];

        ImGui.TableNextRow();
        // 设置统一灰色行背景（同时设置 RowBg0/RowBg1）
        {
          const rowU32 = ImGui.GetColorU32(this.propertyRowBgColor);

          ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, rowU32);
          ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg1, rowU32);
          this.propertyRowIndex++;
        }

        // 第一列：名称（统一使用 TreeNodeEx，非可展开项使用 Leaf+NoTreePushOnOpen 保证对齐）
        ImGui.TableSetColumnIndex(0);
        ImGui.PushID(`prop_${p.key}`);

        if (p.kind === 'object' && p.object) {
          const open = ImGui.TreeNodeEx(p.key, ImGui.ImGuiTreeNodeFlags.SpanFullWidth | ImGui.ImGuiTreeNodeFlags.FramePadding);

          // 第二列：对象简介
          ImGui.TableSetColumnIndex(1);
          ImGui.Text(this.describeNonEffectsObject(p.object));

          if (open) {
            const visited = new WeakSet<object>();

            visited.add(p.object);
            this.renderPlainObjectRows(p.object, p.key, 1, visited);
            ImGui.TreePop();
          }
        } else {
          const leafFlags = ImGui.ImGuiTreeNodeFlags.Leaf | ImGui.ImGuiTreeNodeFlags.NoTreePushOnOpen | ImGui.ImGuiTreeNodeFlags.SpanFullWidth | ImGui.ImGuiTreeNodeFlags.FramePadding;

          ImGui.TreeNodeEx(p.key, leafFlags);
          ImGui.TableSetColumnIndex(1);
          ImGui.Text(p.value);
        }

        ImGui.PopID();
      }

      ImGui.EndTable();
    }

    // 恢复文字颜色设置 (1个文字颜色)
    ImGui.PopStyleColor(1);
  }

  // 反射式收集 Track 的自有数据属性（不包含方法、getter/setter）。非 EffectsObject 的对象均可展开
  private reflectTrackProperties (track: TrackAsset): Array<{ key: string, value: string, kind?: 'object' | 'primitive', object?: Record<string, any> }> {
    const results: Array<{ key: string, value: string, kind?: 'object' | 'primitive', object?: Record<string, any> }> = [];

    try {
      const own = Object.getOwnPropertyNames(track as any);

      for (const k of own) {
        const desc = Object.getOwnPropertyDescriptor(track as any, k);

        if (!desc || !('value' in desc)) {
          // 跳过 accessor（getter/setter）或异常条目
          continue;
        }

        const v = (track as any)[k];

        if (typeof v === 'function') {
          // 跳过函数
          continue;
        }

        if (this.isExpandableObject(v)) {
          results.push({ key: k, value: '', kind: 'object', object: v });
        } else {
          results.push({ key: k, value: this.formatReflectValue(v), kind: 'primitive' });
        }
      }
    } catch (e) {
      // ignore reflection error
    }

    // 尺寸控制：避免过长
    const limit = 200;

    if (results.length > limit) {
      results.length = limit;
      results.push({ key: '...', value: `Truncated to ${limit} items` });
    }

    return results;
  }

  private isExpandableObject (v: any): v is Record<string, any> {
    if (!v || typeof v !== 'object') {
      return false;
    }

    if (v instanceof EffectsObject) {
      return false;
    }

    return true; // 其它一律可展开（包括数组、Date、自定义对象等）
  }

  // 在属性表中递归渲染普通 JS 对象（可折叠/展开）
  private renderPlainObjectRows (obj: Record<string, any>, idPrefix: string, depth: number, visited: WeakSet<object>): void {
    try {
      const keys = Object.keys(obj);

      for (const key of keys) {
        const value = obj[key];

        ImGui.TableNextRow();
        // 子级行与主表一致：统一灰色底（同时设置 RowBg0/RowBg1）
        {
          const rowU32 = ImGui.GetColorU32(this.propertyRowBgColor);

          ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg0, rowU32);
          ImGui.TableSetBgColor(ImGui.ImGuiTableBgTarget.RowBg1, rowU32);
          this.propertyRowIndex++;
        }
        ImGui.TableSetColumnIndex(0);
        ImGui.PushID(`${idPrefix}.${key}`);

        if (this.isExpandableObject(value)) {
          const open = ImGui.TreeNodeEx(key, ImGui.ImGuiTreeNodeFlags.SpanFullWidth | ImGui.ImGuiTreeNodeFlags.FramePadding);

          ImGui.TableSetColumnIndex(1);
          ImGui.Text(this.describeNonEffectsObject(value));

          if (open) {
            if (!visited.has(value)) {
              visited.add(value);
              this.renderPlainObjectRows(value, `${idPrefix}.${key}`, depth + 1, visited);
            }

            ImGui.TreePop();
          }
        } else {
          const leafFlags = ImGui.ImGuiTreeNodeFlags.Leaf | ImGui.ImGuiTreeNodeFlags.NoTreePushOnOpen | ImGui.ImGuiTreeNodeFlags.SpanFullWidth | ImGui.ImGuiTreeNodeFlags.FramePadding;

          ImGui.TreeNodeEx(key, leafFlags);
          ImGui.TableSetColumnIndex(1);
          ImGui.Text(this.formatReflectValue(value));
        }

        ImGui.PopID();
      }
    } catch (e) {
      // ignore
    }
  }

  private describeNonEffectsObject (v: any): string {
    if (Array.isArray(v)) {
      return `Array(${v.length})`;
    }

    const name = v?.constructor?.name;

    return name && name !== 'Object' ? name : 'Object';
  }

  private formatReflectValue (v: any): string {
    try {
      if (v == null) {
        return String(v);
      }

      const t = typeof v;

      if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
        return String(v);
      }

      if (Array.isArray(v)) {
        const preview = v.slice(0, 3).map(x => this.formatScalar(x)).join(', ');

        return `[${v.length}] ${preview}${v.length > 3 ? ', ...' : ''}`;
      }

      // 识别 EffectsObject：只显示 Class 名称
      if (v instanceof EffectsObject) {
        return v.constructor?.name || 'EffectsObject';
      }

      if (v && v.constructor && v.constructor.name && v.constructor.name !== 'Object') {
        // 尝试浅展开常见简单对象
        const keys = Object.keys(v).slice(0, 3);

        if (keys.length) {
          const p = keys.map(k => `${k}: ${this.formatScalar(v[k])}`).join(', ');

          return `${v.constructor.name} { ${p}${Object.keys(v).length > 3 ? ', ...' : ''} }`;
        }

        return v.constructor.name;
      }

      // 尝试 JSON 化（有上限）
      const str = JSON.stringify(v, (_k, val) => {
        if (typeof val === 'object' && val !== null) {
          return undefined; // 避免深层与循环
        }

        return val;
      });

      if (str && str.length <= 120) {
        return str;
      }

      return '[Object]';
    } catch (e) {
      return '[Unresolvable]';
    }
  }

  private formatScalar (v: any): string {
    if (v == null) {
      return String(v);
    }

    const t = typeof v;

    if (t === 'string') {
      return v.length > 24 ? `${v.slice(0, 21)}...` : v;
    }

    if (t === 'number' || t === 'boolean' || t === 'bigint') {
      return String(v);
    }

    if (Array.isArray(v)) {
      return `[${v.length}]`;
    }

    if (v && v.constructor && v.constructor.name) {
      return v.constructor.name;
    }

    return typeof v;
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
    const maxLabelWidth = Math.max(0, mainAreaWidth - this.timelineRightPadding);
    const desiredLabelWidth = Math.min(Math.max(this.trackUIOffset, this.trackLabelMinWidth), this.trackLabelMaxWidth);
    const labelWidth = Math.min(desiredLabelWidth, maxLabelWidth);

    this.currentLabelWidth = labelWidth;

    // 时间轴区域宽度应该基于主区域宽度
    this.timelineAreaWidth = Math.max(0, mainAreaWidth - labelWidth - this.timelineRightPadding);

    // 根据可用宽度动态计算像素/秒，使时间轴随窗口拉伸且刚好容纳整个合成时长
    const duration = Math.max(0, this.timelineEndTime - this.timelineStartTime);

    if (duration > 0 && this.timelineAreaWidth > 0) {
      this.pixelsPerSecond = this.timelineAreaWidth / duration;
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
  }

  /**
   * 绘制时间轴标尺
   */
  private drawTimelineRuler (): void {
    const windowPos = ImGui.GetCursorScreenPos();
    const drawList = ImGui.GetWindowDrawList();

    // 获取当前子窗口的可用宽度，并考虑垂直滚动条占用的空间
    const currentAreaWidth = ImGui.GetContentRegionAvail().x;
    const hasVerticalScrollbar = ImGui.GetScrollMaxY() > 0;
    const scrollbarCompensation = hasVerticalScrollbar ? ImGui.GetStyle().ScrollbarSize : 0;
    const adjustedAreaWidth = Math.max(0, currentAreaWidth - scrollbarCompensation - this.timelineRightPadding);

    // 计算轨道标签区域、间隔与时间轴区域的宽度
    const desiredLabelWidth = Math.min(Math.max(this.trackUIOffset, this.trackLabelMinWidth), this.trackLabelMaxWidth);
    const labelWidth = Math.min(desiredLabelWidth, adjustedAreaWidth);

    this.currentLabelWidth = labelWidth;

    const remainingWidth = Math.max(0, adjustedAreaWidth - labelWidth);
    const gapWidth = Math.min(this.trackLabelClipGap, remainingWidth);
    const timelineWidth = Math.max(0, remainingWidth - gapWidth);
    const labelAreaStart = windowPos;
    const labelAreaEnd = new ImGui.Vec2(windowPos.x + labelWidth, windowPos.y + this.timelineHeight);

    // 渲染左侧轨道标签头背景
    drawList.AddRectFilled(
      labelAreaStart,
      labelAreaEnd,
      ImGui.GetColorU32(this.trackLabelBgColor)
    );

    // 分割线
    const dividerColor = ImGui.GetColorU32(this.trackLabelDividerColor);

    drawList.AddLine(
      new ImGui.Vec2(labelAreaEnd.x, labelAreaStart.y),
      new ImGui.Vec2(labelAreaEnd.x, labelAreaEnd.y),
      dividerColor,
      1
    );

    // 标题文本
    const headerText = 'Tracks';
    const headerTextSize = ImGui.CalcTextSize(headerText);
    const headerTextPos = new ImGui.Vec2(
      labelAreaStart.x + this.trackLabelPadding,
      labelAreaStart.y + (this.timelineHeight - headerTextSize.y) / 2
    );

    drawList.AddText(
      headerTextPos,
      ImGui.GetColorU32(this.trackTextColor),
      headerText
    );

    // 时间轴区域起止坐标
    const timelineStartX = labelAreaEnd.x + gapWidth;
    const timelineStart = new ImGui.Vec2(timelineStartX, windowPos.y);
    const timelineEndX = timelineStartX + timelineWidth;
    const timelineEndPos = new ImGui.Vec2(timelineEndX, windowPos.y + this.timelineHeight);
    const handleHalfWidth = this.trackLabelResizeHandleWidth / 2;
    // 让分割器以分割线为中心，更容易触发
    const handleStartX = timelineStartX - handleHalfWidth;

    drawList.AddLine(
      new ImGui.Vec2(timelineStartX, windowPos.y + 4),
      new ImGui.Vec2(timelineStartX, windowPos.y + this.timelineHeight - 4),
      dividerColor,
      1
    );

    ImGui.SetCursorScreenPos(new ImGui.Vec2(handleStartX, windowPos.y));
    ImGui.PushID('TrackLabelSplitter');

    // 参考animation graph的标准分割器写法
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0.0);
    ImGui.Button('##track_label_splitter', new ImGui.Vec2(this.trackLabelResizeHandleWidth, this.timelineHeight));
    ImGui.PopStyleVar();

    if (ImGui.IsItemHovered()) {
      ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);
    }

    if (ImGui.IsItemActive()) {
      const deltaX = ImGui.GetIO().MouseDelta.x;

      // 直接根据鼠标增量调整轨道标签宽度
      this.trackUIOffset += deltaX;

      // 限制最小和最大宽度
      this.trackUIOffset = Math.min(
        this.trackLabelMaxWidth,
        Math.max(this.trackLabelMinWidth, this.trackUIOffset)
      );
    }

    ImGui.PopID();

    // 根据可见宽度更新时间轴像素映射，避免滚动条遮挡末尾
    this.timelineAreaWidth = timelineWidth;
    const duration = Math.max(0, this.timelineEndTime - this.timelineStartTime);

    if (duration > 0 && timelineWidth > 0) {
      this.pixelsPerSecond = timelineWidth / duration;
    }

    // 时间轴背景
    drawList.AddRectFilled(
      timelineStart,
      timelineEndPos,
      ImGui.GetColorU32(this.timelineBgColor)
    );

    // Timeline bottom border 覆盖整个区域
    drawList.AddLine(
      new ImGui.Vec2(windowPos.x, timelineEndPos.y),
      new ImGui.Vec2(timelineEndX, timelineEndPos.y),
      ImGui.GetColorU32(this.timelineLineColor),
      1
    );

    // 绘制时间刻度并缓存刻度位置供网格使用
    this.drawTimeMarkers(drawList, timelineStart, timelineEndX);

    // 在时间轴区域铺设不可见交互层：点击/拖拽即可跳转时间
    ImGui.SetCursorScreenPos(timelineStart);
    ImGui.PushID('TimelineScrubArea');
    if (ImGui.InvisibleButton('##timeline_scrub', new ImGui.Vec2(timelineWidth, this.timelineHeight))) {
      // 单击时根据点击位置跳转
      const mousePos = ImGui.GetMousePos();
      const relativeX = Math.min(Math.max(0, mousePos.x - timelineStartX), timelineWidth);
      const newTime = Math.min(Math.max(this.pixelToTime(relativeX), this.timelineStartTime), this.timelineEndTime);

      this.currentComposition.setTime(newTime);
    }

    if (ImGui.IsItemActivated()) {
      this.beginScrub();
    }

    // 允许后续控件与本控件重叠交互（使游标按钮能正确响应 hover/active）
    ImGui.SetItemAllowOverlap();

    // 支持在时间轴背景区域按下并拖动进行拖拽预览
    if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0, 0.0)) {
      const mousePos = ImGui.GetMousePos();
      const relativeX = Math.min(Math.max(0, mousePos.x - timelineStartX), timelineWidth);
      const newTime = Math.min(Math.max(this.pixelToTime(relativeX), this.timelineStartTime), this.timelineEndTime);

      this.currentComposition.setTime(newTime);
    }

    if (ImGui.IsItemDeactivated()) {
      this.endScrub();
    }
    ImGui.PopID();

    // 计算和绘制时间游标（在时间轴区域内）
    const timelineX = timelineStartX;
    const cursorPixel = this.timeToPixel(this.currentTime);

    this.timeCursorPositionX = Math.min(Math.max(timelineX + cursorPixel, timelineX), timelineEndX);

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

    if (ImGui.IsItemActivated()) {
      this.beginScrub();
    }

    // 处理时间游标拖拽
    if (ImGui.IsItemActive() && ImGui.IsMouseDragging(0, 0.0)) {
      const mousePos = ImGui.GetMousePos();
      const relativeX = Math.min(Math.max(0, mousePos.x - timelineX), timelineWidth);
      const newTime = Math.min(Math.max(this.pixelToTime(relativeX), this.timelineStartTime), this.timelineEndTime);

      this.currentComposition.setTime(newTime);
    }

    if (ImGui.IsItemDeactivated()) {
      this.endScrub();
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
    const textColor = ImGui.GetColorU32(this.timelineTextColor);
    const lineColor = ImGui.GetColorU32(this.timelineLineColor);

    // 计算时间轴的实际结束X坐标
    const endX = timelineEndX || (timelineStart.x + this.timelineAreaWidth);

    // 基于缩放动态选择“好看”的主刻度步长（1/2/5 系列）
    const secondsPerPixel = 1 / Math.max(1e-6, this.pixelsPerSecond);
    const targetPixelsPerMajor = 100; // 目标主刻度间距（像素）
    const roughStep = secondsPerPixel * targetPixelsPerMajor;
    const majorStep = this.getNiceStep(roughStep);
    const minorDiv = this.getMinorDivisions(majorStep); // 主刻度划分的次刻度数量
    const minorStep = majorStep / minorDiv;

    // 从一个对齐的主刻度开始绘制
    const startTime = this.timelineStartTime;
    const endTime = this.timelineEndTime;
    const firstMajor = Math.ceil(startTime / majorStep) * majorStep;

    // 避免文本重叠：主刻度标签之间至少留 60px
    const minLabelSpacing = 60;
    let lastLabelX = -Infinity;

    for (let tMajor = firstMajor; tMajor <= endTime + 1e-9; tMajor += majorStep) {
      const xMajor = timelineStart.x + this.timeToPixel(tMajor);

      if (xMajor > endX + 1) {
        break;
      }

      if (xMajor < timelineStart.x - 1) {
        continue;
      }

      // 主刻度线
      drawList.AddLine(
        new ImGui.Vec2(xMajor, timelineStart.y + 4),
        new ImGui.Vec2(xMajor, timelineStart.y + this.timelineHeight - 4),
        lineColor,
        2
      );

      // 主刻度标签（避免重叠）
      if (xMajor - lastLabelX >= minLabelSpacing) {
        const label = this.formatTimeLabel(tMajor, majorStep);
        const size = ImGui.CalcTextSize(label);

        drawList.AddText(
          new ImGui.Vec2(xMajor - size.x / 2, timelineStart.y + 8),
          textColor,
          label
        );

        lastLabelX = xMajor;
      }

      // 次刻度：在两个主刻度之间绘制
      for (let i = 1; i < minorDiv; i++) {
        const tMinor = tMajor + i * minorStep;

        if (tMinor > endTime + 1e-9) {
          break;
        }

        const xMinor = timelineStart.x + this.timeToPixel(tMinor);

        if (xMinor > endX + 1) {
          break;
        }

        if (xMinor < timelineStart.x - 1) {
          continue;
        }

        drawList.AddLine(
          new ImGui.Vec2(xMinor, timelineStart.y + 10),
          new ImGui.Vec2(xMinor, timelineStart.y + this.timelineHeight - 10),
          lineColor,
          1
        );

      }
    }
  }

  // 选择“好看”的刻度步长：使用 1/2/5 × 10^k 的序列
  private getNiceStep (rough: number): number {
    const minStep = 0.01; // 最小到 10ms 就够了
    const maxStep = 3600; // 最大到 1h
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

  // 根据主刻度步长选择次刻度划分数
  private getMinorDivisions (majorStep: number): number {
    const exp = Math.floor(Math.log10(majorStep));
    const base = Math.pow(10, exp);
    const frac = majorStep / base;
    // 1、5、10 -> 5等分；2 -> 2等分

    if (Math.abs(frac - 2) < 1e-6) {
      return 2;
    }

    return 5;
  }

  // 根据步长动态格式化时间标签：>=60s 显示 mm:ss；<1s 显示 s.ms；其它 s 或 m:ss
  private formatTimeLabel (seconds: number, step: number): string {
    const abs = Math.max(0, seconds);
    const minutes = Math.floor(abs / 60);
    const secs = abs % 60;

    // 需要到毫秒的精度
    const needMs = step < 1;

    if (minutes > 0) {
      const mm = String(minutes);
      const ss = needMs ? secs.toFixed(step < 0.1 ? 2 : 1) : Math.floor(secs).toString().padStart(2, '0');
      // 当 needMs 时，secs 已含小数；否则补零对齐

      return `${mm}:${typeof ss === 'string' && ss.includes('.') ? ss.padStart(4, '0') : ss.padStart(2, '0')}`;
    } else {
      if (needMs) {
        const precision = step < 0.1 ? 2 : 1; // 0.01 精度显示到两位小数

        return `${secs.toFixed(precision)}s`;
      }

      return `${Math.floor(secs)}s`;
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

  private beginScrub (): void {
    if (this.isScrubbing) {
      return;
    }

    this.isScrubbing = true;
    const isPaused = this.currentComposition.getPaused();

    this.resumeAfterScrub = !isPaused;

    if (!isPaused) {
      this.currentComposition.pause();
    }
  }

  private endScrub (): void {
    if (!this.isScrubbing) {
      return;
    }

    if (this.resumeAfterScrub) {
      this.currentComposition.resume();
    }

    this.resumeAfterScrub = false;
    this.isScrubbing = false;
  }

  private drawTrack (track: TrackAsset) {
    for (const child of track.getChildTracks()) {
      this.drawSubTrack(child, 0); // 主轨道深度为0
    }
  }

  /**
   * 绘制主轨道，使用统一的行高和对齐方式
   */
  private drawMasterTrack (trackAsset: TrackAsset, trackName: string, sceneBindings: any[]): void {
    const hasChildren = trackAsset.getChildTracks().length > 0;
    const shouldRenderChildren = this.renderTrackRow(trackAsset, trackName, 0, hasChildren);

    if (shouldRenderChildren) {
      for (const child of trackAsset.getChildTracks()) {
        this.drawSubTrack(child, 1, sceneBindings);
      }
    }
  }

  private drawSubTrack (track: TrackAsset, depth: number = 0, sceneBindings: any[] = []) {
    const trackAsset = track;
    const hasChildren = track.getChildTracks().length > 0;

    let boundObject: object | null = null;

    for (const sceneBinding of sceneBindings) {
      if (sceneBinding.key.getInstanceId() === trackAsset.getInstanceId()) {
        boundObject = sceneBinding.value;

        break;
      }
    }

    let trackName = trackAsset.constructor.name;

    if (boundObject instanceof VFXItem) {
      trackName = boundObject.name || 'VFX Item';
    } else if (boundObject instanceof Component) {
      trackName = boundObject.constructor.name;
    }

    const shouldRenderChildren = this.renderTrackRow(trackAsset, trackName, depth, hasChildren);

    if (shouldRenderChildren) {
      for (const child of track.getChildTracks()) {
        this.drawSubTrack(child, depth + 1, sceneBindings);
      }
    }
  }

  private renderTrackRow (trackAsset: TrackAsset, trackName: string, depth: number, hasChildren: boolean): boolean {
    const frameHeight = this.trackRowHeight;
    const lineStartPos = ImGui.GetCursorScreenPos();
    const currentAreaWidth = ImGui.GetContentRegionAvail().x;
    const hasVerticalScrollbar = ImGui.GetScrollMaxY() > 0;
    const scrollbarCompensation = hasVerticalScrollbar ? ImGui.GetStyle().ScrollbarSize : 0;
    const usableWidth = Math.max(0, currentAreaWidth - scrollbarCompensation - this.timelineRightPadding);
    const targetLabelWidth = this.currentLabelWidth > 0 ? this.currentLabelWidth : this.trackUIOffset;
    const labelWidth = Math.min(targetLabelWidth, usableWidth);
    const labelEndX = lineStartPos.x + labelWidth;
    const rowEndX = lineStartPos.x + usableWidth;
    const rowEnd = new ImGui.Vec2(rowEndX, lineStartPos.y + frameHeight);
    const drawList = ImGui.GetWindowDrawList();
    const rowIndex = this.trackRowCounter++;
    const isSelected = this.isTrackSelected(trackAsset);

    const timelineBaseColor = (rowIndex % 2 === 0) ? this.trackRowBgColor : this.trackRowAltBgColor;
    const labelBaseColor = (rowIndex % 2 === 0) ? this.trackLabelBgColor : this.trackLabelAltBgColor;
    const timelineBgColor = isSelected ? this.trackRowSelectedBgColor : timelineBaseColor;
    const labelBgColor = isSelected ? this.trackLabelSelectedBgColor : labelBaseColor;

    const clipStartX = Math.min(rowEndX, labelEndX + this.trackLabelClipGap);

    drawList.AddRectFilled(
      lineStartPos,
      new ImGui.Vec2(labelEndX, rowEnd.y),
      ImGui.GetColorU32(labelBgColor)
    );

    if (clipStartX > labelEndX) {
      drawList.AddRectFilled(
        new ImGui.Vec2(labelEndX, lineStartPos.y),
        new ImGui.Vec2(clipStartX, rowEnd.y),
        ImGui.GetColorU32(this.trackSeparatorColor)
      );
    }

    drawList.AddRectFilled(
      new ImGui.Vec2(clipStartX, lineStartPos.y),
      rowEnd,
      ImGui.GetColorU32(timelineBgColor)
    );

    drawList.AddLine(
      new ImGui.Vec2(labelEndX, lineStartPos.y),
      new ImGui.Vec2(labelEndX, rowEnd.y),
      ImGui.GetColorU32(this.trackLabelDividerColor),
      1
    );

    drawList.AddLine(
      new ImGui.Vec2(lineStartPos.x, rowEnd.y),
      new ImGui.Vec2(rowEnd.x, rowEnd.y),
      ImGui.GetColorU32(this.trackRowDividerColor),
      1
    );

    const indentOffset = depth * this.trackIndentWidth;
    const iconSize = this.expanderIconSize;
    const iconLeft = lineStartPos.x + this.trackLabelPadding + indentOffset;
    const iconRight = iconLeft + iconSize;
    const iconTop = lineStartPos.y + (frameHeight - iconSize) / 2;
    const iconBottom = iconTop + iconSize;

    let labelHovered = false;

    if (labelWidth > 0) {
      ImGui.SetCursorScreenPos(lineStartPos);
      ImGui.PushID(`track_label_${trackAsset.getInstanceId()}`);

      if (ImGui.InvisibleButton('label', new ImGui.Vec2(labelWidth, frameHeight))) {
        const mousePos = ImGui.GetMousePos();
        const clickedIcon = hasChildren && mousePos.x >= iconLeft - 3 && mousePos.x <= iconRight + 3 && mousePos.y >= iconTop - 3 && mousePos.y <= iconBottom + 3;

        if (clickedIcon) {
          this.toggleTrackExpansion(trackAsset);
        }

        this.selectTrack(trackAsset);
      }

      labelHovered = ImGui.IsItemHovered();

      if (hasChildren && labelHovered && ImGui.IsMouseDoubleClicked(0)) {
        this.toggleTrackExpansion(trackAsset);
      }

      ImGui.PopID();
    }

    const textColor = isSelected ? this.trackTextSelectedColor : this.trackTextColor;
    const textColorU32 = ImGui.GetColorU32(textColor);
    const textSize = ImGui.CalcTextSize(trackName);
    let textStartX = lineStartPos.x + this.trackLabelPadding + indentOffset;

    if (hasChildren) {
      const iconCenter = new ImGui.Vec2(iconLeft + iconSize / 2, lineStartPos.y + frameHeight / 2);

      this.drawExpanderIcon(drawList, iconCenter, iconSize, this.isTrackExpanded(trackAsset), textColorU32);
      textStartX = iconRight + 6;
    }

    const textPosY = lineStartPos.y + (frameHeight - textSize.y) / 2;
    const textClipPadding = 4;
    const clipMin = new ImGui.Vec2(textStartX, lineStartPos.y);
    const clipMaxX = Math.max(textStartX, labelEndX - textClipPadding);
    const clipMax = new ImGui.Vec2(clipMaxX, rowEnd.y);
    const hasClipSpace = clipMax.x > clipMin.x;

    if (hasClipSpace) {
      ImGui.PushClipRect(clipMin, clipMax, true);
      ImGui.SetCursorScreenPos(new ImGui.Vec2(textStartX, textPosY));
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, textColor);
      ImGui.Text(trackName);
      ImGui.PopStyleColor();
      ImGui.PopClipRect();
    }

    // 移动到clip渲染区域（右侧时间轴区域）
    const clipAreaY = lineStartPos.y;

    ImGui.SetCursorScreenPos(new ImGui.Vec2(clipStartX, clipAreaY));
    this.drawClips(trackAsset);

    ImGui.SetCursorScreenPos(new ImGui.Vec2(lineStartPos.x, rowEnd.y + this.trackRowSpacing));

    return hasChildren && this.isTrackExpanded(trackAsset);
  }

  private drawExpanderIcon (drawList: any, center: ImGui.Vec2, size: number, expanded: boolean, color: number): void {
    const half = size / 2;

    if (expanded) {
      drawList.AddTriangleFilled(
        new ImGui.Vec2(center.x - half, center.y - half * 0.6),
        new ImGui.Vec2(center.x + half, center.y - half * 0.6),
        new ImGui.Vec2(center.x, center.y + half),
        color
      );
    } else {
      drawList.AddTriangleFilled(
        new ImGui.Vec2(center.x - half, center.y - half),
        new ImGui.Vec2(center.x - half, center.y + half),
        new ImGui.Vec2(center.x + half, center.y),
        color
      );
    }
  }

  /**
   * 绘制轨道上的clips
   */
  private drawClips (trackAsset: TrackAsset) {
    const clips = trackAsset.getClips();
    const rowStartPos = ImGui.GetCursorScreenPos();
    const rowHeight = this.trackRowHeight;

    // 如果没有clips，不需要绘制任何东西，光标位置保持不变
    if (clips.length === 0) {
      return;
    }

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];

      // 计算clip的像素位置和大小
      const clipStartPixel = this.timeToPixel(clip.start);
      const clipWidth = clip.duration * this.pixelsPerSecond;
      const clipTop = rowStartPos.y + this.clipVerticalPadding;
      const clipBottom = rowStartPos.y + rowHeight - this.clipVerticalPadding;
      const clipHeight = Math.max(1, clipBottom - clipTop);

      // 设置clip的绝对位置，确保与轨道标签垂直居中对齐
      const clipPos = new ImGui.Vec2(rowStartPos.x + clipStartPixel, clipTop);
      const clipEndPos = new ImGui.Vec2(clipPos.x + clipWidth, clipBottom);
      const innerStartX = clipPos.x + 2;
      const innerEndX = clipEndPos.x - 2;
      const innerWidth = Math.max(0, innerEndX - innerStartX);

      // 绘制clip背景
      const drawList = ImGui.GetWindowDrawList();

      // 根据 endBehavior 获取 clip 颜色
      const endBehaviorColor = this.getEndBehaviorColor(clip.endBehavior);
      const clipColor = ImGui.GetColorU32(endBehaviorColor);
      const borderColor = ImGui.GetColorU32(this.clipBorderColor);
      const cornerRadius = Math.min(this.clipCornerRadiusMax, Math.min(clipHeight, clipWidth) * 0.25);

      drawList.AddRectFilled(clipPos, clipEndPos, clipColor, cornerRadius);
      drawList.AddRect(clipPos, clipEndPos, borderColor, cornerRadius);

      // 临时设置光标位置用于创建交互区域
      ImGui.SetCursorScreenPos(clipPos);

      // 创建不可见按钮用于交互
      const clipId = `##clip_${trackAsset.getInstanceId()}_${i}`;

      ImGui.PushID(clipId);
      if (ImGui.InvisibleButton('clip', new ImGui.Vec2(clipWidth, clipHeight))) {
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

        drawList.AddRectFilled(clipPos, clipEndPos, clipHoverColor, cornerRadius);

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
        clipPos.y + (clipHeight - textSize.y) / 2
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

    // 绘制时间游标线（与手柄同色）
    drawList.AddLine(
      new ImGui.Vec2(this.timeCursorPositionX, trackAreaStartPos.y),
      new ImGui.Vec2(this.timeCursorPositionX, cursorEndY),
      ImGui.GetColorU32(this.cursorColor),
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