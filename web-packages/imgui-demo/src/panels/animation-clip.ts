import type {
  AnimationCurve, PositionAnimationCurve, RotationAnimationCurve,
  EulerAnimationCurve, ScaleAnimationCurve, FloatAnimationCurve, ColorAnimationCurve,
} from '@galacean/effects';
import { AnimationClip } from '@galacean/effects';
import { editorWindow, menuItem } from '../core/decorators';
import { Selection } from '../core/selection';
import { ImGui } from '../imgui';
import { EditorWindow } from './editor-window';
import { COLORS, LAYOUT } from './sequencer/theme';

// ── 常量 ─────────────────────────────────────────────────────────

const CHANNEL_COLORS = {
  x: COLORS.channelX,
  y: COLORS.channelY,
  z: COLORS.channelZ,
  w: new ImGui.Vec4(0.8, 0.6, 0.2, 1.0),
  r: new ImGui.Vec4(0.9, 0.25, 0.25, 1.0),
  g: new ImGui.Vec4(0.25, 0.8, 0.25, 1.0),
  b: new ImGui.Vec4(0.3, 0.45, 0.95, 1.0),
  a: new ImGui.Vec4(0.7, 0.7, 0.7, 1.0),
  scalar: COLORS.channelDefault,
};

const COMPONENT_COLORS: Record<string, ImGui.Vec4> = {
  Transform:  new ImGui.Vec4(0.95, 0.45, 0.15, 1.0),
  default:    new ImGui.Vec4(0.50, 0.60, 0.75, 1.0),
};

const CURVE_ROW_HEIGHT = LAYOUT.curveRowHeight;
const SAMPLE_COUNT = 128;

// ── 轨道数据模型 ─────────────────────────────────────────────────

/** 最底层：单通道属性（如 Position.X） */
interface ChannelTrack {
  label: string,
  color: ImGui.Vec4,
  /** 采样函数：给定归一化时间 [0, duration]，返回标量值 */
  sample: (time: number) => number,
  /** 关键帧时间点列表 */
  keyframeTimes: number[],
}

/** 中间层：属性组（如 Position，包含 X/Y/Z 通道） */
interface PropertyTrack {
  label: string,
  channels: ChannelTrack[],
}

/** 组件层：如 Transform */
interface ComponentTrack {
  label: string,
  color: ImGui.Vec4,
  properties: PropertyTrack[],
}

/** 顶层：元素（按 path 分组） */
interface ElementTrack {
  path: string,
  displayName: string,
  components: ComponentTrack[],
}

// ── 面板状态 ──────────────────────────────────────────────────────

/** 时间轴左侧留白像素，防止 0ms 关键帧被裁切 */
const TIMELINE_LEFT_PAD = 8;

class ClipPanelState {
  currentTime = 0;
  /** 可见时间范围 */
  timelineStart = 0;
  timelineEnd = 1;
  /** clip 总时长（用于 clamp） */
  clipDuration = 1;

  isPlaying = false;
  lastFrameMs = 0;

  labelWidth = 220;
  expandedElements = new Set<string>();
  expandedComponents = new Set<string>();
  expandedProperties = new Set<string>();
  expandedCurves = new Set<string>();

  /** 中键拖拽：上一帧鼠标 X（增量模式） */
  isPanning = false;
  lastPanMouseX = 0;

  /** 左右面板垂直滚动同步（由左侧 Labels 驱动） */
  syncScrollY = 0;
}

// ── 面板主体 ──────────────────────────────────────────────────────

@editorWindow()
export class AnimationClipPanel extends EditorWindow {
  private state = new ClipPanelState();
  private cachedTracks: ElementTrack[] = [];
  private cachedClipId = '';
  /** 缓存上一次有效的 AnimationClip，选中其他资源时不切换 */
  private lastValidClip: AnimationClip | null = null;

  @menuItem('Window/Animation Clip')
  static showWindow () {
    EditorWindow.getWindow(AnimationClipPanel).open();
  }

  constructor () {
    super();
    this.title = 'Animation Clip';
    this.open();
  }

  override onGUI () {
    const clip = this.getActiveClip();

    if (!clip) {
      this.drawEmptyState();

      return;
    }

    this.rebuildTracksIfNeeded(clip);
    const maxKeyTime = this.getMaxKeyframeTime();
    // 展示时长优先按最后一个关键帧位置，留 10% 余量方便查看
    const displayDur = maxKeyTime > 0 ? maxKeyTime * 1.1 : Math.max(0.01, clip.duration);

    this.state.clipDuration = Math.max(0.01, clip.duration, maxKeyTime);
    // 仅在首次或 clip 切换时重置时间轴范围
    if (this.state.timelineEnd <= 0.01) {
      this.state.timelineEnd = displayDur;
    }
    this.updatePlayback(clip);

    // 控制栏
    this.drawControlBar(clip);

    // 主体：左标签 + 右时间轴/曲线
    this.drawBody(clip);
  }

  // ── 选中（仅在选中 AnimationClip 时切换，其他资源保持不变）────────

  private getActiveClip (): AnimationClip | null {
    for (const obj of Selection.getSelectedObjects()) {
      if (obj instanceof AnimationClip) {
        this.lastValidClip = obj;

        return obj;
      }
    }

    // 选中的不是 AnimationClip，保持上一次的
    return this.lastValidClip;
  }

  // ── 空状态 ────────────────────────────────────────────────────────

  private drawEmptyState (): void {
    const avail = ImGui.GetContentRegionAvail();
    const dl = ImGui.GetWindowDrawList();
    const pos = ImGui.GetCursorScreenPos();

    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + avail.x, pos.y + avail.y), ImGui.GetColorU32(COLORS.curveCanvasBg));
    const text = 'Select an Animation Clip';
    const ts = ImGui.CalcTextSize(text);

    ImGui.SetCursorPos(new ImGui.Vec2((avail.x - ts.x) / 2, (avail.y - ts.y) / 2));
    ImGui.TextColored(new ImGui.Vec4(0.4, 0.4, 0.4, 1), text);
  }

  // ── 播放 ──────────────────────────────────────────────────────────

  private updatePlayback (clip: AnimationClip): void {
    if (!this.state.isPlaying || clip.duration <= 0) { return; }
    const now = performance.now();

    if (this.state.lastFrameMs > 0) {
      this.state.currentTime += (now - this.state.lastFrameMs) / 1000;
      if (this.state.currentTime > clip.duration) {
        this.state.currentTime %= clip.duration;
      }
    }
    this.state.lastFrameMs = now;
  }

  // ══════════════════════════════════════════════════════════════════
  //  数据模型构建：元素 → 组件 → 属性 → 通道
  // ══════════════════════════════════════════════════════════════════

  private rebuildTracksIfNeeded (clip: AnimationClip): void {
    const clipId = clip.getInstanceId();

    if (clipId === this.cachedClipId) { return; }
    this.cachedClipId = clipId;
    this.cachedTracks = this.buildElementTracks(clip);

    // clip 切换时重置时间轴，让 onGUI 按关键帧最大时间重新计算
    this.state.timelineStart = 0;
    this.state.timelineEnd = 0;
    this.state.currentTime = 0;

    // 默认展开所有元素、组件和属性
    this.state.expandedElements.clear();
    this.state.expandedComponents.clear();
    this.state.expandedProperties.clear();
    for (const el of this.cachedTracks) {
      this.state.expandedElements.add(el.path);
      for (const comp of el.components) {
        const compKey = `${el.path}/${comp.label}`;

        this.state.expandedComponents.add(compKey);
        for (const prop of comp.properties) {
          this.state.expandedProperties.add(`${compKey}/${prop.label}`);
        }
      }
    }
  }

  private buildElementTracks (clip: AnimationClip): ElementTrack[] {
    // 按 path 分组所有曲线
    const elementMap = new Map<string, {
      transformProps: PropertyTrack[],
      customComponents: Map<string, PropertyTrack[]>,
    }>();

    const ensureElement = (path: string) => {
      if (!elementMap.has(path)) {
        elementMap.set(path, { transformProps: [], customComponents: new Map() });
      }

      return elementMap.get(path)!;
    };

    // Position 曲线 → Transform 组件
    for (const curve of clip.positionCurves) {
      const el = ensureElement(curve.path);

      el.transformProps.push(this.buildVec3Property('Position', curve.keyFrames));
    }

    // Rotation 曲线 → Transform 组件
    for (const curve of clip.rotationCurves) {
      const el = ensureElement(curve.path);

      el.transformProps.push(this.buildVec4Property('Rotation', curve.keyFrames));
    }

    // Euler 曲线 → Transform 组件
    for (const curve of clip.eulerCurves) {
      const el = ensureElement(curve.path);

      el.transformProps.push(this.buildVec3Property('Euler', curve.keyFrames));
    }

    // Scale 曲线 → Transform 组件
    for (const curve of clip.scaleCurves) {
      const el = ensureElement(curve.path);

      el.transformProps.push(this.buildVec3Property('Scale', curve.keyFrames));
    }

    // Float 曲线 → className 组件
    for (const curve of clip.floatCurves) {
      const el = ensureElement(curve.path);
      const compName = curve.className || 'Custom';

      if (!el.customComponents.has(compName)) {
        el.customComponents.set(compName, []);
      }
      el.customComponents.get(compName)!.push(this.buildScalarProperty(curve.property, curve.keyFrames));
    }

    // Color 曲线 → className 组件
    for (const curve of clip.colorCurves) {
      const el = ensureElement(curve.path);
      const compName = curve.className || 'Custom';

      if (!el.customComponents.has(compName)) {
        el.customComponents.set(compName, []);
      }
      el.customComponents.get(compName)!.push(this.buildColorProperty(curve.property, curve.keyFrames));
    }

    // 组装 ElementTrack[]
    const result: ElementTrack[] = [];

    for (const [path, data] of elementMap) {
      const components: ComponentTrack[] = [];

      if (data.transformProps.length > 0) {
        components.push({
          label: 'Transform',
          color: COMPONENT_COLORS.Transform,
          properties: data.transformProps,
        });
      }

      for (const [compName, props] of data.customComponents) {
        components.push({
          label: compName,
          color: COMPONENT_COLORS.default,
          properties: props,
        });
      }

      // 取 path 最后一段作为显示名（支持 "." 和 "/" 分隔符）
      const separator = path.includes('/') ? '/' : '.';
      const segments = path.split(separator);
      const displayName = segments[segments.length - 1] || '(root)';

      result.push({ path, displayName, components });
    }

    return result;
  }

  /** 从 Vector3Curve 构建 Position/Euler/Scale 属性（3 通道） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildVec3Property (label: string, keyFrames: any): PropertyTrack {
    const channels: ChannelTrack[] = [];
    const labels = ['X', 'Y', 'Z'];
    const colors = [CHANNEL_COLORS.x, CHANNEL_COLORS.y, CHANNEL_COLORS.z];
    const accessors = ['x', 'y', 'z'];

    for (let i = 0; i < 3; i++) {
      const accessor = accessors[i];

      channels.push({
        label: labels[i],
        color: colors[i],
        sample: (t: number) => {
          const val = keyFrames.getValue(t);

          return val ? val[accessor] : 0;
        },
        keyframeTimes: this.extractKeyframeTimes(keyFrames, i),
      });
    }

    return { label, channels };
  }

  /** 从 Vector4Curve / BezierCurveQuat 构建 Rotation 属性（4 通道） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildVec4Property (label: string, keyFrames: any): PropertyTrack {
    const channels: ChannelTrack[] = [];
    const labels = ['X', 'Y', 'Z', 'W'];
    const colors = [CHANNEL_COLORS.x, CHANNEL_COLORS.y, CHANNEL_COLORS.z, CHANNEL_COLORS.w];
    const accessors = ['x', 'y', 'z', 'w'];

    for (let i = 0; i < 4; i++) {
      const accessor = accessors[i];

      channels.push({
        label: labels[i],
        color: colors[i],
        sample: (t: number) => {
          const val = keyFrames.getValue(t);

          return val ? val[accessor] : 0;
        },
        keyframeTimes: this.extractKeyframeTimes(keyFrames, i),
      });
    }

    return { label, channels };
  }

  /** 从 BezierCurve 构建标量属性（1 通道） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildScalarProperty (label: string, keyFrames: any): PropertyTrack {
    return {
      label,
      channels: [{
        label,
        color: CHANNEL_COLORS.scalar,
        sample: (t: number) => keyFrames.getValue(t) ?? 0,
        keyframeTimes: this.extractBezierKeyframeTimes(keyFrames),
      }],
    };
  }

  /** 从 ColorCurve 构建颜色属性（4 通道 RGBA） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildColorProperty (label: string, keyFrames: any): PropertyTrack {
    const channels: ChannelTrack[] = [];
    const labels = ['R', 'G', 'B', 'A'];
    const colors = [CHANNEL_COLORS.r, CHANNEL_COLORS.g, CHANNEL_COLORS.b, CHANNEL_COLORS.a];
    const accessors = ['r', 'g', 'b', 'a'];

    for (let i = 0; i < 4; i++) {
      const accessor = accessors[i];

      channels.push({
        label: labels[i],
        color: colors[i],
        sample: (t: number) => {
          const val = keyFrames.getValue(t);

          return val ? val[accessor] : 0;
        },
        keyframeTimes: this.extractKeyframeTimes(keyFrames, i),
      });
    }

    return { label, channels };
  }

  /** 从复合曲线中提取第 channelIndex 个子曲线的关键帧时间 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractKeyframeTimes (keyFrames: any, channelIndex: number): number[] {
    // 策略1：尝试通过 private 属性访问子曲线（TS private 在 JS 运行时可能可访问）
    const curveNameSets = [
      ['xCurve', 'yCurve', 'zCurve', 'wCurve'],
      ['rCurve', 'gCurve', 'bCurve', 'aCurve'],
    ];

    for (const names of curveNameSets) {
      if (channelIndex >= names.length) { continue; }
      const subCurve = keyFrames[names[channelIndex]];

      if (subCurve) {
        const times = this.extractBezierKeyframeTimes(subCurve);

        if (times.length > 0) { return times; }
      }
    }

    // 策略2：如果 keyFrames 本身就是 BezierCurve（floatCurves 的情况）
    const directTimes = this.extractBezierKeyframeTimes(keyFrames);

    if (directTimes.length > 0) { return directTimes; }

    // 策略3：通过 getMaxTime 返回首尾
    const maxTime = keyFrames.getMaxTime?.() ?? 0;

    return maxTime > 0 ? [0, maxTime] : [0];
  }

  /** 从 BezierCurve 提取关键帧时间点（优先用 curveMap，其次用 keys） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractBezierKeyframeTimes (bezierCurve: any): number[] {
    if (!bezierCurve) { return []; }

    const times = new Set<number>();

    // 策略 A：从 curveMap 提取（公开属性，最可靠）
    // curveMap 的 key 格式是 "timeStart&timeEnd"
    if (bezierCurve.curveMap && typeof bezierCurve.curveMap === 'object') {
      for (const mapKey of Object.keys(bezierCurve.curveMap)) {
        const parts = mapKey.split('&');

        if (parts.length === 2) {
          const startTime = parseFloat(parts[0]);
          const endTime = parseFloat(parts[1]);

          if (isFinite(startTime)) { times.add(startTime); }
          if (isFinite(endTime)) { times.add(endTime); }
        }
      }
    }

    // 策略 B：从 curveInfos 提取（可能是 private，但运行时可能可访问）
    if (times.size === 0 && Array.isArray(bezierCurve.curveInfos)) {
      for (const info of bezierCurve.curveInfos) {
        if (isFinite(info.timeStart)) { times.add(info.timeStart); }
        if (isFinite(info.timeEnd)) { times.add(info.timeEnd); }
      }
    }

    // 策略 C：从 keys 数组提取
    if (times.size === 0 && Array.isArray(bezierCurve.keys) && bezierCurve.keys.length > 0) {
      // keys 每两个一组 [startPoint, endPoint]，每个是 [x, y, cx, cy]
      for (let i = 0; i < bezierCurve.keys.length; i += 2) {
        const key = bezierCurve.keys[i];

        if (key && key.length >= 1 && isFinite(key[0])) {
          times.add(key[0]);
        }
      }
      // 最后一个终点
      const lastKey = bezierCurve.keys[bezierCurve.keys.length - 1];

      if (lastKey && lastKey.length >= 1 && isFinite(lastKey[0])) {
        times.add(lastKey[0]);
      }
    }

    // 策略 D：从 keyFrames 数组提取（private，但运行时可能可访问）
    if (times.size === 0 && Array.isArray(bezierCurve.keyFrames)) {
      for (const kf of bezierCurve.keyFrames) {
        if (kf && isFinite(kf.time)) {
          times.add(kf.time);
        }
      }
    }

    return Array.from(times).sort((a, b) => a - b);
  }

  // ══════════════════════════════════════════════════════════════════
  //  控制栏
  // ══════════════════════════════════════════════════════════════════

  private drawControlBar (clip: AnimationClip): void {
    const barH = LAYOUT.sectionHeight + 4;
    const dl = ImGui.GetWindowDrawList();
    const origin = ImGui.GetCursorScreenPos();
    const contentW = ImGui.GetContentRegionAvail().x;

    dl.AddRectFilled(origin, new ImGui.Vec2(origin.x + contentW, origin.y + barH), ImGui.GetColorU32(COLORS.header));
    dl.AddLine(
      new ImGui.Vec2(origin.x, origin.y + barH),
      new ImGui.Vec2(origin.x + contentW, origin.y + barH),
      ImGui.GetColorU32(COLORS.trackSeparator), 1,
    );

    const btnSize = 20;
    const btnY = origin.y + (barH - btnSize) / 2;
    let btnX = origin.x + 8;

    // 跳转到开头
    this.controlButton('GoToStart', btnX, btnY, btnSize, dl,
      (cx, cy, s, col) => {
        dl.AddLine(new ImGui.Vec2(cx - s * 1.2, cy - s), new ImGui.Vec2(cx - s * 1.2, cy + s), col, 1.5);
        dl.AddTriangleFilled(new ImGui.Vec2(cx + s, cy - s), new ImGui.Vec2(cx - s * 0.5, cy), new ImGui.Vec2(cx + s, cy + s), col);
      },
      () => { this.state.currentTime = 0; this.state.isPlaying = false; this.state.lastFrameMs = 0; },
    );
    btnX += btnSize + 4;

    // 播放/暂停
    const playing = this.state.isPlaying;

    this.controlButton('PlayPause', btnX, btnY, btnSize, dl,
      (cx, cy, s, col) => {
        if (playing) {
          dl.AddRectFilled(new ImGui.Vec2(cx - s * 1.1, cy - s), new ImGui.Vec2(cx - s * 0.3, cy + s), col);
          dl.AddRectFilled(new ImGui.Vec2(cx + s * 0.3, cy - s), new ImGui.Vec2(cx + s * 1.1, cy + s), col);
        } else {
          dl.AddTriangleFilled(new ImGui.Vec2(cx - s * 0.7, cy - s * 1.1), new ImGui.Vec2(cx + s * 1.1, cy), new ImGui.Vec2(cx - s * 0.7, cy + s * 1.1), col);
        }
      },
      () => { this.state.isPlaying = !this.state.isPlaying; this.state.lastFrameMs = this.state.isPlaying ? performance.now() : 0; },
    );
    btnX += btnSize + 4;

    // 停止
    this.controlButton('Stop', btnX, btnY, btnSize, dl,
      (cx, cy, s, col) => { dl.AddRectFilled(new ImGui.Vec2(cx - s, cy - s), new ImGui.Vec2(cx + s, cy + s), col); },
      () => { this.state.isPlaying = false; this.state.currentTime = 0; this.state.lastFrameMs = 0; },
    );
    btnX += btnSize + 16;

    // 时间文字
    dl.AddText(
      new ImGui.Vec2(btnX, origin.y + (barH - ImGui.GetFontSize()) / 2),
      ImGui.GetColorU32(COLORS.trackText),
      `${this.fmtTime(this.state.currentTime)} / ${this.fmtTime(clip.duration)}`,
    );

    // 右侧 Clip 名称
    const name = this.getClipName(clip);
    const nameW = ImGui.CalcTextSize(name);

    dl.AddText(
      new ImGui.Vec2(origin.x + contentW - nameW.x - 12, origin.y + (barH - nameW.y) / 2),
      ImGui.GetColorU32(COLORS.timelineText), name,
    );

    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + barH));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));
    ImGui.Dummy(new ImGui.Vec2(0, 0));
    ImGui.PopStyleVar();
  }

  private controlButton (
    id: string, x: number, y: number, size: number, dl: any,
    drawIcon: (cx: number, cy: number, s: number, col: number) => void,
    onClick: () => void,
  ): void {
    ImGui.SetCursorScreenPos(new ImGui.Vec2(x, y));
    ImGui.PushID(id);
    if (ImGui.InvisibleButton(`##${id}`, new ImGui.Vec2(size, size))) { onClick(); }
    const hovered = ImGui.IsItemHovered();
    const col = ImGui.GetColorU32(hovered ? COLORS.trackTextSelected : COLORS.trackText);

    drawIcon(x + size / 2, y + size / 2, size * 0.2, col);
    ImGui.PopID();
  }

  // ══════════════════════════════════════════════════════════════════
  //  主体区域
  // ══════════════════════════════════════════════════════════════════

  private drawBody (clip: AnimationClip): void {
    const st = this.state;
    const leftW = st.labelWidth;
    const splitter = 2;
    const totalW = ImGui.GetContentRegionAvail().x;
    const rightW = totalW - leftW - splitter;
    const dl = ImGui.GetWindowDrawList();
    const timelineH = LAYOUT.sectionHeight;
    const bodyStartY = ImGui.GetCursorScreenPos().y;

    // ── 标题行 ──
    // 左：Curves
    if (ImGui.BeginChild('LabelHeader', new ImGui.Vec2(leftW, timelineH), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar)) {
      const p = ImGui.GetCursorScreenPos();

      dl.AddRectFilled(p, new ImGui.Vec2(p.x + leftW, p.y + timelineH), ImGui.GetColorU32(COLORS.trackLabelBg));
      dl.AddText(new ImGui.Vec2(p.x + 8, p.y + (timelineH - ImGui.GetFontSize()) / 2), ImGui.GetColorU32(COLORS.trackText), 'Curves');
    }
    ImGui.EndChild();

    ImGui.SameLine();
    this.drawSplitter(dl, splitter, timelineH);
    ImGui.SameLine();

    // 记录右侧区域起始 X
    const rightAreaX = ImGui.GetCursorScreenPos().x;

    // 右：时间轴标尺
    if (ImGui.BeginChild('RulerArea', new ImGui.Vec2(rightW, timelineH), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar)) {
      this.drawRuler(rightW, timelineH);
    }
    ImGui.EndChild();

    // ── 轨道行 ──
    const bodyH = ImGui.GetContentRegionAvail().y;

    // 左侧标签（保留垂直滚动条）
    if (ImGui.BeginChild('Labels', new ImGui.Vec2(leftW, bodyH), ImGui.ChildFlags.None)) {
      this.drawLabels(clip);
      st.syncScrollY = ImGui.GetScrollY();
    }
    ImGui.EndChild();

    ImGui.SameLine();
    this.drawSplitter(dl, splitter, bodyH);
    ImGui.SameLine();

    // 右侧画布（隐藏滚动条 + 禁用鼠标滚轮滚动，由左侧驱动同步）
    if (ImGui.BeginChild('Canvas', new ImGui.Vec2(rightW, bodyH), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse)) {
      ImGui.SetScrollY(st.syncScrollY);
      this.drawCanvas(clip, rightW);
    }
    ImGui.EndChild();

    // ── 游标线：用 ForegroundDrawList 绘制，确保在所有子窗口之上 ──
    const pps = this.calcPps(rightW);
    const cursorX = rightAreaX + this.timeToPx(st.currentTime, pps);
    const totalH = timelineH + bodyH;
    const fgDl = ImGui.GetForegroundDrawList();

    if (cursorX >= rightAreaX && cursorX <= rightAreaX + rightW) {
      fgDl.AddLine(
        new ImGui.Vec2(cursorX, bodyStartY),
        new ImGui.Vec2(cursorX, bodyStartY + totalH),
        ImGui.GetColorU32(COLORS.cursor), 1,
      );
    }
  }

  private drawSplitter (dl: any, width: number, height: number): void {
    const p = ImGui.GetCursorScreenPos();

    dl.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + height), ImGui.GetColorU32(COLORS.trackRowDivider));
    ImGui.Dummy(new ImGui.Vec2(width, height));
  }

  // ══════════════════════════════════════════════════════════════════
  //  时间轴标尺（自己实现，不依赖 SequencerState）
  // ══════════════════════════════════════════════════════════════════

  /** 时间 → 像素 X 偏移（相对于画布左边界） */
  private timeToPx (time: number, pps: number): number {
    return TIMELINE_LEFT_PAD + (time - this.state.timelineStart) * pps;
  }

  /** 像素 X 偏移 → 时间 */
  private pxToTime (px: number, pps: number): number {
    return this.state.timelineStart + (px - TIMELINE_LEFT_PAD) / pps;
  }

  /** 计算 pixels-per-second（扣除左侧 padding） */
  private calcPps (width: number): number {
    const duration = this.state.timelineEnd - this.state.timelineStart;

    return (width - TIMELINE_LEFT_PAD) / Math.max(1e-6, duration);
  }

  private drawRuler (width: number, height: number): void {
    const st = this.state;
    const dl = ImGui.GetWindowDrawList();
    const origin = ImGui.GetCursorScreenPos();
    const pps = this.calcPps(width);

    // 背景
    dl.AddRectFilled(origin, new ImGui.Vec2(origin.x + width, origin.y + height), ImGui.GetColorU32(COLORS.timelineBg));

    // 刻度
    const duration = st.timelineEnd - st.timelineStart;
    const step = this.niceStep(duration / Math.max(1, width / 80));
    const subStep = step / 5;
    const firstTick = Math.ceil(st.timelineStart / subStep) * subStep;

    for (let t = firstTick; t <= st.timelineEnd + 1e-9; t += subStep) {
      const x = origin.x + this.timeToPx(t, pps);

      if (x < origin.x || x > origin.x + width) { continue; }

      const isMajor = Math.abs(t / step - Math.round(t / step)) < 0.01;

      if (isMajor) {
        dl.AddLine(new ImGui.Vec2(x, origin.y + height * 0.3), new ImGui.Vec2(x, origin.y + height), ImGui.GetColorU32(COLORS.timelineLine), 1);
        const label = this.fmtTimeShort(t);

        dl.AddText(new ImGui.Vec2(x + 3, origin.y + 1), ImGui.GetColorU32(COLORS.timelineText), label);
      } else {
        dl.AddLine(new ImGui.Vec2(x, origin.y + height * 0.65), new ImGui.Vec2(x, origin.y + height), ImGui.GetColorU32(new ImGui.Vec4(0.35, 0.35, 0.35, 0.6)), 1);
      }
    }

    // 游标手柄（线由 drawBody 最外层统一绘制）
    const cursorX = origin.x + this.timeToPx(st.currentTime, pps);

    dl.AddRectFilled(
      new ImGui.Vec2(cursorX - 5, origin.y + 2),
      new ImGui.Vec2(cursorX + 5, origin.y + 16),
      ImGui.GetColorU32(COLORS.cursor), 3,
    );

    // 交互：点击/拖拽标尺（snap 到 0.001 间隔）
    ImGui.SetCursorScreenPos(origin);
    ImGui.InvisibleButton('##ruler', new ImGui.Vec2(width, height));
    if (ImGui.IsItemActive()) {
      const mx = ImGui.GetMousePos().x - origin.x;
      const rawTime = this.pxToTime(mx, pps);
      const snapped = Math.round(rawTime * 1000) / 1000;

      st.currentTime = Math.max(st.timelineStart, Math.min(st.timelineEnd, snapped));
    }

    // 滚轮缩放
    if (ImGui.IsItemHovered()) {
      this.handleWheelZoom(width);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  左侧标签
  // ══════════════════════════════════════════════════════════════════

  private drawLabels (clip: AnimationClip): void {
    const dl = ImGui.GetWindowDrawList();
    const w = ImGui.GetContentRegionAvail().x;
    const bgPos = ImGui.GetCursorScreenPos();

    dl.AddRectFilled(bgPos, new ImGui.Vec2(bgPos.x + w, bgPos.y + 10000), ImGui.GetColorU32(COLORS.trackLabelBg));
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));

    for (const el of this.cachedTracks) {
      this.drawElementLabel(el, w);
    }

    // 事件
    if (clip.events.length > 0) {
      this.drawSectionRow(dl, w, 'Events', 'events', new ImGui.Vec4(1, 0.2, 0.2, 1), clip.events.length, null);
      for (let i = 0; i < clip.events.length; i++) {
        const evt = clip.events[i];

        this.drawChannelRow(dl, w, `${evt.name || 'Event ' + i}  @ ${this.fmtTime(evt.startTime)}`, new ImGui.Vec4(1, 0.2, 0.2, 0.8), i);
      }
    }

    ImGui.PopStyleVar(1);
  }

  private drawElementLabel (el: ElementTrack, width: number): void {
    const dl = ImGui.GetWindowDrawList();
    const st = this.state;
    const expanded = st.expandedElements.has(el.path);

    this.drawSectionRow(dl, width, el.displayName, `el_${el.path}`, new ImGui.Vec4(0.9, 0.9, 0.9, 1), null, () => {
      if (expanded) { st.expandedElements.delete(el.path); } else { st.expandedElements.add(el.path); }
    }, expanded, 0);

    if (!expanded) { return; }

    for (const comp of el.components) {
      this.drawComponentLabel(el, comp, width);
    }
  }

  private drawComponentLabel (el: ElementTrack, comp: ComponentTrack, width: number): void {
    const dl = ImGui.GetWindowDrawList();
    const st = this.state;
    const compKey = `${el.path}/${comp.label}`;
    const expanded = st.expandedComponents.has(compKey);

    this.drawSectionRow(dl, width, comp.label, `comp_${compKey}`, comp.color, null, () => {
      if (expanded) { st.expandedComponents.delete(compKey); } else { st.expandedComponents.add(compKey); }
    }, expanded, 1);

    if (!expanded) { return; }

    for (const prop of comp.properties) {
      this.drawPropertyLabel(el, comp, prop, width);
    }
  }

  private drawPropertyLabel (el: ElementTrack, comp: ComponentTrack, prop: PropertyTrack, width: number): void {
    const dl = ImGui.GetWindowDrawList();
    const propKey = `${el.path}/${comp.label}/${prop.label}`;

    // 属性行（不可展开）
    this.drawSectionRow(dl, width, prop.label, `prop_${propKey}`, comp.color, null, null, false, 2);

    // 直接平铺所有通道（带实时值）
    const currentTime = this.state.currentTime;

    for (let i = 0; i < prop.channels.length; i++) {
      const ch = prop.channels[i];

      this.drawChannelRow(dl, width, ch.label, ch.color, i, ch.sample(currentTime));
    }
  }

  /** 绘制 section 行（元素/组件/属性级别） */
  private drawSectionRow (
    dl: any, width: number, label: string, id: string,
    color: ImGui.Vec4, count: number | null,
    onClick: (() => void) | null = null, expanded = false, indent = 0,
  ): void {
    const h = LAYOUT.sectionHeight;
    const pos = ImGui.GetCursorScreenPos();
    const indentPx = indent * LAYOUT.trackIndentWidth;

    // 背景
    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(indent === 0 ? COLORS.headerAlt : COLORS.trackLabelBg));

    // 左侧色条
    dl.AddRectFilled(new ImGui.Vec2(pos.x, pos.y), new ImGui.Vec2(pos.x + 3, pos.y + h), ImGui.GetColorU32(color));

    // 展开三角
    if (onClick) {
      const tx = pos.x + 10 + indentPx;
      const ty = pos.y + h / 2;
      const s = LAYOUT.expanderIconSize * 0.35;

      if (expanded) {
        dl.AddTriangleFilled(new ImGui.Vec2(tx - s, ty - s * 0.6), new ImGui.Vec2(tx + s, ty - s * 0.6), new ImGui.Vec2(tx, ty + s * 0.6), ImGui.GetColorU32(COLORS.trackText));
      } else {
        dl.AddTriangleFilled(new ImGui.Vec2(tx - s * 0.6, ty - s), new ImGui.Vec2(tx + s * 0.6, ty), new ImGui.Vec2(tx - s * 0.6, ty + s), ImGui.GetColorU32(COLORS.trackText));
      }
    }

    // 文字
    const textX = pos.x + (onClick ? 22 : 10) + indentPx;
    const displayLabel = count !== null ? `${label} (${count})` : label;

    dl.AddText(new ImGui.Vec2(textX, pos.y + (h - ImGui.GetFontSize()) / 2), ImGui.GetColorU32(COLORS.trackText), displayLabel);

    // 分割线
    dl.AddLine(new ImGui.Vec2(pos.x, pos.y + h), new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.trackSeparator), 1);

    // 交互
    ImGui.SetCursorScreenPos(pos);
    ImGui.InvisibleButton(`##${id}`, new ImGui.Vec2(width, h));
    if (onClick && ImGui.IsItemClicked()) { onClick(); }
  }

  /** 绘制通道行（最底层，如 X/Y/Z）— 色点+标签+实时值 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawChannelRow (
    dl: any, width: number, label: string, color: ImGui.Vec4, index: number,
    currentValue?: number,
  ): void {
    const h = LAYOUT.channelHeight;
    const pos = ImGui.GetCursorScreenPos();
    const isAlt = index % 2 === 1;
    const indent = LAYOUT.trackIndentWidth * 3;

    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(isAlt ? COLORS.trackLabelBgAlt : COLORS.trackLabelBg));

    // 色点
    dl.AddCircleFilled(new ImGui.Vec2(pos.x + indent + 12, pos.y + h / 2), 3, ImGui.GetColorU32(color), 8);

    // 标签
    dl.AddText(
      new ImGui.Vec2(pos.x + indent + 22, pos.y + (h - ImGui.GetFontSize()) / 2),
      ImGui.GetColorU32(COLORS.trackText), label,
    );

    // 实时值（右对齐）
    if (currentValue !== undefined && isFinite(currentValue)) {
      const valueStr = Math.abs(currentValue) < 100 ? currentValue.toFixed(4) : currentValue.toFixed(2);
      const valueSize = ImGui.CalcTextSize(valueStr);
      const valueX = pos.x + width - valueSize.x - 8;

      dl.AddText(
        new ImGui.Vec2(valueX, pos.y + (h - ImGui.GetFontSize()) / 2),
        ImGui.GetColorU32(new ImGui.Vec4(0.7, 0.7, 0.7, 1)), valueStr,
      );
    }

    // 分割线
    dl.AddLine(new ImGui.Vec2(pos.x, pos.y + h), new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.trackRowDivider), 1);

    ImGui.SetCursorScreenPos(pos);
    ImGui.Dummy(new ImGui.Vec2(width, h));
  }

  // ══════════════════════════════════════════════════════════════════
  //  右侧画布
  // ══════════════════════════════════════════════════════════════════

  private drawCanvas (clip: AnimationClip, width: number): void {
    const st = this.state;
    const dl = ImGui.GetWindowDrawList();
    const canvasOrigin = ImGui.GetCursorScreenPos();
    const canvasH = ImGui.GetContentRegionAvail().y;
    const pps = this.calcPps(width);

    // 背景
    dl.AddRectFilled(canvasOrigin, new ImGui.Vec2(canvasOrigin.x + width, canvasOrigin.y + canvasH), ImGui.GetColorU32(COLORS.curveCanvasBg));

    // 垂直网格线
    this.drawVerticalGrid(dl, canvasOrigin, width, canvasH, pps);

    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));

    for (const el of this.cachedTracks) {
      this.drawElementCanvas(el, width, pps);
    }

    // 事件行
    if (clip.events.length > 0) {
      this.drawCanvasSectionRow(dl, width);
      for (let i = 0; i < clip.events.length; i++) {
        this.drawEventCanvasRow(dl, clip.events[i], width, pps, i);
      }
    }

    ImGui.PopStyleVar(1);

    // 滚轮缩放 & 中键拖拽
    ImGui.SetCursorScreenPos(canvasOrigin);
    ImGui.InvisibleButton('##canvasInteract', new ImGui.Vec2(width, canvasH));
    if (ImGui.IsItemHovered()) {
      this.handleWheelZoom(width);
      this.handleMiddleMousePan(width);
    }
  }

  private drawElementCanvas (el: ElementTrack, width: number, pps: number): void {
    const dl = ImGui.GetWindowDrawList();
    const expanded = this.state.expandedElements.has(el.path);

    this.drawCanvasSectionRow(dl, width);
    if (!expanded) { return; }

    for (const comp of el.components) {
      this.drawComponentCanvas(el, comp, width, pps);
    }
  }

  private drawComponentCanvas (el: ElementTrack, comp: ComponentTrack, width: number, pps: number): void {
    const dl = ImGui.GetWindowDrawList();
    const compKey = `${el.path}/${comp.label}`;
    const expanded = this.state.expandedComponents.has(compKey);

    this.drawCanvasSectionRow(dl, width);
    if (!expanded) { return; }

    for (const prop of comp.properties) {
      this.drawPropertyCanvas(el, comp, prop, width, pps);
    }
  }

  private drawPropertyCanvas (el: ElementTrack, comp: ComponentTrack, prop: PropertyTrack, width: number, pps: number): void {
    const dl = ImGui.GetWindowDrawList();

    // 属性 section 行：绘制所有通道的聚合关键帧菱形
    this.drawCanvasSectionRowWithKeyframes(dl, prop, width, pps);

    // 直接平铺所有通道
    for (let i = 0; i < prop.channels.length; i++) {
      this.drawCanvasChannelRow(dl, prop.channels[i], width, pps, i);
    }
  }

  /** 空的 section 行（右侧对应） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawCanvasSectionRow (dl: any, width: number): void {
    const h = LAYOUT.sectionHeight;
    const pos = ImGui.GetCursorScreenPos();

    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(new ImGui.Vec4(0.10, 0.10, 0.11, 1)));
    dl.AddLine(new ImGui.Vec2(pos.x, pos.y + h), new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.trackSeparator), 1);
    ImGui.SetCursorScreenPos(pos);
    ImGui.Dummy(new ImGui.Vec2(width, h));
  }

  /** 属性 section 行：带聚合关键帧菱形 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawCanvasSectionRowWithKeyframes (dl: any, prop: PropertyTrack, width: number, pps: number): void {
    const h = LAYOUT.sectionHeight;
    const pos = ImGui.GetCursorScreenPos();
    const st = this.state;

    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(new ImGui.Vec4(0.10, 0.10, 0.11, 1)));
    dl.AddLine(new ImGui.Vec2(pos.x, pos.y + h), new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.trackSeparator), 1);

    // 聚合所有通道的关键帧时间，绘制菱形
    const allTimes = new Set<number>();

    for (const ch of prop.channels) {
      for (const t of ch.keyframeTimes) { allTimes.add(t); }
    }

    const ks = LAYOUT.keySize * 0.8;
    const keyColor = ImGui.GetColorU32(COLORS.channelDefault);

    for (const t of allTimes) {
      const x = pos.x + this.timeToPx(t, pps);
      const y = pos.y + h / 2;

      if (x < pos.x - ks || x > pos.x + width + ks) { continue; }
      dl.AddQuadFilled(
        new ImGui.Vec2(x, y - ks), new ImGui.Vec2(x + ks, y),
        new ImGui.Vec2(x, y + ks), new ImGui.Vec2(x - ks, y), keyColor,
      );
    }

    ImGui.SetCursorScreenPos(pos);
    ImGui.Dummy(new ImGui.Vec2(width, h));
  }

  /** 通道行：绘制关键帧菱形（双层样式 + hover tooltip） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawCanvasChannelRow (dl: any, ch: ChannelTrack, width: number, pps: number, index: number): void {
    const h = LAYOUT.channelHeight;
    const pos = ImGui.GetCursorScreenPos();
    const st = this.state;
    const isAlt = index % 2 === 1;

    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(isAlt ? new ImGui.Vec4(0.09, 0.09, 0.10, 1) : new ImGui.Vec4(0.08, 0.08, 0.09, 1)));
    dl.AddLine(new ImGui.Vec2(pos.x, pos.y + h), new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.trackRowDivider), 1);

    const mousePos = ImGui.GetMousePos();
    const centerY = pos.y + h / 2;
    let hoveredTime = -1;

    // 绘制关键帧菱形（Sequencer 双层样式）
    for (const t of ch.keyframeTimes) {
      const x = pos.x + this.timeToPx(t, pps);

      if (x < pos.x - 10 || x > pos.x + width + 10) { continue; }

      const isHovered = Math.abs(mousePos.x - x) <= LAYOUT.keySize + 4
        && Math.abs(mousePos.y - centerY) <= LAYOUT.keySize + 4;

      if (isHovered) { hoveredTime = t; }

      this.drawKeyframeDiamond(dl, x, centerY, ch.color, isHovered);
    }

    // Hover tooltip
    if (hoveredTime >= 0) {
      const value = ch.sample(hoveredTime);

      ImGui.BeginTooltip();
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, ch.color);
      ImGui.Text(ch.label);
      ImGui.PopStyleColor();
      ImGui.Separator();
      ImGui.Text(`Time: ${this.fmtTime(hoveredTime)}`);
      ImGui.Text(`Value: ${value.toFixed(4)}`);
      ImGui.EndTooltip();
    }

    ImGui.SetCursorScreenPos(pos);
    ImGui.Dummy(new ImGui.Vec2(width, h));
  }

  /** 事件行：绘制事件菱形和持续时间条（双层样式 + hover tooltip） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawEventCanvasRow (dl: any, evt: { name: string, startTime: number, duration: number }, width: number, pps: number, index: number): void {
    const h = LAYOUT.channelHeight;
    const pos = ImGui.GetCursorScreenPos();
    const st = this.state;
    const isAlt = index % 2 === 1;
    const evtColor = new ImGui.Vec4(1, 0.2, 0.2, 1);

    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(isAlt ? new ImGui.Vec4(0.09, 0.09, 0.10, 1) : new ImGui.Vec4(0.08, 0.08, 0.09, 1)));
    dl.AddLine(new ImGui.Vec2(pos.x, pos.y + h), new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.trackRowDivider), 1);

    const evtX = pos.x + this.timeToPx(evt.startTime, pps);
    const evtY = pos.y + h / 2;
    const mousePos = ImGui.GetMousePos();
    const isHovered = Math.abs(mousePos.x - evtX) <= LAYOUT.keySize + 4
      && Math.abs(mousePos.y - evtY) <= LAYOUT.keySize + 4;

    this.drawKeyframeDiamond(dl, evtX, evtY, evtColor, isHovered);

    if (evt.duration > 0) {
      const endX = pos.x + this.timeToPx(evt.startTime + evt.duration, pps);

      dl.AddRectFilled(new ImGui.Vec2(evtX, evtY - 2), new ImGui.Vec2(endX, evtY + 2), ImGui.GetColorU32(new ImGui.Vec4(1, 0.2, 0.2, 0.3)));
    }

    if (isHovered) {
      ImGui.BeginTooltip();
      ImGui.PushStyleColor(ImGui.ImGuiCol.Text, evtColor);
      ImGui.Text(evt.name || 'Event');
      ImGui.PopStyleColor();
      ImGui.Separator();
      ImGui.Text(`Time: ${this.fmtTime(evt.startTime)}`);
      if (evt.duration > 0) {
        ImGui.Text(`Duration: ${this.fmtTime(evt.duration)}`);
      }
      ImGui.EndTooltip();
    }

    ImGui.SetCursorScreenPos(pos);
    ImGui.Dummy(new ImGui.Vec2(width, h));
  }

  /** 绘制双层菱形关键帧（与 Sequencer 对齐） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawKeyframeDiamond (dl: any, cx: number, cy: number, color: ImGui.Vec4, isHovered: boolean): void {
    const baseSize = LAYOUT.keySize;
    const borderWidth = LAYOUT.keyBorderWidth;
    const actualSize = isHovered ? baseSize + 1 : baseSize;

    // 外层边框
    const borderColor = isHovered
      ? ImGui.GetColorU32(new ImGui.Vec4(1, 1, 1, 1))
      : ImGui.GetColorU32(COLORS.keyBorder);

    dl.AddQuadFilled(
      new ImGui.Vec2(cx, cy - actualSize), new ImGui.Vec2(cx + actualSize, cy),
      new ImGui.Vec2(cx, cy + actualSize), new ImGui.Vec2(cx - actualSize, cy),
      borderColor,
    );

    // 内层填充
    const innerSize = actualSize - borderWidth;
    const fillColor = isHovered
      ? ImGui.GetColorU32(new ImGui.Vec4(1, 1, 1, 1))
      : ImGui.GetColorU32(color);

    dl.AddQuadFilled(
      new ImGui.Vec2(cx, cy - innerSize), new ImGui.Vec2(cx + innerSize, cy),
      new ImGui.Vec2(cx, cy + innerSize), new ImGui.Vec2(cx - innerSize, cy),
      fillColor,
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  曲线绘制（采样渲染）
  // ══════════════════════════════════════════════════════════════════

  private drawCurveArea (dl: any, ch: ChannelTrack, width: number, pps: number): void {
    const st = this.state;
    const h = CURVE_ROW_HEIGHT;
    const pos = ImGui.GetCursorScreenPos();

    // 背景
    dl.AddRectFilled(pos, new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.curveCanvasBg));

    // 采样曲线值，计算值域
    const samples: { x: number, val: number }[] = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const t = st.timelineStart + (i / SAMPLE_COUNT) * (st.timelineEnd - st.timelineStart);
      const val = ch.sample(t);

      samples.push({ x: pos.x + this.timeToPx(t, pps), val });
      if (isFinite(val)) {
        minVal = Math.min(minVal, val);
        maxVal = Math.max(maxVal, val);
      }
    }

    // 值域保护
    if (!isFinite(minVal) || !isFinite(maxVal)) { minVal = 0; maxVal = 1; }
    const range = maxVal - minVal;
    const padding = Math.max(range * 0.15, 0.001);

    minVal -= padding;
    maxVal += padding;

    // 值轴网格
    this.drawValueGrid(dl, pos, width, h, minVal, maxVal);

    // 绘制曲线线段
    const colorU32 = ImGui.GetColorU32(ch.color);
    const topY = pos.y + LAYOUT.curveVerticalPadding;
    const bottomY = pos.y + h - LAYOUT.curveVerticalPadding;
    const valueRange = maxVal - minVal;

    for (let i = 0; i < samples.length - 1; i++) {
      const y1 = bottomY - ((samples[i].val - minVal) / valueRange) * (bottomY - topY);
      const y2 = bottomY - ((samples[i + 1].val - minVal) / valueRange) * (bottomY - topY);

      dl.AddLine(new ImGui.Vec2(samples[i].x, y1), new ImGui.Vec2(samples[i + 1].x, y2), colorU32, LAYOUT.curveLineWidth);
    }

    // 绘制关键帧点
    for (const t of ch.keyframeTimes) {
      const kx = pos.x + this.timeToPx(t, pps);

      if (kx < pos.x - 5 || kx > pos.x + width + 5) { continue; }
      const kval = ch.sample(t);
      const ky = bottomY - ((kval - minVal) / valueRange) * (bottomY - topY);

      dl.AddCircleFilled(new ImGui.Vec2(kx, ky), LAYOUT.curveKeyDotRadius, colorU32, 12);
      dl.AddCircle(new ImGui.Vec2(kx, ky), LAYOUT.curveKeyDotRadius + 1, ImGui.GetColorU32(COLORS.keyBorder), 12, 1);
    }

    // 分割线
    dl.AddLine(new ImGui.Vec2(pos.x, pos.y + h), new ImGui.Vec2(pos.x + width, pos.y + h), ImGui.GetColorU32(COLORS.trackRowDivider), 1);

    ImGui.SetCursorScreenPos(pos);
    ImGui.Dummy(new ImGui.Vec2(width, h));
  }

  /** 值轴网格线和标签 */
  private drawValueGrid (dl: any, pos: ImGui.Vec2, width: number, height: number, minVal: number, maxVal: number): void {
    const gridCount = LAYOUT.curveGridLineCount;
    const topY = pos.y + LAYOUT.curveVerticalPadding;
    const bottomY = pos.y + height - LAYOUT.curveVerticalPadding;

    for (let i = 0; i <= gridCount; i++) {
      const frac = i / gridCount;
      const y = bottomY - frac * (bottomY - topY);
      const val = minVal + frac * (maxVal - minVal);

      dl.AddLine(new ImGui.Vec2(pos.x, y), new ImGui.Vec2(pos.x + width, y), ImGui.GetColorU32(COLORS.curveGrid), 1);

      const label = val.toFixed(2);

      dl.AddText(new ImGui.Vec2(pos.x + 4, y - ImGui.GetFontSize() - 1), ImGui.GetColorU32(COLORS.curveValueLabel), label);
    }
  }

  /** 垂直网格线 */
  private drawVerticalGrid (dl: any, origin: ImGui.Vec2, width: number, height: number, pps: number): void {
    const st = this.state;
    const duration = st.timelineEnd - st.timelineStart;
    const step = this.niceStep(duration / Math.max(1, width / 80));
    const firstTick = Math.ceil(st.timelineStart / step) * step;
    const gridColor = ImGui.GetColorU32(COLORS.gridLine);

    for (let t = firstTick; t <= st.timelineEnd + 1e-9; t += step) {
      const x = origin.x + this.timeToPx(t, pps);

      if (x < origin.x || x > origin.x + width) { continue; }
      dl.AddLine(new ImGui.Vec2(x, origin.y), new ImGui.Vec2(x, origin.y + height), gridColor, 1);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  滚轮缩放 & 中键拖拽
  // ══════════════════════════════════════════════════════════════════

  /** 鼠标滚轮缩放时间轴（以鼠标位置为锚点） */
  private handleWheelZoom (canvasWidth: number): void {
    const io = ImGui.GetIO();
    const wheel = io.MouseWheel;

    if (Math.abs(wheel) < 0.01) { return; }

    const st = this.state;
    const pps = this.calcPps(canvasWidth);
    const mouseX = ImGui.GetMousePos().x - ImGui.GetCursorScreenPos().x;
    const anchorTime = this.pxToTime(mouseX, pps);

    const oldDuration = st.timelineEnd - st.timelineStart;
    const zoomFactor = 1 - wheel * 0.1;
    const newDuration = Math.max(0.01, Math.min(st.clipDuration * 3, oldDuration * zoomFactor));

    // 保持锚点在屏幕上的像素位置不变
    const ratio = (anchorTime - st.timelineStart) / Math.max(1e-9, oldDuration);

    st.timelineStart = anchorTime - ratio * newDuration;
    st.timelineEnd = st.timelineStart + newDuration;

    this.clampTimeline();
  }

  /** 鼠标中键拖拽平移时间轴（增量模式，每帧计算偏移） */
  private handleMiddleMousePan (canvasWidth: number): void {
    const st = this.state;

    if (ImGui.IsMouseClicked(2)) {
      st.isPanning = true;
      st.lastPanMouseX = ImGui.GetMousePos().x;
    }

    if (ImGui.IsMouseReleased(2)) {
      st.isPanning = false;
    }

    if (!st.isPanning || !ImGui.IsMouseDown(2)) {
      st.isPanning = false;

      return;
    }

    const currentMouseX = ImGui.GetMousePos().x;
    const deltaX = currentMouseX - st.lastPanMouseX;

    st.lastPanMouseX = currentMouseX;

    if (Math.abs(deltaX) < 0.01) { return; }

    const pps = this.calcPps(canvasWidth);
    const deltaTime = deltaX / pps;

    st.timelineStart -= deltaTime;
    st.timelineEnd -= deltaTime;

    this.clampTimeline();
  }

  /** 遍历所有缓存轨道，找到最大的关键帧时间 */
  private getMaxKeyframeTime (): number {
    let maxTime = 0;

    for (const el of this.cachedTracks) {
      for (const comp of el.components) {
        for (const prop of comp.properties) {
          for (const ch of prop.channels) {
            for (const t of ch.keyframeTimes) {
              if (t > maxTime) { maxTime = t; }
            }
          }
        }
      }
    }

    return maxTime;
  }

  /** 统一限制时间轴范围：不允许 start < 0 */
  private clampTimeline (): void {
    const st = this.state;

    if (st.timelineStart < 0) {
      st.timelineEnd -= st.timelineStart;
      st.timelineStart = 0;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  工具方法
  // ══════════════════════════════════════════════════════════════════

  /** 选择 1-2-5 序列的"好看"步长 */
  private niceStep (rough: number): number {
    if (rough <= 0) { return 0.1; }
    const exp = Math.floor(Math.log10(rough));
    const base = Math.pow(10, exp);
    const norm = rough / base;

    if (norm <= 1.5) { return base; }
    if (norm <= 3.5) { return 2 * base; }
    if (norm <= 7.5) { return 5 * base; }

    return 10 * base;
  }

  private fmtTime (seconds: number): string {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);

    if (m > 0) { return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`; }

    return `${s.toFixed(3)}s`;
  }

  private fmtTimeShort (seconds: number): string {
    const s = Math.max(0, seconds);

    if (s >= 60) { return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; }
    if (s >= 1) { return `${s.toFixed(2)}s`; }

    return `${(s * 1000).toFixed(0)}ms`;
  }

  private getClipName (clip: AnimationClip): string {
    if ('name' in clip) {
      const name = (clip as { name: string }).name;

      if (typeof name === 'string' && name.length > 0) { return name; }
    }
    const guid = clip.getInstanceId();

    return guid.length > 16 ? guid.substring(0, 16) + '..' : guid;
  }
}
