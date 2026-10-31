import { setTooltip } from '../../ui/controls/tooltip';
import { AnimationClip, math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion, InputEventKey } from '@galacean/effects';
import type { Control, Label, ContentInsets } from '@galacean/effects-plugin-gui';
import { Button, Container, FocusMode, HorizontalAlignment, TextOverflow, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem } from '../../framework/registry/editor-registry';
import { EditorSelection } from '../../framework/selection/editor-selection';
import { EditorWindow } from '../../framework/windows/editor-window';
import { CurveEditor } from '../../ui/curve-editor/curve-editor';
import { curveTickStep } from '../../ui/curve-editor/curve-screen-space';
import { append, column, expand, label, margin, place } from '../../ui/controls/layout';
import { VirtualList } from '../../ui/controls/virtual-list';
import { NumberEdit } from '../../ui/controls/number-edit';
import { EditorToolbar } from '../../ui/controls/toolbar';
import { EditorIconButton, paintIcon } from '../../ui/icons/control-icons';
import { editorColors as C, editorBox, EDITOR_FONT, EDITOR_FONT_SIZE } from '../../ui/theme/control-theme';
import { COLORS, LAYOUT } from './animation-clip-style';
import type { ClipCurveChannel } from './clip-curve-model';
import { ClipCurveModel } from './clip-curve-model';
const CHANNEL_COLORS = {
  x: COLORS.channelX,
  y: COLORS.channelY,
  z: COLORS.channelZ,
  w: new math.Color(0.8, 0.6, 0.2, 1.0),
  r: new math.Color(0.9, 0.25, 0.25, 1.0),
  g: new math.Color(0.25, 0.8, 0.25, 1.0),
  b: new math.Color(0.3, 0.45, 0.95, 1.0),
  a: new math.Color(0.7, 0.7, 0.7, 1.0),
  scalar: COLORS.channelDefault,
};

const COMPONENT_COLORS: Record<string, math.Color> = {
  Transform:  new math.Color(0.95, 0.45, 0.15, 1.0),
  default:    new math.Color(0.50, 0.60, 0.75, 1.0),
};

// ── 轨道数据模型 ─────────────────────────────────────────────────

/** 最底层：单通道属性（如 Position.X） */
type ChannelTrack = ClipCurveChannel;

/** 中间层：属性组（如 Position，包含 X/Y/Z 通道） */
interface PropertyTrack {
  label: string,
  channels: ChannelTrack[],
}

/** 组件层：如 Transform */
interface ComponentTrack {
  label: string,
  color: math.Color,
  properties: PropertyTrack[],
}

/** 顶层：元素（按 path 分组） */
interface ElementTrack {
  path: string,
  displayName: string,
  components: ComponentTrack[],
}

class ClipTrackBuilder {
  build (clip: AnimationClip): ElementTrack[] {
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

  maxTime (tracks: ElementTrack[]): number {
    let maxTime = 0;

    for (const el of tracks) {
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

}

interface ClipRow {
  id: string, label: string, depth: number, color: math.Color, expanded?: boolean,
  toggle?: () => void, channel?: ChannelTrack, channels?: ChannelTrack[], event?: { name: string, startTime: number, duration: number },
}
class ClipTimelineState {
  start = 0; end = 1; current = 0; duration = 1; labelWidth = 220;
  expanded = new Set<string>();
  timeX (time: number, width: number): number { return this.labelWidth + 8 + (time - this.start) / (this.end - this.start) * Math.max(1, width - this.labelWidth - 8); }
  timeAt (x: number, width: number): number { return this.start + (x - this.labelWidth - 8) / Math.max(1, width - this.labelWidth - 8) * (this.end - this.start); }
  clamp (): void { if (this.start < 0) { this.end -= this.start; this.start = 0; } }
}
class ClipTimelineInput extends Container {
  protected dragging?: { kind: 'scrub' | 'pan' | 'split', x: number, start: number, end: number, width: number };
  constructor (engine: Engine, readonly state: ClipTimelineState) { super(engine); this.focusMode = FocusMode.All; this.clipContents = true; }
  override onMouseDown (event: InputEventMouseButton): void {
    const x = event.position.x;

    if (Math.abs(x - this.state.labelWidth) < 5) { this.dragging = { kind: 'split', x, start: this.state.start, end: this.state.end, width: this.state.labelWidth }; } else if (x >= this.state.labelWidth && (event.buttonIndex === MouseButton.Left || event.buttonIndex === MouseButton.Middle)) {
      this.dragging = { kind: event.buttonIndex === MouseButton.Left ? 'scrub' : 'pan', x, start: this.state.start, end: this.state.end, width: this.width };
      if (this.dragging.kind === 'scrub') { this.state.current = Math.max(0, Math.min(this.state.duration, this.state.timeAt(x, this.width))); }
    }
    this.grabFocus(); event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    const drag = this.dragging;

    if (drag?.kind === 'split') { this.state.labelWidth = Math.max(140, Math.min(this.width - 100, drag.width + event.position.x - drag.x)); } else if (drag?.kind === 'scrub') { this.state.current = Math.max(0, Math.min(this.state.duration, this.state.timeAt(event.position.x, this.width))); } else if (drag?.kind === 'pan') {
      const delta = (event.position.x - drag.x) / Math.max(1, this.width - this.state.labelWidth - 8) * (drag.end - drag.start);

      this.state.start = drag.start - delta; this.state.end = drag.end - delta; this.state.clamp();
    }
    this.defaultCursorShape = Math.abs(event.position.x - this.state.labelWidth) < 5 ? 'ew-resize' : 'default';
    if (drag) { event.accept(); }
  }
  override onMouseUp (event: InputEventMouseButton): void { this.dragging = undefined; event.accept(); }
  override onMouseWheel (event: InputEventMouseButton): void {
    if (event.position.x < this.state.labelWidth) { return; }
    const anchor = this.state.timeAt(event.position.x, this.width), factor = event.buttonIndex === MouseButton.WheelUp ? .85 : 1 / .85;
    const span = Math.max(.001, Math.min(1e7, (this.state.end - this.state.start) * factor)), ratio = (anchor - this.state.start) / (this.state.end - this.state.start);

    this.state.start = anchor - span * ratio; this.state.end = this.state.start + span; this.state.clamp(); event.accept();
  }
  override onKeyDown (event: InputEventKey): void { if (event.keycode.toLowerCase() === 'f' || event.keycode === 'Home') { this.state.start = 0; this.state.end = this.state.duration * 1.1; event.accept(); } }
  protected drawTimeGrid (): void {
    const state = this.state, step = curveTickStep((state.end - state.start) / Math.max(1, (this.width - state.labelWidth) / 80));

    for (let time = Math.ceil(state.start / step) * step; time <= state.end; time += step) {
      const x = state.timeX(time, this.width);

      this.drawLine(x, 0, x, this.height, C.outline);
    }
    const x = state.timeX(state.current, this.width);

    if (x >= state.labelWidth && x <= this.width) { this.drawLine(x, 0, x, this.height, COLORS.cursor); }
  }
}
class ClipRuler extends ClipTimelineInput {
  constructor (engine: Engine, state: ClipTimelineState) { super(engine, state); this.setCustomMinimumSize(0, 32); }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, C.header);
    this.drawText(10, (this.height - this.measureText('Animation Tracks', EDITOR_FONT_SIZE, EDITOR_FONT).lineHeight) / 2, 'Animation Tracks', EDITOR_FONT_SIZE, C.foreground, EDITOR_FONT);
    const step = curveTickStep((this.state.end - this.state.start) / Math.max(1, (this.width - this.state.labelWidth) / 80));

    for (let time = Math.ceil(this.state.start / step) * step; time <= this.state.end; time += step) {
      const x = this.state.timeX(time, this.width);

      this.drawLine(x, 20, x, 32, C.muted); this.drawText(x + 3, 2, time >= 1 ? time.toFixed(2) + 's' : Math.round(time * 1000) + 'ms', 12, C.muted, EDITOR_FONT);
    }
    const x = this.state.timeX(this.state.current, this.width);

    if (x >= this.state.labelWidth && x < this.width) { this.fillTriangle(x - 5, 20, x + 5, 20, x, 28, COLORS.cursor); }
  }
}
class ClipTrackLabel extends Button {
  private row?: ClipRow;
  constructor (engine: Engine) { super(engine); this.themeTypeVariation = 'EditorTreeButton'; this.textAlignment = HorizontalAlignment.Left; this.clipText = true; }
  bind (row: ClipRow): void { this.row = row; this.text = row.label; }
  protected override getContentInsets (): ContentInsets {
    return { left: (this.row?.depth ?? 0) * 12 + (this.row?.toggle || this.row?.channel ? 22 : 10), right: this.row?.channel ? 72 : 8, top: 0, bottom: 0 };
  }
  protected override drawDecoration (): void {
    if (!this.row) { return; }
    const x = this.row.depth * 12;

    if (this.row.toggle) { paintIcon(this, this.row.expanded ? 'caretDown' : 'caretRight', x + 4, (this.height - 12) / 2, 12); }
    if (this.row.channel) { this.drawStyleBox(editorBox(this.row.color, 0, 3), x + 9, this.height / 2 - 3, 6, 6); }
  }
}
class ClipTimelineRow extends ClipTimelineInput {
  private data: ClipRow;
  private index = 0;
  private caption: ClipTrackLabel;
  private readonly curve = new CurveEditor(this);
  private model?: ClipCurveModel;
  constructor (engine: Engine, state: ClipTimelineState) {
    super(engine, state); this.caption = append(this, new ClipTrackLabel(engine));
    this.caption.on('pressed', () => this.data.toggle?.());
  }
  bind (data: ClipRow, index: number): void { if (this.data?.channel !== data.channel) { this.model = data.channel ? new ClipCurveModel(data.channel) : undefined; } this.data = data; this.index = index; this.caption.bind(data); }
  protected override sortChildren (): void { place(this.caption, 0, 0, this.state.labelWidth - 5, this.height); }
  override update (dt: number): void { this.queueSort(); super.update(dt); }
  override draw (): void {
    if (!this.data) { return; }
    const s = this.state, graphics = this.engine.renderingServer.graphics;

    this.fillRect(0, 0, this.width, this.height, this.data.channel ? this.index % 2 ? C.recessed : C.panel : C.header);
    if (!this.data.channel) { this.fillRect(0, 0, 3, this.height, this.data.color); }
    this.fillRect(0, this.height - 1, this.width, 1, C.outline); this.fillRect(s.labelWidth, 0, 1, this.height, C.outline);
    graphics.pushClipRect(s.labelWidth, 0, this.width - s.labelWidth, this.height);
    this.drawTimeGrid();
    if (this.model) {
      this.curve.draw({ rect: { x: s.labelWidth + 8, y: 0, width: Math.max(1, this.width - s.labelWidth - 8), height: this.height }, bounds: { timeMin: s.start, timeMax: s.end, valueMin: -1, valueMax: 1 }, models: [this.model], selected: new Set(), mode: 'keys', keyRadius: 4 });
      const mouse = this.getLocalMousePosition(), hit = this.curve.keys.find(key => Math.hypot(key.x - mouse.x, key.y - mouse.y) < 8);

      setTooltip(this, hit ? this.data.label + '\nTime: ' + hit.key.time.toFixed(3) + 's\nValue: ' + hit.key.value.toFixed(4) : '');
    } else if (this.data.channels) {
      for (const time of new Set(this.data.channels.flatMap(channel => channel.keyframeTimes))) { CurveEditor.diamond(this, s.timeX(time, this.width), this.height / 2, this.data.color, 3, C.outline); }
    } else if (this.data.event) {
      const event = this.data.event, x = s.timeX(event.startTime, this.width);

      this.fillRect(x, this.height / 2 - 2, event.duration / (s.end - s.start) * (this.width - s.labelWidth - 8), 4, this.data.color);
      CurveEditor.diamond(this, x, this.height / 2, this.data.color, 4, C.outline); setTooltip(this, event.name + '\nTime: ' + event.startTime.toFixed(3) + 's\nDuration: ' + event.duration.toFixed(3) + 's');
    }
    graphics.popClipRect();
    if (this.data.channel) {
      const sample = this.data.channel.sample(s.current), value = sample.toFixed(Math.abs(sample) < 100 ? 4 : 2);

      this.drawText(s.labelWidth - 68, (this.height - this.measureText(value, 12, EDITOR_FONT).lineHeight) / 2, value, 12, this.data.color, EDITOR_FONT);
    }
  }
}

@editorPanel()
export class AnimationClipEditor extends EditorWindow {
  private state = new ClipTimelineState();
  private readonly builder = new ClipTrackBuilder();
  private tracks: ElementTrack[] = [];
  private clip?: AnimationClip;
  private list: VirtualList<ClipRow>;
  private time: NumberEdit;
  private duration!: Label;
  private caption: Label;
  private play: EditorIconButton;
  private playing = false;
  private editorBody?: Control;
  private empty?: Label;
  @menuItem('Window/Animation Clip')
  static showWindow (): void { EditorWindow.getWindow(AnimationClipEditor).open(); }
  constructor () { super(); this.title = 'Animation Clip'; this.open(); }
  protected override createContent (engine: Engine): Control {
    const root = column(engine);

    this.empty = append(root, expand(label(engine, 'Select an Animation Clip', C.muted))); this.empty.horizontalAlignment = HorizontalAlignment.Center; this.empty.verticalAlignment = VerticalAlignment.Center;
    const body = this.editorBody = append(root, expand(column(engine))), toolbar = new EditorToolbar(engine, 28);

    append(body, margin(engine, toolbar, 8, 4));

    body.visible = false;

    const first = append(toolbar, new EditorIconButton(engine, 'first'));

    setTooltip(first, 'Go to Start'); first.on('pressed', () => { this.playing = false; this.state.current = 0; });
    this.play = append(toolbar, new EditorIconButton(engine, 'play')); setTooltip(this.play, 'Play / Pause'); this.play.on('pressed', () => { this.playing = !this.playing; });
    const stop = append(toolbar, new EditorIconButton(engine, 'stop'));

    setTooltip(stop, 'Stop'); stop.on('pressed', () => { this.playing = false; this.state.current = 0; });
    this.time = append(toolbar, new NumberEdit(engine)); this.time.minimum = 0; this.time.step = .01; this.time.suffix = ' s'; this.time.setCustomMinimumSize(95, 24); this.time.changed = value => { this.state.current = Math.min(value, this.state.duration); };
    this.duration = toolbar.label('');
    const fit = append(toolbar, new Button(engine, 'Fit'));

    fit.on('pressed', () => this.fit());
    const expandAll = append(toolbar, new Button(engine, 'Expand All'));

    expandAll.on('pressed', () => { this.expandAll(); this.refreshRows(); });
    const collapse = append(toolbar, new Button(engine, 'Collapse All'));

    collapse.on('pressed', () => { this.state.expanded.clear(); this.refreshRows(); });
    this.caption = expand(toolbar.label('Select an Animation Clip'), true, false); this.caption.textOverflow = TextOverflow.Ellipsis;
    append(body, new ClipRuler(engine, this.state));
    this.list = append(body, expand(new VirtualList<ClipRow>(engine, LAYOUT.channelHeight, value => value.id, () => new ClipTimelineRow(engine, this.state))));
    this.onSelectionChange();

    return root;
  }
  override onSelectionChange (): void {
    const clip = EditorSelection.getSelectedObjects().find((object): object is AnimationClip => object instanceof AnimationClip);

    if (!this.list || !clip || clip === this.clip) { return; }
    this.editorBody!.visible = true; this.empty!.visible = false;
    this.clip = clip; this.tracks = this.builder.build(clip); this.state.duration = Math.max(.01, clip.duration, this.builder.maxTime(this.tracks)); this.state.current = 0;
    this.expandAll(); this.fit(); this.refreshRows(); this.caption.text = Reflect.get(clip, 'name') || clip.getInstanceId(); this.duration.text = '/ ' + clip.duration.toFixed(3) + ' s';
  }
  override onUndoRedo (): void { if (this.clip) { this.tracks = this.builder.build(this.clip); this.refreshRows(); } }
  override update (dt: number): void {
    if (this.playing && this.clip) { this.state.current = (this.state.current + dt) % this.state.duration; }
    this.play.iconName = this.playing ? 'pause' : 'play'; if (!this.time.isEditing) { this.time.value = this.state.current; }
  }
  private fit (): void { this.state.start = 0; this.state.end = this.state.duration * 1.1; }
  private expandAll (): void { for (const element of this.tracks) { this.state.expanded.add(element.path); for (const component of element.components) { this.state.expanded.add(element.path + '/' + component.label); } } }
  private refreshRows (): void {
    const rows: ClipRow[] = [];
    const section = (id: string, label: string, depth: number, color: math.Color): boolean => {
      const expanded = this.state.expanded.has(id);

      rows.push({ id, label, depth, color, expanded, toggle: () => { if (expanded) { this.state.expanded.delete(id); } else { this.state.expanded.add(id); } this.refreshRows(); } });

      return expanded;
    };

    for (const element of this.tracks) {
      if (!section(element.path, element.displayName, 0, C.foreground)) { continue; }
      for (const component of element.components) {
        const id = element.path + '/' + component.label;

        if (!section(id, component.label, 1, component.color)) { continue; }
        for (const property of component.properties) {
          const key = id + '/' + property.label;

          rows.push({ id: key, label: property.label, depth: 2, color: component.color, channels: property.channels });
          property.channels.forEach((channel, index) => rows.push({ id: key + '/' + index, label: channel.label, depth: 3, color: channel.color, channel }));
        }
      }
    }
    if (this.clip?.events.length) {
      rows.push({ id: 'events', label: 'Events', depth: 0, color: C.axes[0] });
      this.clip.events.forEach((event, index) => rows.push({ id: 'event/' + index, label: event.name || 'Event ' + index, depth: 1, color: C.axes[0], event }));
    }
    this.list.setRows(rows);
  }
}
