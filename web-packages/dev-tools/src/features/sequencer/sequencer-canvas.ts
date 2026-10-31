import { math, MouseButton, InterpolationMode } from '@galacean/effects';
import type { Engine, TrackAsset, InputEventMouseButton, InputEventMouseMotion, InputEventKey } from '@galacean/effects';
import { InputEventMouseButton as MouseEventButton } from '@galacean/effects';
import type { CursorStyle } from '@galacean/effects-plugin-gui';
import { Button, Container, Control, FocusMode, MouseFilter, VScrollBar } from '@galacean/effects-plugin-gui';
import { append, place, screenPosition } from '../../ui/controls/layout';
import { NumberEdit } from '../../ui/controls/number-edit';
import { EditorIconButton, paintIcon } from '../../ui/icons/control-icons';
import { setTooltip } from '../../ui/controls/tooltip';
import { CurveEditor } from '../../ui/curve-editor/curve-editor';
import { CurveDragGesture, CurveSelection, moveCurveKeys } from '../../ui/curve-editor/curve-interaction';
import { CurveScreenSpace, zoomCurveBounds } from '../../ui/curve-editor/curve-screen-space';
import { editorBox, editorColors, EDITOR_FONT, EDITOR_FONT_SIZE, EDITOR_COMPACT_FONT_SIZE, EDITOR_SMALL_FONT_SIZE } from '../../ui/theme/control-theme';
import { sceneWorkspace } from '../scene/scene-workspace';
import type { SequenceKey } from './curve-data';
import { controlPoint, updateAutoTangents } from './curve-data';
import { SequencerCurveModel } from './sequencer-curve-model';
import type { PositionPathSnapshot } from './spatial-position';
import { PositionPathModel } from './spatial-position';
import type { KeySelection, SequenceChannel, SequenceSection, SequencerDocument } from './sequencer-document';
import type { SequenceRow, SequencerState } from './sequencer-state';
import { SEQUENCE_COLORS as C, SEQUENCE_LAYOUT as L, niceStep } from './sequencer-style';
type PointerPhase = 'down' | 'move' | 'up' | 'wheel';
interface Rect { x: number, y: number, width: number, height: number }
interface KeyHit { x: number, y: number, keys: KeySelection[] }
interface SectionHit extends Rect { section: SequenceSection }
interface TangentHit { x: number, y: number, item: KeySelection, side: 'in' | 'out' }
interface SectionSeed { section: SequenceSection, start: number, duration: number, keys: SequenceKey[][], position?: PositionPathSnapshot }
interface Drag {
  gesture: CurveDragGesture,
  kind: 'keys' | 'section' | 'tangent' | 'marquee' | 'scrub' | 'pan' | 'zoom' | 'splitter' | 'scroll' | 'overview' | 'range-start' | 'range-end' | 'track',
  x: number, y: number, time: number, value: number,
  keys?: { item: KeySelection, time: number, value: number }[],
  sections?: SectionSeed[],
  edge?: 'left' | 'right',
  tangents?: TangentHit[],
  view?: number[],
  initialSelection?: Set<string>,
  track?: TrackAsset,
  resume?: boolean,
  button?: MouseButton,
  context?: SequencerContext,
  moved?: boolean,
  valueScale?: number,
  axis?: 'x' | 'y',
  horizontalOnly?: boolean,
  graph?: boolean,
  duplicate?: boolean,
}
export interface SequencerContext {
  row?: SequenceRow,
  section?: SequenceSection,
  channel?: SequenceChannel,
  time: number,
  keys?: KeySelection[],
}

export class SequencerCanvas extends Container {
  context?: SequencerContext;
  drag?: Drag;
  private rect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private plot!: Rect;
  private rows: SequenceRow[] = [];
  private keyHits: KeyHit[] = [];
  private sectionHits: SectionHit[] = [];
  private tangentHits: TangentHit[] = [];
  private selectedTangents: TangentHit[] = [];
  private overview!: Rect;
  private overviewExtent = 1;
  private hover = false;
  private outlinerHover = false;
  private overviewHover = false;
  private scrollMax = 0;
  private readonly curveEditor = new CurveEditor(this);
  private readonly curveModels = new Map<SequenceChannel, SequencerCurveModel>();
  private get curveSpace (): CurveScreenSpace {
    return new CurveScreenSpace({ x: this.graphLeft, y: this.plot.y, width: this.plot.x + this.plot.width - this.graphLeft, height: this.plot.height },
      { timeMin: this.state.viewStart, timeMax: this.state.viewEnd, valueMin: this.state.curveMin, valueMax: this.state.curveMax });
  }
  private hoveredRow?: string;
  private parentHighlights = new Set<string>();

  document?: SequencerDocument;
  contextRequested?: (context: SequencerContext, position: math.Vector2) => void;
  shortcut?: (event: InputEventKey) => void;
  readonly outlinerHeader: Control;
  private readonly rowLayer: Control;
  private readonly scrollbar: VScrollBar;
  private readonly rowControls = new Map<string, SequenceRowControl>();
  private pointer = new math.Vector2();
  private scrubKey = false;

  constructor (engine: Engine, readonly state: SequencerState, private readonly selectTrack: (track: TrackAsset) => void) {
    super(engine); this.focusMode = FocusMode.All; this.clipContents = true;
    this.outlinerHeader = append(this, new Control(engine)); this.outlinerHeader.mouseFilter = MouseFilter.Pass;
    this.rowLayer = append(this, new Control(engine)); this.rowLayer.clipContents = true; this.rowLayer.mouseFilter = MouseFilter.Pass;
    this.scrollbar = append(this, new VScrollBar(engine)); this.scrollbar.step = 1;
    this.scrollbar.on('valueChanged', value => { this.state.scrollY = value; this.layoutRows(); });
  }
  protected override sortChildren (): void {
    this.state.layoutOutliner(this.width); this.rect = { x: 0, y: 0, width: this.width, height: this.height };
    this.plot = { x: this.state.outlinerWidth, y: L.rulerHeight, width: Math.max(1, this.width - this.state.outlinerWidth - 12), height: Math.max(1, this.height - L.rulerHeight - 18) };
    this.overview = { x: this.plot.x, y: this.height - 16, width: this.plot.width, height: 14 };
    place(this.outlinerHeader, 0, 0, this.state.outlinerWidth - 8, L.rulerHeight);
    place(this.rowLayer, 0, this.plot.y, this.state.outlinerWidth - 8, this.plot.height);
    place(this.scrollbar, this.plot.x + this.plot.width, this.plot.y, 12, this.plot.height);
    this.layoutRows();
  }
  override update (dt: number): void {
    this.rows = this.document ? this.state.rows(this.document) : []; this.updateParentHighlights(); this.layoutRows();
    super.update(dt);
  }
  isRowSelected (row: SequenceRow): boolean {
    const id = row.track.getInstanceId();

    if (!this.document?.selectedTracks.has(id)) { return false; }

    return row.id === (this.state.activeChannel.startsWith(id + ':') ? this.state.activeChannel : id);
  }
  rowBackground (row: SequenceRow): math.Color {
    const hovered = this.hoveredRow === row.id;

    if (this.isRowSelected(row)) {
      return this.root?.guiGetFocusOwner()?.parent === this.rowLayer ? C.selection : editorColors.selectedInactive;
    }
    if (this.parentHighlights.has(row.id)) { return hovered ? C.rowHover : editorColors.selectedParent; }
    if (row.depth === 0) { return hovered ? C.headerHover : C.header; }

    return hovered ? C.rowHover : this.rows.indexOf(row) % 2 ? C.rowAlt : C.row;
  }
  private updateParentHighlights (): void {
    this.parentHighlights.clear();
    const document = this.document;

    if (!document) { return; }
    const highlight = (track: TrackAsset, includeTrack: boolean) => {
      for (let node: TrackAsset | undefined = includeTrack ? track : track.parent; node; node = node.parent) {
        this.parentHighlights.add(node.getInstanceId());
      }
    };

    for (const track of document.tracks) {
      const id = track.getInstanceId();

      if (!document.selectedTracks.has(id)) { continue; }
      const channelSelected = this.state.activeChannel.startsWith(id + ':');

      highlight(track, channelSelected);
      if (channelSelected && this.state.activeChannel.includes('.')) { this.parentHighlights.add(this.state.activeChannel.slice(0, this.state.activeChannel.lastIndexOf('.'))); }
    }
    document.selectedSectionItems.forEach(section => highlight(section.track, true));
    for (const { section, channel } of document.selectedKeyItems()) {
      const group = section.track.getInstanceId() + ':' + channel.group;

      highlight(section.track, true); this.parentHighlights.add(group); this.parentHighlights.add(group + '.' + channel.label);
    }
  }
  private layoutRows (): void {
    if (!this.document) {
      for (const control of this.rowControls.values()) { control.dispose(); }
      this.rowControls.clear(); this.scrollbar.visible = false;

      return;
    }
    this.scrollbar.visible = true;
    if (!this.plot) { return; }
    const last = this.rows.at(-1), total = last ? last.top + last.height : 0;

    this.scrollMax = Math.max(0, total - this.plot.height);
    this.state.scrollY = Math.max(0, Math.min(this.state.scrollY, this.scrollMax));
    this.scrollbar.maxValue = total; this.scrollbar.page = this.plot.height; this.scrollbar.value = this.state.scrollY;
    const keep = new Set<string>();

    for (const row of this.rows) {
      if (row.top + row.height < this.state.scrollY || row.top > this.state.scrollY + this.plot.height) { continue; }
      keep.add(row.id);
      let control = this.rowControls.get(row.id);

      if (!control) { control = append(this.rowLayer, new SequenceRowControl(this.engine, this)); this.rowControls.set(row.id, control); }
      control.bind(row, this.document); place(control, 0, row.top - this.state.scrollY, this.rowLayer.width, row.height);
    }
    for (const [id, control] of this.rowControls) { if (!keep.has(id)) { control.dispose(); this.rowControls.delete(id); } }
  }
  override draw (): void {
    const document = this.document;

    this.fillRect(0, 0, this.width, this.height, C.background);
    if (!document || !this.plot) {
      this.drawText(12, 12, 'Open a composition with a timeline to start editing.', EDITOR_FONT_SIZE, C.muted, EDITOR_FONT);

      return;
    }
    this.keyHits = []; this.sectionHits = []; this.tangentHits = [];
    this.drawRuler(document);
    const graphics = this.engine.renderingServer.graphics;

    graphics.pushClipRect(this.plot.x, this.plot.y, this.plot.width, this.plot.height);
    if (this.state.curveMode) { this.drawCurves(document); } else { this.drawTimeline(document); }
    this.drawPlaybackRange(); this.drawPlayhead(document);
    graphics.popClipRect(); this.drawOverview(document);
  }
  override getCursorShape (position: math.Vector2): CursorStyle {
    if (!this.document || !this.plot) { return super.getCursorShape(position); }
    if (this.drag) {
      if (this.drag.kind === 'splitter' || this.drag.kind === 'section' && this.drag.edge) { return 'ew-resize'; }
      if (this.drag.kind === 'keys' || this.drag.kind === 'tangent') { return 'move'; }

      return super.getCursorShape(position);
    }
    if (!this.hasPoint(position)) { return super.getCursorShape(position); }
    if (Math.abs(position.x - this.state.outlinerWidth + 4) < 5) { return 'ew-resize'; }
    if (this.contains(this.plot, position.x, position.y)) {
      const { keyHit, tangent, sectionEdge } = this.hitTest(position);

      if (sectionEdge) { return 'ew-resize'; }
      if (tangent || keyHit) { return 'move'; }
    }

    return super.getCursorShape(position);
  }
  override onMouseDown (event: InputEventMouseButton): void {
    this.grabFocus();
    if (this.document && event.buttonIndex === MouseButton.Left && Math.abs(event.position.x - this.state.outlinerWidth + 4) < 5) {
      this.pointer.copyFrom(event.position); this.start('splitter', this.document).value = this.state.outlinerWidth;
    } else { this.pointerEvent(event, 'down'); }
    event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void { this.pointerEvent(event, 'move'); }
  override onMouseUp (event: InputEventMouseButton): void {
    if (event.canceled && this.document) { this.cancel(this.document); } else { this.pointerEvent(event, 'up'); }
    event.accept();
  }
  override onMouseWheel (event: InputEventMouseButton): void { this.pointerEvent(event, 'wheel'); event.accept(); }
  override onKeyDown (event: InputEventKey): void { if (event.physicalKeycode === 'KeyB') { this.scrubKey = true; } this.shortcut?.(event); }
  override onKeyUp (event: InputEventKey): void { if (event.physicalKeycode === 'KeyB') { this.scrubKey = false; } }
  pointerEvent (event: InputEventMouseButton | InputEventMouseMotion, phase: PointerPhase): void {
    const document = this.document;

    if (!document || !this.plot) { return; }
    this.pointer.copyFrom(this.makePositionLocal(event.globalPosition));
    this.hover = this.pointer.x >= this.plot.x && this.pointer.y < this.height - 18;
    this.outlinerHover = this.pointer.x < this.plot.x && this.pointer.y >= this.plot.y;
    this.overviewHover = this.contains(this.overview, this.pointer.x, this.pointer.y);
    this.hoveredRow = this.rowAt(this.pointer.y)?.id;
    const action = () => this.interact(document, event, phase);

    if (phase === 'down') { sceneWorkspace.flushEdits(); }
    if (sceneWorkspace.current) { sceneWorkspace.current.observeEditor('Select timeline elements', action); } else { action(); }
    if (this.context) {
      const context = this.context;

      this.context = undefined; this.contextRequested?.(context, event.globalPosition);
    }
    this.queueSort(); event.accept();
    if (phase === 'up') { this.root?.updateMouseCursorState(); }
  }
  get editingValue (): boolean { return [...this.rowControls.values()].some(control => control.isEditingValue); }
  get header (): Rect { return { x: this.rect.x, y: this.rect.y, width: this.state.outlinerWidth - 4, height: L.rulerHeight }; }
  private get graphLeft (): number { return this.plot.x + (this.state.curveMode ? L.curveGutter : 0); }
  get pixelsPerSecond (): number { return (this.plot.x + this.plot.width - this.graphLeft) / Math.max(1e-6, this.state.viewEnd - this.state.viewStart); }
  private timeX (time: number): number { return this.curveSpace.timeX(time); }
  private timeAt (x: number): number { return this.curveSpace.timeAt(x); }
  private valueY (value: number): number { return this.curveSpace.valueY(value); }
  private valueAt (y: number): number { return this.curveSpace.valueAt(y); }

  cancel (document: SequencerDocument): void {
    this.selectedTangents = [];
    if (this.drag) { document.cancel(); this.drag = undefined; }
    this.root?.updateMouseCursorState();
  }

  resetInteraction (): void {
    this.drag = undefined;
    this.selectedTangents = []; this.context = undefined; this.curveModels.clear();
  }

  private drawRuler (document: SequencerDocument): void {
    const s = this.state;
    const playheadX = Math.round(this.timeX(document.currentTime));
    const playheadLabel = s.formatTime(document.currentTime);
    const playheadLabelWidth = this.measureText(playheadLabel, EDITOR_FONT_SIZE, EDITOR_FONT).width;
    const playheadLabelX = playheadX + 9 + playheadLabelWidth <= this.plot.x + this.plot.width
      ? playheadX + 9 : playheadX - 9 - playheadLabelWidth;
    const playheadLeft = Math.min(playheadX - 7, playheadLabelX - 2);
    const playheadRight = Math.max(playheadX + 7, playheadLabelX + playheadLabelWidth + 2);
    const step = this.tickStep();
    const frames = Math.round(step * s.frameRate);
    const start = Math.floor(s.viewStart / step) * step;
    const graphics = this.engine.renderingServer.graphics;

    graphics.pushClipRect(this.plot.x, this.rect.y, this.plot.width, this.plot.y - this.rect.y);

    for (let time = start; time <= s.viewEnd + step; time += step) {
      const x = this.timeX(time);

      if (x < this.plot.x || x > this.plot.x + this.plot.width) { continue; }
      this.line(x, this.rect.y + 23, x, this.plot.y, C.muted);
      const label = s.formatTime(time);
      const labelEnd = x + 4 + this.measureText(label, EDITOR_SMALL_FONT_SIZE, EDITOR_FONT).width;

      if (labelEnd <= this.plot.x + this.plot.width && (x + 4 > playheadRight || labelEnd < playheadLeft)) {
        this.text(x + 4, this.rect.y + 3, label, C.text, EDITOR_SMALL_FONT_SIZE);
      }
      if (frames >= 5) {
        for (let i = 1; i < 5; i++) {
          const minorX = this.timeX(time + step * i / 5);

          if (minorX > this.plot.x && minorX < this.plot.x + this.plot.width) {
            this.line(minorX, this.plot.y - 6, minorX, this.plot.y, C.line);
          }
        }
      }
    }
    if (playheadX >= this.plot.x && playheadX <= this.plot.x + this.plot.width) {
      this.fill({ x: playheadX - 7, y: this.rect.y + 1, width: 14, height: L.rulerHeight - 9 }, C.playhead);
      this.fillTriangle(playheadX - 7, this.plot.y - 8, playheadX + 7, this.plot.y - 8, playheadX, this.plot.y - 1, C.playhead);
      this.text(playheadLabelX, this.rect.y + 3, playheadLabel, C.selectedText);
    }
    this.line(this.plot.x, this.plot.y - 1, this.plot.x + this.plot.width, this.plot.y - 1, C.line);
    graphics.popClipRect();
  }

  private drawTimeline (document: SequencerDocument): void {
    for (const [index, row] of this.rows.entries()) {
      const y = this.plot.y + row.top - this.state.scrollY;

      if (y + row.height < this.plot.y || y > this.plot.y + this.plot.height) { continue; }
      const background = row.kind === 'object' ? C.header : index % 2 ? C.rowAlt : C.row;

      this.fill({ x: this.plot.x, y, width: this.plot.width, height: row.height }, background);
      if (row.kind === 'object') {
        this.line(this.plot.x, y, this.plot.x + this.plot.width, y, C.line);
        const clips = row.track.getChildTracks().flatMap(track => track.getClips());

        if (clips.length) {
          const start = this.timeX(Math.min(...clips.map(clip => clip.start)));
          const end = this.timeX(Math.max(...clips.map(clip => clip.start + clip.duration)));
          const center = y + row.height / 2;

          this.line(start, center, end, center, C.muted);
          this.line(start, center - 3, start, center + 3, C.muted);
          this.line(end, center - 3, end, center + 3, C.muted);
        }
      }
    }
    this.drawTimeGrid();
    for (const row of this.rows) {
      if (row.kind !== 'track') { continue; }
      const y = this.plot.y + row.top - this.state.scrollY;
      const children = this.rows.filter(item => item.track === row.track);
      const last = children.at(-1) ?? row;
      const expanded = last !== row;
      const height = last.top + last.height - row.top - 4;

      if (y + height < this.plot.y || y > this.plot.y + this.plot.height) { continue; }
      for (const clip of row.track.getClips()) {
        const section = document.sections.get(clip);

        if (!section) { continue; }
        const x = this.timeX(clip.start), end = this.timeX(clip.start + clip.duration);
        const rect = { x, y: y + 2, width: Math.max(3, end - x), height };
        const color = C.sections[document.assetType(row.track)] ?? C.sections.default;
        const selected = document.selectedSections.has(clip.getInstanceId());
        const mouse = this.pointer;
        const hovered = (this.hover || this.outlinerHover) && this.contains(rect, mouse.x, mouse.y);
        const header = hovered ? new math.Color(Math.min(1, color.r + 0.06), Math.min(1, color.g + 0.06), Math.min(1, color.b + 0.06), 1) : color;
        const body = new math.Color(header.r * 0.56, header.g * 0.56, header.b * 0.56, 1);

        this.fill(rect, expanded ? body : header, 4);
        if (expanded) { this.fill({ ...rect, height: row.height - 3 }, header, 4, true); }
        if (selected) { this.drawSectionSelection(rect, expanded ? row.height - 3 : rect.height, expanded); }
        this.border(rect, selected ? C.selectedKey : C.line, 1, 4);
        if (selected || hovered) {
          const tint = selected ? C.selectedKey : C.text;

          this.line(x + 3, rect.y + 5, x + 3, rect.y + rect.height - 5, tint);
          this.line(end - 3, rect.y + 5, end - 3, rect.y + rect.height - 5, tint);
        }
        if (rect.width > 50 && (!section.channels.length || clip.name && !clip.name.startsWith('TimelineClip') && clip.name !== row.label)) {
          const graphics = this.engine.renderingServer.graphics;

          graphics.pushClipRect(Math.max(this.plot.x, x + 7), y, Math.max(0, Math.min(this.plot.x + this.plot.width, end - 6) - Math.max(this.plot.x, x + 7)), row.height);
          const title = clip.name?.startsWith('TimelineClip') ? row.label : clip.name || row.label;

          this.text(x + 8, y + (row.height - this.measureText(title, EDITOR_FONT_SIZE, EDITOR_FONT).lineHeight) / 2, title, C.text);
          graphics.popClipRect();
        }
        this.sectionHits.push({ ...rect, height: row.height - 4, section });
      }
    }
    for (const row of this.rows) {
      const y = this.plot.y + row.top - this.state.scrollY;
      const tint = this.isRowSelected(row) ? C.selectionTint : this.parentHighlights.has(row.id) ? C.highlightTint : this.hoveredRow === row.id ? C.hoverTint : undefined;

      if (tint && y + row.height >= this.plot.y && y <= this.plot.y + this.plot.height) {
        this.fill({ x: this.plot.x, y, width: this.plot.width, height: row.height }, tint);
      }
    }
    for (const row of this.rows) {
      const y = this.plot.y + row.top - this.state.scrollY, center = y + row.height / 2;

      if (y + row.height < this.plot.y || y > this.plot.y + this.plot.height || row.expandable && this.state.expanded.has(row.id)) { continue; }
      const atTime = new Map<number, KeySelection[]>();

      for (const { section, channel } of row.channels) {
        if (row.kind === 'channel' && channel.keys.length > 1) {
          const color = C.axes[channel.axis] ?? C.text;

          const tint = new math.Color(color.r, color.g, color.b, 0.38);

          for (let index = 0; index + 1 < channel.keys.length; index++) {
            const key = channel.keys[index], next = channel.keys[index + 1];
            const start = Math.max(this.plot.x, this.timeX(section.clip.start + key.time * section.clip.duration));
            const end = Math.min(this.plot.x + this.plot.width, this.timeX(section.clip.start + next.time * section.clip.duration));

            if (end <= start) { continue; }
            if (key.interpolationMode === InterpolationMode.Constant) {
              for (let x = start; x < end; x += 7) { this.line(x, center, Math.min(x + 4, end), center, tint); }
            } else { this.line(start, center, end, center, tint); }
          }
        }
        for (const key of channel.keys) {
          const time = section.clip.start + key.time * section.clip.duration;

          if (time < this.state.viewStart || time > this.state.viewEnd) { continue; }
          const x = Math.round(this.timeX(time));
          const items = atTime.get(x) ?? [];

          items.push({ section, channel, key }); atTime.set(x, items);
        }
      }
      for (const [x, keys] of atTime) {
        const selected = keys.some(item => document.selectedKeys.has(item.key.id));

        if (row.kind === 'channel' && keys.length === 1 && keys[0].channel.kind === 'number') {
          this.drawNumericKey(x, center, keys[0].key, selected);
        } else { this.diamond(x, center, selected ? C.selectedKey : C.text, selected ? 4.5 : 4); }
        this.keyHits.push({ x, y: center, keys });
      }
    }
    this.drawMarquee();
  }

  private drawSectionSelection (rect: Rect, headerHeight: number, expanded: boolean): void {
    const graphics = this.engine.renderingServer.graphics;
    const color = C.selectedKey;
    const left = Math.max(this.plot.x, rect.x + 2), right = Math.min(this.plot.x + this.plot.width, rect.x + rect.width - 2);
    const top = rect.y + 2, bottom = rect.y + headerHeight - 2;

    this.fill({ ...rect, height: headerHeight }, new math.Color(color.r, color.g, color.b, 0.12), 4, expanded);
    if (right <= left || bottom <= top) { return; }
    graphics.pushClipRect(left, top, right - left, bottom - top);
    const start = rect.x + Math.floor((left - rect.x) / 16) * 16 - headerHeight;
    const tint = new math.Color(color.r, color.g, color.b, 0.24);

    for (let x = start; x < right; x += 16) { this.line(x, bottom, x + headerHeight, top, tint, 1); }
    graphics.popClipRect();
  }

  private rowSelected (document: SequencerDocument, row: SequenceRow): boolean {
    const tracks = this.state.curveMode ? this.state.curveTracks : document.selectedTracks;

    return this.state.activeChannel ? row.id === this.state.activeChannel : tracks.has(row.id);
  }

  private tickStep (): number {
    return Math.max(1, Math.ceil(niceStep(76 / this.pixelsPerSecond * this.state.frameRate))) / this.state.frameRate;
  }

  private drawTimeGrid (): void {
    const step = this.tickStep();

    for (let time = Math.floor(this.state.viewStart / step) * step; time <= this.state.viewEnd; time += step / 5) {
      const x = this.timeX(time);

      if (x < this.graphLeft || x > this.plot.x + this.plot.width) { continue; }
      const major = Math.abs(time / step - Math.round(time / step)) < 1e-5;

      if (major || step / 5 * this.pixelsPerSecond > 12) { this.line(x, this.plot.y, x, this.plot.y + this.plot.height, major ? C.grid : C.minorGrid); }
    }
  }

  private curveModel (document: SequencerDocument, section: SequenceSection, channel: SequenceChannel): SequencerCurveModel {
    let model = this.curveModels.get(channel);

    if (!model || model.document !== document) {
      model = new SequencerCurveModel(document, section, channel, C.axes[channel.axis] ?? C.text); this.curveModels.set(channel, model);
    }

    return model;
  }

  private drawCurves (document: SequencerDocument): void {
    this.drawTimeGrid(); this.line(this.graphLeft - 1, this.plot.y, this.graphLeft - 1, this.plot.y + this.plot.height, C.line);
    const channels = this.state.curveChannels(document);
    const models = channels.filter(entry => entry.section.clip.duration > 0).map(entry => this.curveModel(document, entry.section, entry.channel));
    const live = new Set(document.allSections().flatMap(section => section.channels));

    for (const channel of this.curveModels.keys()) { if (!live.has(channel)) { this.curveModels.delete(channel); } }
    if (!models.length) { this.text(this.plot.x + 20, this.plot.y + 25, 'Select a property track or add keyframes to edit its curves.', C.muted); }
    const space = this.curveSpace;

    this.curveEditor.draw({ rect: space.rect, bounds: space.bounds, models, selected: document.selectedKeys, showTangents: this.state.showTangents,
      selectedTangents: new Set(this.selectedTangents.map(hit => hit.item.key.id + ':' + hit.side)), valueGrid: true,
      selectedColor: C.selectedKey, borderColor: C.line, textColor: C.muted, gridColor: C.grid, zeroColor: C.inputBorder });
    for (const hit of this.curveEditor.keys) {
      const item = (hit.model as SequencerCurveModel).resolve(hit.key.id);

      if (item) { this.keyHits.push({ x: hit.x, y: hit.y, keys: [item] }); }
    }
    for (const hit of this.curveEditor.tangents) {
      const item = (hit.model as SequencerCurveModel).resolve(hit.key.id);

      if (item && hit.side) { this.tangentHits.push({ x: hit.x, y: hit.y, item, side: hit.side }); }
    }
    this.drawMarquee();
  }

  private drawPlaybackRange (): void {
    const left = this.timeX(this.state.playbackStart), right = this.timeX(this.state.playbackEnd);

    if (left > this.graphLeft) { this.fill({ x: this.graphLeft, y: this.plot.y, width: left - this.graphLeft, height: this.plot.height }, new math.Color(0, 0, 0, 0.3)); }
    if (right < this.plot.x + this.plot.width) { this.fill({ x: right, y: this.plot.y, width: this.plot.x + this.plot.width - right, height: this.plot.height }, new math.Color(0, 0, 0, 0.3)); }
    this.line(left, this.plot.y, left, this.plot.y + this.plot.height, C.rangeStart);
    this.line(right, this.plot.y, right, this.plot.y + this.plot.height, C.rangeEnd);
  }

  private drawPlayhead (document: SequencerDocument): void {
    const x = this.timeX(document.currentTime);

    if (x < this.plot.x || x > this.plot.x + this.plot.width) { return; }
    this.line(x, this.plot.y, x, this.plot.y + this.plot.height, C.playheadLine);
  }

  private drawOverview (document: SequencerDocument): void {
    const sections = document.allSections();

    this.overviewExtent = Math.max(this.state.playbackEnd, this.state.viewEnd, ...sections.map(section => section.clip.start + section.clip.duration), 1) * 1.04;
    this.fill(this.overview, C.input, 2);
    const x = this.overview.x + Math.max(0, this.state.viewStart) / this.overviewExtent * this.overview.width;
    const end = this.overview.x + this.state.viewEnd / this.overviewExtent * this.overview.width;

    this.fill({ x, y: this.overview.y + 1, width: Math.min(this.overview.x + this.overview.width, end) - x, height: this.overview.height - 2 }, C.hover, 2);
    for (const edge of [x, end]) {
      this.line(edge + (edge === x ? 3 : -3), this.overview.y + 3, edge + (edge === x ? 3 : -3), this.overview.y + this.overview.height - 3, C.muted);
    }
  }

  private drawMarquee (): void {
    if (this.drag?.kind !== 'marquee' || !this.drag.moved) { return; }
    const mouse = this.pointer;
    const rect = { x: Math.min(this.drag.x, mouse.x), y: Math.min(this.drag.y, mouse.y),
      width: Math.abs(mouse.x - this.drag.x), height: Math.abs(mouse.y - this.drag.y) };

    this.fill(rect, new math.Color(0.2, 0.5, 0.9, 0.16)); this.border(rect, C.active);
  }

  private start (kind: Drag['kind'], document: SequencerDocument): Drag {
    const mouse = this.pointer;
    const drag: Drag = { kind, gesture: new CurveDragGesture(mouse.x, mouse.y), x: mouse.x, y: mouse.y, time: this.timeAt(mouse.x), value: this.valueAt(mouse.y),
      valueScale: (this.state.curveMax - this.state.curveMin) / this.plot.height };

    this.drag = drag;
    if (['keys', 'section', 'tangent'].includes(kind)) { document.begin(kind === 'keys' ? 'Move keyframes' : kind === 'section' ? 'Edit sections' : 'Edit tangents'); }

    return drag;
  }

  private rowAt (y: number): SequenceRow | undefined {
    const offset = y - this.plot.y + this.state.scrollY;

    return this.rows.find(row => offset >= row.top && offset < row.top + row.height);
  }

  private curveAt (document: SequencerDocument, x: number, y: number): { section: SequenceSection, channel: SequenceChannel } | undefined {
    const model = this.curveEditor.hitCurve(x, y) as SequencerCurveModel | undefined;

    return model && model.document === document ? { section: model.section, channel: model.channel } : undefined;
  }

  private zoomView (timeFactor: number, valueFactor: number, time: number, value: number, view = [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax]): void {
    const bounds = zoomCurveBounds({ timeMin: view[0], timeMax: view[1], valueMin: view[2], valueMax: view[3] }, timeFactor, valueFactor, time, value);

    this.state.viewStart = bounds.timeMin; this.state.viewEnd = bounds.timeMax; this.state.curveMin = bounds.valueMin; this.state.curveMax = bounds.valueMax;
  }

  private startKeyDrag (document: SequencerDocument, button = MouseButton.Left): Drag | undefined {
    const keys = document.selectedKeyItems().filter(item => !document.isLocked(item.section.track));

    if (!keys.length) { return; }
    const drag = this.start('keys', document);

    drag.button = button;
    drag.keys = keys.map(item => ({ item, time: item.key.time, value: item.key.value }));

    return drag;
  }

  private startTangentDrag (document: SequencerDocument, button: MouseButton): boolean {
    const visible = new Set(this.state.curveChannels(document).map(entry => entry.channel));
    const tangents = this.selectedTangents.filter(hit => !document.isLocked(hit.item.section.track) && visible.has(hit.item.channel)).map(hit => {
      const { section, channel, key } = hit.item;
      const control = controlPoint(channel.keys, channel.keys.indexOf(key), hit.side);

      return { ...hit, x: this.timeX(section.clip.start + control.time * section.clip.duration), y: this.valueY(control.value) };
    }).filter(hit => Number.isFinite(hit.x) && Number.isFinite(hit.y));

    if (!tangents.length) { return false; }
    const drag = this.start('tangent', document);

    drag.tangents = tangents; drag.button = button;

    return true;
  }

  private selectContext (document: SequencerDocument, context: SequencerContext): void {
    const tracks = this.state.curveMode ? this.state.curveTracks : document.selectedTracks;
    const rowSelected = context.row && (this.state.curveMode ? this.state.activeChannel ? context.row.id === this.state.activeChannel : tracks.has(context.row.id) : this.isRowSelected(context.row));

    if (context.keys?.length) {
      if (!context.keys.some(item => document.selectedKeys.has(item.key.id))) {
        document.clearSelection(); context.keys.forEach(item => document.selectedKeys.add(item.key.id));
      }
    } else if (context.section && !document.selectedSections.has(context.section.clip.getInstanceId())) {
      document.clearSelection(); document.selectedSections.add(context.section.clip.getInstanceId());
    } else if (context.row && !rowSelected) {
      document.clearSelection(); document.selectedTracks.add(context.row.track.getInstanceId());
      this.state.activeChannel = context.row.kind === 'channel' || context.row.kind === 'group' ? context.row.id : '';
      this.state.captureCurveSelection(document);
    }
  }

  private hitTest (position: math.Vector2): { keyHit?: KeyHit, tangent?: TangentHit, sectionHit?: SectionHit, sectionEdge: boolean } {
    const keyHit = [...this.keyHits].reverse().find(hit => Math.hypot(hit.x - position.x, hit.y - position.y) <= 8);
    const tangent = this.tangentHits.find(hit => Math.hypot(hit.x - position.x, hit.y - position.y) <= 7);
    const sectionHit = [...this.sectionHits].reverse().find(hit => this.contains(hit, position.x, position.y));
    const sectionEdge = !!sectionHit && !this.state.curveMode &&
      (Math.abs(position.x - sectionHit.x) < 5 || Math.abs(position.x - sectionHit.x - sectionHit.width) < 5);

    return { keyHit, tangent, sectionHit, sectionEdge };
  }

  private interact (document: SequencerDocument, event: InputEventMouseButton | InputEventMouseMotion, phase: PointerPhase): void {
    const clicked = (button: MouseButton): boolean => phase === 'down' && event instanceof MouseEventButton && event.buttonIndex === button;
    const wheel = phase === 'wheel' && event instanceof MouseEventButton ? event.factor * (event.buttonIndex === MouseButton.WheelUp ? 1 : event.buttonIndex === MouseButton.WheelDown ? -1 : 0) : 0;
    const horizontalWheel = phase === 'wheel' && event instanceof MouseEventButton ? event.factor * (event.buttonIndex === MouseButton.WheelLeft ? 1 : event.buttonIndex === MouseButton.WheelRight ? -1 : 0) : 0;

    if (this.drag?.kind === 'splitter') {
      this.updateDrag(document, event, phase);

      return;
    }
    const mouse = this.pointer;
    const modified = event.ctrlPressed || event.metaPressed;
    const { keyHit, tangent, sectionHit, sectionEdge } = this.hitTest(mouse);
    const row = this.rowAt(mouse.y);
    const hovered = this.hover || this.outlinerHover || this.overviewHover;
    const graph = this.hover && mouse.y >= this.plot.y && mouse.x >= this.graphLeft && mouse.x <= this.plot.x + this.plot.width;

    this.selectedTangents = this.selectedTangents.filter(hit => this.state.curveMode && document.selectedKeys.has(hit.item.key.id) &&
      hit.item.channel.keys.includes(hit.item.key));
    if (hovered && clicked(MouseButton.Left) && !tangent) { this.selectedTangents = []; }
    if (!this.drag && this.editingValue) { return; }
    if ((!this.drag || this.drag.kind === 'pan') && hovered && (wheel !== 0 || horizontalWheel !== 0)) {
      const playheadVisible = document.currentTime >= this.state.viewStart && document.currentTime <= this.state.viewEnd;
      const anchor = playheadVisible ? document.currentTime : this.timeAt(mouse.x);

      if (this.outlinerHover || mouse.x > this.plot.x + this.plot.width) {
        this.state.scrollY = Math.max(0, Math.min(this.scrollMax, this.state.scrollY - wheel * L.rowHeight * 2));
      } else if (this.state.curveMode && graph && wheel !== 0) {
        const factor = 1 - Math.max(-0.9, Math.min(0.9, wheel * 0.1));

        this.zoomView(factor, factor, this.drag ? this.timeAt(mouse.x) : anchor, this.valueAt(mouse.y));
      } else if (modified && wheel !== 0) {
        this.zoomView(Math.pow(0.8, wheel), 1, anchor, this.valueAt(mouse.y));
      } else if (event.shiftPressed) {
        const delta = -wheel * (this.state.viewEnd - this.state.viewStart) * 0.1;

        this.state.viewStart += delta; this.state.viewEnd += delta;
      } else if (!this.state.curveMode) { this.state.scrollY = Math.max(0, Math.min(this.scrollMax, this.state.scrollY - wheel * L.rowHeight * 2)); }
      if (this.hover && horizontalWheel !== 0) {
        const delta = -horizontalWheel * 50 / this.pixelsPerSecond;

        this.state.viewStart += delta; this.state.viewEnd += delta;
      }
      if (this.drag) {
        this.drag.x = mouse.x; this.drag.y = mouse.y; this.drag.gesture.rebase(mouse.x, mouse.y);
        this.drag.view = [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax, this.state.scrollY];
      }
    }
    if (!this.drag && graph && clicked(MouseButton.Middle)) {
      if (event.altPressed) {
        const drag = this.start('pan', document);

        drag.button = MouseButton.Middle; drag.graph = this.state.curveMode; drag.horizontalOnly = true;
        drag.view = [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax, this.state.scrollY];
      } else {
        const curve = this.state.curveMode ? this.curveAt(document, mouse.x, mouse.y) : undefined;

        if (keyHit && !this.state.curveMode) {
          if (!keyHit.keys.some(item => document.selectedKeys.has(item.key.id))) {
            document.clearSelection(); keyHit.keys.forEach(item => document.selectedKeys.add(item.key.id));
          }
        } else if (!keyHit && !tangent && !(event.shiftPressed && document.selectedKeys.size) && (curve || !this.state.curveMode && row?.channels.length)) {
          const entries = curve ? [curve] : row!.channels;
          const time = this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond);

          if (entries.some(entry => !document.isLocked(entry.section.track) && time >= entry.section.clip.start && time <= entry.section.clip.start + entry.section.clip.duration)) {
            this.selectedTangents = [];
            document.begin('Insert and move key'); document.clearSelection();
            entries.forEach(entry => document.insertKey(entry.section, entry.channel, time,
              this.state.curveMode && !modified ? this.valueAt(mouse.y) : undefined, this.state.curveMode && modified));
            document.changed();
          }
        }
        if (!this.state.curveMode || !this.startTangentDrag(document, MouseButton.Middle)) {
          this.startKeyDrag(document, MouseButton.Middle);
        }
      }
    }
    if (!this.drag && hovered && clicked(MouseButton.Right)) {
      const context: SequencerContext = { row: this.outlinerHover || !this.state.curveMode ? row : undefined,
        section: sectionHit?.section, channel: keyHit?.keys[0]?.channel, keys: keyHit?.keys,
        time: this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond) };
      const zoom = !this.outlinerHover && event.altPressed && (this.state.curveMode || event.shiftPressed);
      const drag = this.start(zoom ? 'zoom' : 'pan', document);

      drag.button = MouseButton.Right; drag.context = zoom ? undefined : context; drag.graph = this.state.curveMode && graph;
      drag.view = [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax, this.state.scrollY];
    }
    if (!this.drag && this.outlinerHover && row && clicked(MouseButton.Left)) {
      const expanderX = this.rect.x + L.treePadding + row.depth * L.treeIndent;

      if (row.expandable && mouse.x >= expanderX && mouse.x < expanderX + L.expanderSize) {
        if (this.state.expanded.has(row.id)) { this.state.expanded.delete(row.id); } else { this.state.expanded.add(row.id); }
      } else {
        if (this.state.curveMode && (modified || event.shiftPressed)) {
          this.state.curveTracks.forEach(id => document.selectedTracks.add(id));
        }
        if (!modified && !event.shiftPressed) { document.clearSelection(); }
        if (modified && document.selectedTracks.has(row.track.getInstanceId())) { document.selectedTracks.delete(row.track.getInstanceId()); } else { document.selectedTracks.add(row.track.getInstanceId()); }
        this.state.activeChannel = row.kind === 'channel' || row.kind === 'group' ? row.id : '';
        this.state.captureCurveSelection(document);
        this.selectTrack(row.track);
        if (event instanceof MouseEventButton && event.doubleClick && row.expandable) {
          if (this.state.expanded.has(row.id)) { this.state.expanded.delete(row.id); } else { this.state.expanded.add(row.id); }
        } else if (row.kind === 'object' || row.kind === 'track') { this.start('track', document).track = row.track; }
        if (this.state.curveMode) { this.state.fitValues(document); }
      }
    }
    if (!this.drag && (this.hover || this.overviewHover) && clicked(MouseButton.Left)) {
      if (this.overviewHover) {
        const drag = this.start('overview', document);

        drag.view = [this.state.viewStart, this.state.viewEnd];
        const left = this.overview.x + Math.max(0, this.state.viewStart) / this.overviewExtent * this.overview.width;
        const right = this.overview.x + this.state.viewEnd / this.overviewExtent * this.overview.width;

        drag.edge = Math.abs(mouse.x - left) < 8 ? 'left' : Math.abs(mouse.x - right) < 8 ? 'right' : undefined;
      } else if (mouse.y < this.plot.y || this.state.curveMode && this.scrubKey) {
        const drag = this.start('scrub', document);

        drag.resume = !document.composition.getPaused();
        document.setTime(Math.max(0, this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond)));
      } else if (mouse.x > this.plot.x + this.plot.width) { this.start('scroll', document).value = this.state.scrollY; } else if (event.altPressed && (Math.abs(mouse.x - this.timeX(this.state.playbackStart)) < 6 || Math.abs(mouse.x - this.timeX(this.state.playbackEnd)) < 6)) {
        this.start(Math.abs(mouse.x - this.timeX(this.state.playbackStart)) < 6 ? 'range-start' : 'range-end', document);
      } else if (tangent && !document.isLocked(tangent.item.section.track)) {
        this.selectedTangents = this.tangentHits.filter(hit => hit.side === tangent.side && document.selectedKeys.has(hit.item.key.id));
        this.startTangentDrag(document, MouseButton.Left);
      } else if (keyHit && !sectionEdge) {
        this.selectedTangents = [];
        if (this.state.curveMode && event.altPressed) {
          keyHit.keys.forEach(item => document.selectedKeys.delete(item.key.id));

          return;
        }
        if (!keyHit.keys.some(item => document.selectedKeys.has(item.key.id))) {
          if (!modified && !event.shiftPressed) { document.clearSelection(); }
          keyHit.keys.forEach(item => document.selectedKeys.add(item.key.id));
        } else if (modified) { keyHit.keys.forEach(item => document.selectedKeys.delete(item.key.id)); }
        this.selectTrack(keyHit.keys[0].section.track);
        const drag = this.startKeyDrag(document);

        if (drag) { drag.duplicate = !this.state.curveMode && event.altPressed; }
      } else if (sectionHit && !this.state.curveMode) {
        const section = sectionHit.section;

        if (!document.selectedSections.has(section.clip.getInstanceId())) {
          if (!modified && !event.shiftPressed) { document.clearSelection(); }
          document.selectedSections.add(section.clip.getInstanceId());
        } else if (modified && !sectionEdge) { document.selectedSections.delete(section.clip.getInstanceId()); }
        this.selectTrack(section.track);
        if (!document.isLocked(section.track)) {
          const drag = this.start('section', document);

          drag.sections = document.selectedSectionItems.filter(item => !document.isLocked(item.track)).map(item => ({
            section: item, start: item.clip.start, duration: item.clip.duration, keys: item.channels.map(channel => channel.keys.map(key => ({ ...key }))),
            position: item.position?.snapshot(),
          }));
          drag.edge = Math.abs(mouse.x - sectionHit.x) < 7 ? 'left' : Math.abs(mouse.x - sectionHit.x - sectionHit.width) < 7 ? 'right' : undefined;
          drag.duplicate = !drag.edge && event.altPressed;
        }
      } else {
        const drag = this.start('marquee', document);

        drag.initialSelection = modified || event.shiftPressed || event.altPressed ? new Set(document.selectedKeys) : new Set();
        if (!modified && !event.shiftPressed && !event.altPressed) { document.selectedKeys.clear(); document.selectedSections.clear(); }
        if (this.state.curveMode && graph) {
          const entry = this.curveAt(document, mouse.x, mouse.y);

          if (entry) {
            drag.context = { ...entry, time: this.timeAt(mouse.x), keys: entry.channel.keys.map(key => ({ ...entry, key })) };
          }
        }
      }
    }
    this.updateDrag(document, event, phase);
  }

  private updateDrag (document: SequencerDocument, event: InputEventMouseButton | InputEventMouseMotion, phase: PointerPhase): void {
    const drag = this.drag;

    if (!drag) { return; }
    const mouse = this.pointer;
    const down = phase !== 'up';

    if (!down) {
      if (drag.kind === 'pan' && !drag.moved && drag.context) {
        this.selectContext(document, drag.context); this.context = drag.context;
      }
      if (drag.kind === 'marquee' && !drag.moved && drag.context?.keys) {
        CurveSelection.click(document.selectedKeys, drag.context.keys.map(item => item.key.id), event.ctrlPressed || event.metaPressed, event.altPressed, drag.initialSelection);
      }
      if (drag.kind === 'track' && drag.moved && drag.track) {
        const row = this.rowAt(mouse.y);

        if (row && (row.kind === 'track' || row.kind === 'object')) {
          const center = this.plot.y + row.top + row.height / 2 - this.state.scrollY;

          document.reorderTrack(drag.track, row.track, mouse.y >= center);
        }
      }
      if (drag.kind === 'scrub' && drag.resume) { void document.composition.resume(); }
      document.commit(); this.drag = undefined;

      return;
    }
    const { dx, dy } = drag.gesture.update(mouse.x, mouse.y, event.shiftPressed);

    drag.moved = drag.gesture.moved; drag.axis = drag.gesture.axis;
    if (drag.moved && drag.duplicate) {
      drag.duplicate = false;
      if (drag.keys) {
        document.selectedKeys.clear();
        const spatialCopies = new Map<string, string>();

        drag.keys = drag.keys.map(seed => {
          const item = document.duplicateKey(seed.item, spatialCopies);

          document.selectedKeys.add(item.key.id);

          return { ...seed, item };
        });
      } else if (drag.sections) {
        document.selectedSections.clear();
        drag.sections = drag.sections.map(seed => {
          const section = document.duplicateSection(seed.section, seed.start);

          document.selectedSections.add(section.clip.getInstanceId());

          return { ...seed, section };
        });
      }
    }
    if (drag.kind === 'scrub') {
      document.setTime(Math.max(0, this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond)));
    } else if (drag.kind === 'splitter') {
      this.state.resizeOutliner(drag.value + mouse.x - drag.x, this.rect.width);
    } else if (drag.kind === 'pan' && drag.view) {
      const axis = drag.horizontalOnly ? 'x' : drag.graph ? drag.axis : undefined;
      const dt = axis === 'y' ? 0 : dx / this.pixelsPerSecond;
      const dv = axis === 'x' ? 0 : dy / this.plot.height * (drag.view[3] - drag.view[2]);

      this.state.viewStart = drag.view[0] - dt; this.state.viewEnd = drag.view[1] - dt;
      if (drag.graph) { this.state.curveMin = drag.view[2] + dv; this.state.curveMax = drag.view[3] + dv; } else if (!drag.horizontalOnly) {
        this.state.scrollY = Math.max(0, Math.min(this.scrollMax, drag.view[4] - dy));
      }
    } else if (drag.kind === 'zoom' && drag.view) {
      const factor = Math.exp(-dx * 0.01);

      this.zoomView(factor, drag.graph ? event.shiftPressed ? Math.exp(dy * 0.01) : factor : 1, drag.time, drag.value, drag.view);
    } else if (drag.kind === 'overview' && drag.view) {
      const dt = dx / this.overview.width * this.overviewExtent;

      if (drag.edge === 'left') { this.state.viewStart = Math.min(drag.view[1] - 2 / this.state.frameRate, drag.view[0] + dt); } else if (drag.edge === 'right') { this.state.viewEnd = Math.max(drag.view[0] + 2 / this.state.frameRate, drag.view[1] + dt); } else { this.state.viewStart = drag.view[0] + dt; this.state.viewEnd = drag.view[1] + dt; }
    } else if (drag.kind === 'scroll') { this.state.scrollY = Math.max(0, Math.min(this.scrollMax, drag.value + dy * (this.scrollMax + this.plot.height) / this.plot.height)); } else if (drag.kind === 'range-start') { this.state.playbackStart = Math.max(0, Math.min(this.state.playbackEnd - 1 / this.state.frameRate, this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond))); } else if (drag.kind === 'range-end') { this.state.playbackEnd = Math.max(this.state.playbackStart + 1 / this.state.frameRate, this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond)); } else if (drag.kind === 'keys' && drag.moved && drag.keys?.length) {
      const anchor = drag.keys[0], duration = anchor.item.section.clip.duration;
      const initial = anchor.item.section.clip.start + anchor.time * duration;
      const dt = this.state.curveMode && drag.axis === 'y' ? 0 :
        this.state.snap(initial + dx / this.pixelsPerSecond, document, this.pixelsPerSecond, document.selectedKeys) - initial;
      const dv = this.state.curveMode && drag.axis !== 'x' ? -dy * (drag.valueScale ?? 0) : 0;
      const sections = new Set<SequenceSection>();

      moveCurveKeys(drag.keys.map(seed => ({ time: seed.item.section.clip.start + seed.time * seed.item.section.clip.duration, value: seed.value,
        minTime: seed.item.section.clip.start, maxTime: seed.item.section.clip.start + seed.item.section.clip.duration,
        apply: position => {
          this.curveModel(document, seed.item.section, seed.item.channel).setKeyPosition(seed.item.key.id, position);
          sections.add(seed.item.section);
        } })), dt, dv);
      drag.keys.forEach(seed => updateAutoTangents(seed.item.channel.keys));
      sections.forEach(section => document.write(section)); document.changed();
    } else if (drag.kind === 'section' && drag.moved && drag.sections?.length) {
      const anchor = drag.sections[0];
      const initial = drag.edge === 'right' ? anchor.start + anchor.duration : anchor.start;
      const dt = this.state.snap(initial + dx / this.pixelsPerSecond, document, this.pixelsPerSecond, document.selectedSections) - initial;

      for (const seed of drag.sections) {
        const section = seed.section;

        section.clip.start = seed.start; section.clip.duration = seed.duration;
        section.position = seed.position ? PositionPathModel.restore(seed.position) : undefined;
        section.channels.forEach((channel, index) => channel.keys = seed.keys[index].map(key => ({ ...key })));
        if (drag.edge) {
          const start = drag.edge === 'left' ? Math.max(0, Math.min(seed.start + seed.duration - 1 / this.state.frameRate, seed.start + dt)) : seed.start;
          const end = drag.edge === 'right' ? Math.max(seed.start + 1 / this.state.frameRate, seed.start + seed.duration + dt) : seed.start + seed.duration;

          document.resizeSection(section, start, end, event.ctrlPressed || event.metaPressed);
        } else {
          const minStart = Math.min(...drag.sections.map(item => item.start));

          section.clip.start = seed.start + Math.max(-minStart, dt); document.write(section);
        }
      }
      document.changed();
    } else if (drag.kind === 'tangent' && drag.moved && drag.tangents?.length) {
      const sections = new Set<SequenceSection>();

      for (const seed of drag.tangents) {
        const { item, side } = seed;
        const index = item.channel.keys.indexOf(item.key);
        const neighbor = item.channel.keys[index + (side === 'in' ? -1 : 1)];

        if (!neighbor) { continue; }
        let x = seed.x + dx, y = seed.y + dy;

        if (event.shiftPressed) {
          const keyX = this.timeX(item.section.clip.start + item.key.time * item.section.clip.duration), keyY = this.valueY(item.key.value);
          const angle = Math.round(Math.atan2(y - keyY, x - keyX) / (Math.PI / 4)) * Math.PI / 4;
          const length = Math.hypot(x - keyX, y - keyY);

          x = keyX + Math.cos(angle) * length; y = keyY + Math.sin(angle) * length;
        }
        const t = (this.timeAt(x) - item.section.clip.start) / item.section.clip.duration;
        const delta = side === 'in' ? Math.min(-1e-6, t - item.key.time) : Math.max(1e-6, t - item.key.time);
        const slope = (this.valueAt(y) - item.key.value) / delta;

        item.key[side === 'in' ? 'inSlope' : 'outSlope'] = slope;
        item.key[side === 'in' ? 'inWeight' : 'outWeight'] = Math.min(2.95, Math.abs(delta) * 3 / Math.max(1e-6, Math.abs(neighbor.time - item.key.time)));
        if (event.altPressed || item.key.tangentMode === 'break') { item.key.tangentMode = 'break'; } else { item.key.tangentMode = 'user'; item.key.inSlope = item.key.outSlope = slope; }
        sections.add(item.section);
      }
      if (sections.size) { sections.forEach(section => document.write(section)); document.changed(); }
    } else if (drag.kind === 'marquee' && drag.moved) {
      document.selectedKeys.clear(); drag.initialSelection?.forEach(id => document.selectedKeys.add(id));
      const minX = Math.min(drag.x, mouse.x), maxX = Math.max(drag.x, mouse.x);
      const minY = Math.min(drag.y, mouse.y), maxY = Math.max(drag.y, mouse.y);

      for (const hit of this.keyHits) {
        if (hit.x >= minX && hit.x <= maxX && hit.y >= minY && hit.y <= maxY) {
          hit.keys.forEach(item => {
            if (this.state.curveMode && (event.altPressed || (event.ctrlPressed || event.metaPressed) && drag.initialSelection?.has(item.key.id))) {
              document.selectedKeys.delete(item.key.id);
            } else { document.selectedKeys.add(item.key.id); }
          });
        }
      }
      if (!this.state.curveMode && !event.shiftPressed && !event.ctrlPressed && !event.metaPressed) {
        document.selectedSections.clear();
        for (const hit of this.sectionHits) {
          if (hit.x < maxX && hit.x + hit.width > minX && hit.y < maxY && hit.y + hit.height > minY) { document.selectedSections.add(hit.section.clip.getInstanceId()); }
        }
      }
    }
  }

  private contains (rect: Rect, x: number, y: number): boolean { return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height; }
  private fill (rect: Rect, color: math.Color, rounding = 0, topOnly = false): void {
    if (!rounding) {
      this.fillRect(rect.x, rect.y, rect.width, rect.height, color);

      return;
    }
    const box = editorBox(color, 0, rounding);

    if (topOnly) { box.setCornerRadii(rounding, rounding, 0, 0); }
    this.drawStyleBox(box, rect.x, rect.y, rect.width, rect.height);
  }
  private border (rect: Rect, color: math.Color, width = 1, rounding = 0): void {
    const box = editorBox(editorColors.clear, 0, rounding, color);

    box.setBorderWidths(width, width, width, width); this.drawStyleBox(box, rect.x, rect.y, rect.width, rect.height);
  }
  private text (x: number, y: number, value: string, color: math.Color, fontSize = EDITOR_FONT_SIZE): void { this.drawText(x, y, value, fontSize, color, EDITOR_FONT); }
  private line (x1: number, y1: number, x2: number, y2: number, color: math.Color, width = 1): void { this.drawLine(x1, y1, x2, y2, color, width); }
  private diamond (x: number, y: number, color: math.Color, radius: number): void { CurveEditor.diamond(this, x, y, color, radius, C.line); }
  private drawNumericKey (x: number, y: number, key: SequenceKey, selected: boolean): void {
    const hovered = Math.hypot(this.pointer.x - x, this.pointer.y - y) <= 7, radius = selected || hovered ? 5 : 4;
    const color = selected ? C.selectedKey : hovered ? editorColors.foregroundHover : key.interpolationMode === InterpolationMode.Linear ? C.keyLinear : key.interpolationMode === InterpolationMode.Constant ? C.keyConstant : key.tangentMode === 'auto' ? C.keyAuto : key.tangentMode === 'break' ? C.keyBreak : C.keyUser;

    if (key.interpolationMode === InterpolationMode.Linear) { this.fillTriangle(x, y - radius, x + radius, y + radius, x - radius, y + radius, color); this.drawTriangle(x, y - radius, x + radius, y + radius, x - radius, y + radius, C.line, .8); } else if (key.interpolationMode === InterpolationMode.Constant) { this.fillRect(x - radius, y - radius, radius * 2, radius * 2, color); this.drawRect(x - radius, y - radius, radius * 2, radius * 2, C.line, .8); } else { this.fillCircle(x, y, radius, color); this.drawCircle(x, y, radius, C.line, .8); }
  }
}

class SequenceRowControl extends Container {
  private rowData!: SequenceRow;
  private document!: SequencerDocument;
  private readonly number: NumberEdit;
  private readonly buttons: EditorIconButton[] = [];
  constructor (engine: Engine, private readonly canvas: SequencerCanvas) {
    super(engine); this.focusMode = FocusMode.All;
    this.number = append(this, new NumberEdit(engine)); this.number.precision = 2;
    this.number.beginEdit = () => { this.document.setTime(this.document.currentTime); this.document.begin('Edit channel value'); };
    this.number.changed = value => {
      const entry = this.rowData.channels[0];

      if (!entry) { return; }
      const selected = new Set(this.document.selectedKeys);

      this.document.begin('Edit channel value'); this.document.insertKey(entry.section, entry.channel, this.document.currentTime, value);
      this.document.selectedKeys.clear(); selected.forEach(id => this.document.selectedKeys.add(id)); this.document.changed();
    };
    this.number.endEdit = canceled => canceled ? this.document.cancel() : this.document.commit();
    for (const [icon, hint] of [['previousKey', 'Previous Key'], ['addKey', 'Add Key'], ['nextKey', 'Next Key'], ['view', 'Toggle Track Visibility']] as const) {
      const button = append(this, new EditorIconButton(engine, icon));

      button.iconSize = 14; setTooltip(button, hint); this.buttons.push(button);
    }
    this.buttons[0].on('pressed', () => this.step(-1)); this.buttons[2].on('pressed', () => this.step(1));
    this.buttons[1].on('pressed', () => {
      if (this.rowData.kind === 'object') {
        this.canvas.contextRequested?.({ row: this.rowData, time: this.document.currentTime }, screenPosition(this.buttons[1], 0, this.buttons[1].height));
      } else {
        this.document.edit('Add property key', () => this.rowData.channels.forEach(entry => this.document.insertKey(entry.section, entry.channel, this.document.currentTime)));
      }
    });
    this.buttons[3].on('pressed', () => this.document.toggleMute(this.rowData.track));
  }
  bind (row: SequenceRow, document: SequencerDocument): void {
    this.rowData = row; this.document = document; this.buttons[1].iconName = row.kind === 'object' ? 'plus' : 'addKey'; this.number.visible = row.kind === 'channel' && row.channels[0]?.channel.kind === 'number' && this.width >= 270;
    this.buttons[3].iconName = document.isMuted(row.track) ? 'hidden' : 'view';
    this.buttons.forEach((button, index) => { button.visible = index === 3 ? row.kind === 'object' || row.kind === 'track' : !!row.channels.length || index === 1 && row.kind === 'object'; });
    this.queueSort();
  }
  get isEditingValue (): boolean { return this.number.isEditing; }
  protected override sortChildren (): void {
    place(this.number, this.width - 160, 1, 64, this.height - 2);
    this.buttons.forEach((button, index) => place(button, this.width - 88 + index * 22, 1, 22, this.height - 2));
  }
  override update (dt: number): void {
    const entry = this.rowData?.channels[0];

    if (entry) {
      if (!this.number.isEditing) { this.number.value = this.document.channelValue(entry.section, entry.channel); }
      this.number.enabled = !this.document.isLocked(this.rowData.track) && entry.channel.pathView !== 'timing' && this.document.currentTime >= entry.section.clip.start && this.document.currentTime <= entry.section.clip.start + entry.section.clip.duration;
      this.buttons[1].disabled = this.document.isLocked(this.rowData.track);
    }
    super.update(dt);
  }
  override draw (): void {
    if (!this.rowData) { return; }
    const row = this.rowData, selected = this.canvas.isRowSelected(row);

    this.fillRect(0, 0, this.width, this.height, this.canvas.rowBackground(row));
    const indent = 4 + row.depth * 10;
    const hasIcon = row.kind === 'object' || row.kind === 'track';
    const icon = row.kind === 'object' ? 'object' : row.track.constructor.name === 'TransformTrack' ? 'transform' : row.track.constructor.name === 'ActivationTrack' ? 'view' : 'opacity';
    const tint = selected ? C.selectedText : C.text;
    const animated = (row.kind === 'group' || row.kind === 'channel') && row.channels.some(entry => entry.channel.keys.length > 0);
    const fontSize = animated ? EDITOR_FONT_SIZE : EDITOR_COMPACT_FONT_SIZE, fontStyle = animated ? 'italic' : 'normal';

    if (row.expandable) { paintIcon(this, this.canvas.state.expanded.has(row.id) ? 'caretDown' : 'caretRight', indent, (this.height - 16) / 2, 16, tint); }
    if (hasIcon) { paintIcon(this, icon, indent + 18, (this.height - 16) / 2, 16, row.kind === 'object' ? C.object : tint); }
    const x = indent + 20 + (hasIcon ? 20 : 0);
    const width = this.number.visible ? this.number.x - x - 4 : this.width - x - 96;
    const value = this.engine.renderingServer.graphics;

    value.pushClipRect(x, 0, Math.max(1, width), this.height);
    this.drawText(x, (this.height - this.measureText(row.label, fontSize, EDITOR_FONT, 'normal', fontStyle).lineHeight) / 2, row.label, fontSize, tint, EDITOR_FONT, 'normal', fontStyle); value.popClipRect();
    this.drawLine(0, this.height - 1, this.width, this.height - 1, C.line);
  }
  override onMouseDown (event: InputEventMouseButton): void { this.grabFocus(); this.canvas.pointerEvent(event, 'down'); }
  override onMouseMove (event: InputEventMouseMotion): void { this.canvas.pointerEvent(event, 'move'); }
  override onMouseUp (event: InputEventMouseButton): void {
    if (event.canceled) { this.canvas.cancel(this.document); } else { this.canvas.pointerEvent(event, 'up'); }
    event.accept();
  }
  override onMouseWheel (event: InputEventMouseButton): void { this.canvas.pointerEvent(event, 'wheel'); }
  override onKeyDown (event: InputEventKey): void { this.canvas.shortcut?.(event); }
  private step (direction: number): void {
    const times = this.rowData.channels.flatMap(({ section, channel }) => channel.keys.map(key => section.clip.start + key.time * section.clip.duration))
      .filter(time => direction > 0 ? time > this.document.currentTime + 1e-6 : time < this.document.currentTime - 1e-6);

    if (times.length) { this.document.setTime(direction > 0 ? Math.min(...times) : Math.max(...times)); }
  }
}
