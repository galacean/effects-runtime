import { BezierCurve, InterpolationMode } from '@galacean/effects';
import type { TrackAsset } from '@galacean/effects';
import { ImGui } from '../../imgui';
import { drawEditorArrow } from '../../widgets/editor-arrow';
import { controlPoint, makeKey, updateAutoTangents } from './curve-data';
import type { SequenceKey } from './curve-data';
import type { KeySelection, SequenceChannel, SequenceSection, SequencerDocument } from './sequencer-document';
import type { SequencerState } from './sequencer-state';
import type { SequenceRow } from './sequencer-state';
import { SEQUENCE_COLORS as C, SEQUENCE_LAYOUT as L, niceStep } from './sequencer-style';
import { drawSequenceIcon } from './sequencer-icons';
import type { SequenceIcon } from './sequencer-icons';

interface Rect { x: number, y: number, width: number, height: number }
interface KeyHit { x: number, y: number, keys: KeySelection[] }
interface SectionHit extends Rect { section: SequenceSection }
interface TangentHit { x: number, y: number, item: KeySelection, side: 'in' | 'out' }
interface SectionSeed { section: SequenceSection, start: number, duration: number, keys: SequenceKey[][] }
interface Drag {
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
  button?: ImGui.MouseButton,
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

export class SequencerCanvas {
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
  private curves = new Map<SequenceChannel, { revision: number, curve: BezierCurve }>();
  private valueEdit?: { id: string, cancelled: boolean };
  private valueHovered = false;
  private valueActive = false;

  constructor (readonly state: SequencerState, private readonly selectTrack: (track: TrackAsset) => void) {}

  get editingValue (): boolean { return this.valueActive || !!this.valueEdit; }
  get header (): Rect { return { x: this.rect.x, y: this.rect.y, width: this.state.outlinerWidth - 4, height: L.rulerHeight }; }
  private get graphLeft (): number { return this.plot.x + (this.state.curveMode ? L.curveGutter : 0); }
  get pixelsPerSecond (): number { return (this.plot.x + this.plot.width - this.graphLeft) / Math.max(1e-6, this.state.viewEnd - this.state.viewStart); }
  private timeX (time: number): number { return this.graphLeft + (time - this.state.viewStart) * this.pixelsPerSecond; }
  private timeAt (x: number): number { return this.state.viewStart + (x - this.graphLeft) / this.pixelsPerSecond; }
  private valueY (value: number): number { return this.plot.y + (this.state.curveMax - value) / (this.state.curveMax - this.state.curveMin) * this.plot.height; }
  private valueAt (y: number): number { return this.state.curveMax - (y - this.plot.y) / this.plot.height * (this.state.curveMax - this.state.curveMin); }

  private get outlinerColumns () {
    const navigation = this.state.outlinerWidth >= 300;
    const mute = this.plot.x - L.columnRightPadding;
    const next = mute - L.columnSpacing - 4;
    const key = navigation ? next - L.columnSpacing : next;
    const previous = key - L.columnSpacing;
    const controlsLeft = (navigation ? previous : key) - 15;
    const valueRight = controlsLeft - 9;

    return { navigation, mute, previous, key, next, controlsLeft, valueRight, valueLeft: valueRight - L.valueWidth };
  }

  private rowLabelX (row: SequenceRow): number {
    const hasIcon = row.kind === 'object' || row.kind === 'track';

    return this.rect.x + L.treePadding + row.depth * L.treeIndent + L.expanderSize + 2 + (hasIcon ? L.rowIconSize + 4 : 4);
  }

  private showsRowValue (row: SequenceRow): boolean { return row.kind === 'channel' && this.outlinerColumns.valueLeft >= this.rowLabelX(row) + 20; }

  draw (document: SequencerDocument, width: number, height: number): void {
    const origin = ImGui.GetCursorScreenPos();

    this.rect = { x: origin.x, y: origin.y, width, height };
    this.state.outlinerWidth = Math.max(150, Math.min(this.state.outlinerWidth, Math.max(150, width * 0.62)));
    this.plot = { x: origin.x + this.state.outlinerWidth, y: origin.y + L.rulerHeight,
      width: Math.max(50, width - this.state.outlinerWidth - 10), height: Math.max(30, height - L.rulerHeight) };
    this.rows = this.state.rows(document);
    const last = this.rows.at(-1);

    this.scrollMax = Math.max(0, (last ? last.top + last.height : 0) - this.plot.height);
    this.state.scrollY = Math.max(0, Math.min(this.state.scrollY, this.scrollMax));
    this.keyHits = []; this.sectionHits = []; this.tangentHits = [];
    const dl = ImGui.GetWindowDrawList();

    this.fill(this.rect, C.background);
    if (this.state.curveMode) { this.fill(this.plot, C.curveBackground); }
    this.fill({ x: origin.x, y: origin.y, width: this.state.outlinerWidth, height }, C.outliner);
    this.fill({ x: this.plot.x, y: origin.y, width: this.plot.width + 10, height: L.rulerHeight }, C.toolbar);
    this.drawRuler(document);
    dl.PushClipRect(new ImGui.Vec2(this.plot.x, this.plot.y), new ImGui.Vec2(this.plot.x + this.plot.width, this.plot.y + this.plot.height), true);
    if (this.state.curveMode) { this.drawCurves(document); } else { this.drawTimeline(document); }
    this.drawPlaybackRange();
    dl.PopClipRect();
    this.drawOutliner(document);
    this.drawPlayhead(document);
    this.drawScrollbar();
    this.line(this.plot.x - 1, origin.y, this.plot.x - 1, origin.y + height, C.line);

    ImGui.SetCursorScreenPos(new ImGui.Vec2(this.plot.x, this.rect.y));
    ImGui.InvisibleButton('##SequencePlot', new ImGui.Vec2(this.plot.width + 10, height),
      ImGui.ButtonFlags.MouseButtonLeft | ImGui.ButtonFlags.MouseButtonRight | ImGui.ButtonFlags.MouseButtonMiddle);
    this.hover = ImGui.IsItemHovered();
    this.outlinerHover = ImGui.IsWindowHovered(ImGui.HoveredFlags.AllowWhenBlockedByActiveItem) &&
      this.contains({ x: this.rect.x, y: this.plot.y, width: this.state.outlinerWidth - 4, height: this.plot.height }, ImGui.GetMousePos().x, ImGui.GetMousePos().y);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(this.plot.x - 4, this.rect.y));
    ImGui.InvisibleButton('##SequenceSplitter', new ImGui.Vec2(7, height));
    if (ImGui.IsItemHovered()) { ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW); }
    if (ImGui.IsItemActivated()) { this.start('splitter', document); }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + height));
    ImGui.Dummy(new ImGui.Vec2(width, 0));
  }

  processInput (document: SequencerDocument): void { this.interact(document); }

  drawFooter (document: SequencerDocument, y: number): void {
    const saved = ImGui.GetCursorScreenPos();

    this.overview = { x: this.plot.x + 10, y: y + 8, width: Math.max(20, this.plot.width - 20), height: 14 };
    this.drawOverview(document);
    this.line(this.plot.x - 1, y, this.plot.x - 1, y + L.footerHeight, C.line);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(this.overview.x, y));
    ImGui.InvisibleButton('##SequenceRangeSlider', new ImGui.Vec2(this.overview.width, L.footerHeight));
    this.overviewHover = ImGui.IsItemHovered();
    if (this.overviewHover) { ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW); }
    ImGui.SetCursorScreenPos(saved);
  }

  cancel (document: SequencerDocument): void {
    this.selectedTangents = [];
    if (this.valueEdit) { document.commit(); this.valueEdit = undefined; }
    if (this.drag) { document.cancel(); this.drag = undefined; }
  }

  private drawRuler (document: SequencerDocument): void {
    const s = this.state;
    const playheadX = Math.round(this.timeX(document.currentTime));
    const playheadLabel = s.formatTime(document.currentTime);
    const playheadLabelWidth = ImGui.CalcTextSize(playheadLabel).x;
    const playheadLabelX = playheadX + 9 + playheadLabelWidth <= this.plot.x + this.plot.width
      ? playheadX + 9 : playheadX - 9 - playheadLabelWidth;
    const playheadLeft = Math.min(playheadX - 7, playheadLabelX - 2);
    const playheadRight = Math.max(playheadX + 7, playheadLabelX + playheadLabelWidth + 2);
    const step = this.tickStep();
    const frames = Math.round(step * s.frameRate);
    const start = Math.floor(s.viewStart / step) * step;
    const dl = ImGui.GetWindowDrawList();

    dl.PushClipRect(new ImGui.Vec2(this.plot.x, this.rect.y), new ImGui.Vec2(this.plot.x + this.plot.width, this.plot.y), true);

    for (let time = start; time <= s.viewEnd + step; time += step) {
      const x = this.timeX(time);

      if (x < this.plot.x || x > this.plot.x + this.plot.width) { continue; }
      this.line(x, this.rect.y + 23, x, this.plot.y, C.muted);
      const label = s.formatTime(time);
      const labelEnd = x + 4 + ImGui.CalcTextSize(label).x;

      if (labelEnd <= this.plot.x + this.plot.width && (x + 4 > playheadRight || labelEnd < playheadLeft)) {
        this.text(x + 4, this.rect.y + 3, label, C.text);
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
      dl.AddTriangleFilled(new ImGui.Vec2(playheadX - 7, this.plot.y - 8),
        new ImGui.Vec2(playheadX + 7, this.plot.y - 8), new ImGui.Vec2(playheadX, this.plot.y - 1), ImGui.GetColorU32(C.playhead));
      this.text(playheadLabelX, this.rect.y + 3, playheadLabel, C.selectedText);
    }
    this.line(this.plot.x, this.plot.y - 1, this.plot.x + this.plot.width, this.plot.y - 1, C.line);
    dl.PopClipRect();
  }

  private drawTimeline (document: SequencerDocument): void {
    for (const [index, row] of this.rows.entries()) {
      const y = this.plot.y + row.top - this.state.scrollY;

      if (y + row.height < this.plot.y || y > this.plot.y + this.plot.height) { continue; }
      this.fill({ x: this.plot.x, y, width: this.plot.width, height: row.height },
        row.kind === 'object' ? C.group : row.kind === 'channel' ? C.channel : index % 2 ? C.rowAlt : C.row);
      if (document.selectedTracks.has(row.track.getInstanceId()) && (!this.state.activeChannel || row.id === this.state.activeChannel)) {
        this.fill({ x: this.plot.x, y, width: this.plot.width, height: row.height }, C.selectionTint);
      }
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
        const mouse = ImGui.GetMousePos();
        const hovered = ImGui.IsWindowHovered() && this.contains(rect, mouse.x, mouse.y);
        const header = hovered ? new ImGui.Vec4(Math.min(1, color.x + 0.06), Math.min(1, color.y + 0.06), Math.min(1, color.z + 0.06), 1) : color;
        const body = new ImGui.Vec4(header.x * 0.56, header.y * 0.56, header.z * 0.56, 1);

        this.fill(rect, expanded ? body : header, 4);
        if (expanded) { this.fill({ ...rect, height: row.height - 3 }, header, 4, ImGui.DrawCornerFlags.Top); }
        if (selected) { this.drawSectionSelection(rect, expanded ? row.height - 3 : rect.height, expanded); }
        this.border(rect, selected ? C.selectedKey : C.line, 1, 4);
        if (selected || hovered) {
          const tint = selected ? C.selectedKey : C.text;

          this.line(x + 3, rect.y + 5, x + 3, rect.y + rect.height - 5, tint);
          this.line(end - 3, rect.y + 5, end - 3, rect.y + rect.height - 5, tint);
        }
        if (rect.width > 50 && (!section.channels.length || clip.name && !clip.name.startsWith('TimelineClip') && clip.name !== row.label)) {
          const dl = ImGui.GetWindowDrawList();

          dl.PushClipRect(new ImGui.Vec2(Math.max(this.plot.x, x + 7), y), new ImGui.Vec2(Math.min(this.plot.x + this.plot.width, end - 6), y + row.height), true);
          this.text(x + 8, y + (row.height - ImGui.GetTextLineHeight()) / 2, clip.name?.startsWith('TimelineClip') ? row.label : clip.name || row.label, C.text);
          dl.PopClipRect();
        }
        this.sectionHits.push({ ...rect, height: row.height - 4, section });
      }
    }
    for (const row of this.rows) {
      const y = this.plot.y + row.top - this.state.scrollY, center = y + row.height / 2;

      if (y + row.height < this.plot.y || y > this.plot.y + this.plot.height || row.expandable && this.state.expanded.has(row.id)) { continue; }
      const atTime = new Map<number, KeySelection[]>();

      for (const { section, channel } of row.channels) {
        if (row.kind === 'channel' && channel.keys.length > 1) {
          const color = C.axes[channel.axis] ?? C.text;

          const tint = new ImGui.Vec4(color.x, color.y, color.z, 0.38);

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
    const dl = ImGui.GetWindowDrawList();
    const color = C.selectedKey;
    const left = Math.max(this.plot.x, rect.x + 2), right = Math.min(this.plot.x + this.plot.width, rect.x + rect.width - 2);
    const top = rect.y + 2, bottom = rect.y + headerHeight - 2;

    this.fill({ ...rect, height: headerHeight }, new ImGui.Vec4(color.x, color.y, color.z, 0.12), 4,
      expanded ? ImGui.DrawCornerFlags.Top : ImGui.DrawCornerFlags.All);
    if (right <= left || bottom <= top) { return; }
    dl.PushClipRect(new ImGui.Vec2(left, top), new ImGui.Vec2(right, bottom), true);
    const start = rect.x + Math.floor((left - rect.x) / 16) * 16 - headerHeight;
    const tint = new ImGui.Vec4(color.x, color.y, color.z, 0.24);

    for (let x = start; x < right; x += 16) { this.line(x, bottom, x + headerHeight, top, tint, 1); }
    dl.PopClipRect();
  }

  private drawOutliner (document: SequencerDocument): void {
    const dl = ImGui.GetWindowDrawList(), mouse = ImGui.GetMousePos();
    const columns = this.outlinerColumns;
    let editingRowVisible = false;

    this.valueHovered = false; this.valueActive = false;
    ImGui.PushClipRect(new ImGui.Vec2(this.rect.x, this.plot.y), new ImGui.Vec2(this.plot.x - 3, this.plot.y + this.plot.height), true);
    for (const row of this.rows) {
      const y = this.plot.y + row.top - this.state.scrollY;

      if (y + row.height < this.plot.y || y > this.plot.y + this.plot.height) { continue; }
      const selected = this.state.activeChannel ? row.id === this.state.activeChannel : document.selectedTracks.has(row.id);
      const hovered = ImGui.IsWindowHovered() && mouse.x < this.plot.x && mouse.x >= this.rect.x && mouse.y >= y && mouse.y < y + row.height;
      const background = row.kind === 'object' ? C.header : row.kind === 'channel' ? C.outliner : C.group;
      const color = row.kind === 'channel' ? C.axes[row.channels[0]?.channel.axis ?? 3] : C.text;
      const center = y + row.height / 2, textY = y + (row.height - ImGui.GetTextLineHeight()) / 2;
      const x = this.rect.x + L.treePadding + row.depth * L.treeIndent;

      this.fill({ x: this.rect.x, y, width: this.state.outlinerWidth - 3, height: row.height }, selected ? C.selection : hovered ? C.rowHover : background);
      if (row.kind === 'object') { this.line(this.rect.x, y, this.plot.x, y, C.line); }
      if (row.expandable) {
        const expanded = this.state.expanded.has(row.id);
        const caretHovered = hovered && mouse.x >= x && mouse.x < x + L.expanderSize;

        drawEditorArrow(x, center - L.expanderSize / 2, L.expanderSize, expanded ? 'down' : 'right',
          selected || caretHovered ? C.selectedText : C.muted);
      }
      const hasIcon = row.kind === 'object' || row.kind === 'track';
      const iconX = x + L.expanderSize + 2;
      const labelX = this.rowLabelX(row);
      const { valueRight, valueLeft } = columns;
      const labelRight = this.showsRowValue(row) ? valueLeft - 6 :
        row.kind === 'channel' ? columns.controlsLeft - 6 : valueRight - (document.isLocked(row.track) ? 22 : 6);

      if (hasIcon) {
        const type = document.assetType(row.track);

        drawSequenceIcon(row.kind === 'object' ? 'cube' : type === 'TransformTrack' ? 'transform' : type === 'ActivationTrack' ? 'view' : 'opacity',
          iconX, center - L.rowIconSize / 2, L.rowIconSize, row.kind === 'object' ? C.object : C.text);
      }
      dl.PushClipRect(new ImGui.Vec2(labelX, y), new ImGui.Vec2(Math.max(labelX, labelRight), y + row.height), true);
      this.text(labelX, textY, row.label, document.isLocked(row.track) ? C.muted : selected ? C.selectedText : color);
      dl.PopClipRect();
      const hasNumericEditor = this.showsRowValue(row) && row.channels[0]?.channel.kind === 'number';

      if (hasNumericEditor) {
        this.outlinerHitArea(row.id + ':label', this.rect.x, y, valueLeft - this.rect.x, row.height);
        this.outlinerHitArea(row.id + ':buttons', valueRight, y, this.plot.x - 4 - valueRight, row.height);
      } else { this.outlinerHitArea(row.id, this.rect.x, y, this.state.outlinerWidth - 4, row.height); }
      if (this.showsRowValue(row) && row.channels[0]) {
        const { section, channel } = row.channels.find(entry => document.currentTime >= entry.section.clip.start &&
          document.currentTime <= entry.section.clip.start + entry.section.clip.duration) ?? row.channels[0];
        const valueRect = { x: valueLeft, y: center - L.valueHeight / 2, width: L.valueWidth, height: L.valueHeight };

        if (channel.kind === 'number') {
          this.drawValueEditor(document, row, section, channel, valueRect, hovered);
          editingRowVisible ||= this.valueEdit?.id === channel.id;
        } else {
          this.fill(valueRect, C.input, 2);
          this.border(valueRect, C.inputBorder, 1, 2);
          this.text(valueLeft + 6, textY, 'Sprite', C.text);
        }
        this.fill({ x: valueLeft + 2, y: center - 8, width: 2, height: 16 }, color);
      }

      if (row.channels.length) {
        const keyed = row.channels.some(({ section, channel }) => channel.keys.some(key =>
          Math.abs(section.clip.start + key.time * section.clip.duration - document.currentTime) < 0.5 / this.state.frameRate));

        this.drawOutlinerControl('key', columns.key, center, hovered, keyed, 'Add key at playhead');
        if (columns.navigation) {
          this.drawOutlinerControl('previousKey', columns.previous, center, hovered, false, 'Previous key');
          this.drawOutlinerControl('nextKey', columns.next, center, hovered, false, 'Next key');
        }
      } else if (row.kind === 'object') {
        this.drawOutlinerControl('plus', columns.key, center, hovered, false, 'Add track');
      }
      if (row.kind === 'object' || row.kind === 'track') {
        this.drawOutlinerControl(document.isMuted(row.track) ? 'hidden' : 'view', columns.mute, center, hovered,
          document.isMuted(row.track), document.isMuted(row.track) ? 'Unmute track' : 'Mute track');
      }
      if (document.locked.has(row.track.getInstanceId()) && hasIcon) { drawSequenceIcon('lock', valueRight - 18, center - 7, 14, C.muted); }
      if (this.drag?.kind === 'track' && this.drag.moved && this.rowAt(mouse.y)?.id === row.id) {
        const dropY = mouse.y >= center ? y + row.height : y;

        this.line(this.rect.x, dropY, this.plot.x, dropY, C.selectedKey, 1);
      }
    }
    ImGui.PopClipRect();
    if (this.valueEdit && !editingRowVisible) { document.commit(); this.valueEdit = undefined; }
  }

  private outlinerHitArea (id: string, x: number, y: number, width: number, height: number): void {
    const top = Math.max(this.plot.y, y), bottom = Math.min(this.plot.y + this.plot.height, y + height);

    if (width <= 0 || bottom <= top) { return; }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(x, top));
    ImGui.InvisibleButton('##SequenceRow' + id, new ImGui.Vec2(width, bottom - top),
      ImGui.ButtonFlags.MouseButtonLeft | ImGui.ButtonFlags.MouseButtonRight);
  }

  private drawValueEditor (document: SequencerDocument, row: SequenceRow, section: SequenceSection, channel: SequenceChannel, rect: Rect, rowHovered: boolean): void {
    const io = ImGui.GetIO();
    const inRange = section.clip.duration > 0 && document.currentTime >= section.clip.start - 1e-8 &&
      document.currentTime <= section.clip.start + section.clip.duration + 1e-8;
    const disabled = document.isLocked(row.track) || !inRange;
    const hovered = rowHovered && this.contains(rect, io.MousePos.x, io.MousePos.y);
    const opacity = channel.group === 'Color' && channel.label === 'Opacity';
    const speed = channel.group === 'Rotation' ? 0.1 : 0.01;
    let value = document.channelValue(section, channel);

    ImGui.SetCursorScreenPos(new ImGui.Vec2(rect.x, rect.y));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, Math.max(0, (L.valueHeight - ImGui.GetFontSize()) / 2)));
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 2);
    ImGui.PushStyleVar(ImGui.StyleVar.FrameBorderSize, 1);
    ImGui.PushStyleColor(ImGui.Col.FrameBgHovered, C.input);
    ImGui.PushStyleColor(ImGui.Col.FrameBgActive, C.input);
    ImGui.PushStyleColor(ImGui.Col.Border, this.valueEdit?.id === channel.id ? C.selection : hovered ? C.hover : C.inputBorder);
    ImGui.BeginDisabled(disabled);
    ImGui.SetNextItemWidth(rect.width);
    const clickToInput = io.ConfigDragClickToInputText;

    io.ConfigDragClickToInputText = true;
    const changed = ImGui.DragFloat('##SequenceValue' + channel.id, next => value = next ?? value,
      speed, opacity ? 0 : -1e8, opacity ? 1 : 1e8, '%.2f', ImGui.SliderFlags.AlwaysClamp | ImGui.SliderFlags.NoRoundToFormat);

    io.ConfigDragClickToInputText = clickToInput;
    const active = ImGui.IsItemActive(), deactivated = ImGui.IsItemDeactivated();

    this.valueHovered ||= ImGui.IsItemHovered(ImGui.HoveredFlags.AllowWhenDisabled);
    this.valueActive ||= active;
    if (ImGui.IsItemActivated()) {
      if (this.valueEdit && this.valueEdit.id !== channel.id) { document.commit(); }
      document.setTime(document.currentTime); document.begin('Edit channel value');
      document.clearSelection(); document.selectedTracks.add(row.track.getInstanceId());
      this.state.activeChannel = row.id; this.selectTrack(row.track);
      this.valueEdit = { id: channel.id, cancelled: false };
    }
    if (this.valueEdit?.id === channel.id && ImGui.IsKeyPressed(ImGui.Key.Escape, false)) {
      document.cancel(); this.valueEdit.cancelled = true;
    } else if (changed && !disabled && !this.valueEdit?.cancelled && Number.isFinite(value)) {
      document.begin('Edit channel value');
      this.valueEdit ??= { id: channel.id, cancelled: false };
      const selected = new Set(document.selectedKeys);

      document.insertKey(section, channel, document.currentTime, value);
      document.selectedKeys.clear(); selected.forEach(id => document.selectedKeys.add(id));
      document.changed();
    }
    if (deactivated && this.valueEdit?.id === channel.id) { document.commit(); this.valueEdit = undefined; }
    if (hovered && !active) {
      if (!disabled) { ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW); }
      ImGui.SetTooltip(disabled ? document.isLocked(row.track) ? 'Track is locked.' : 'Move the playhead inside this clip to edit.' :
        'Click to type, or drag to adjust. Edits set a key at the playhead.');
    }
    ImGui.EndDisabled(); ImGui.PopStyleColor(3); ImGui.PopStyleVar(3);
  }

  private drawOutlinerControl (icon: SequenceIcon, x: number, y: number, rowHovered: boolean, active: boolean, hint: string): void {
    const hovered = rowHovered && Math.abs(ImGui.GetMousePos().x - x) < L.columnSpacing / 2;
    const alpha = hovered ? 0.8 : rowHovered ? 0.25 : 0.1;
    const tint = active ? C.selectedKey : new ImGui.Vec4(1, 1, 1, alpha);
    const pressedOffset = hovered && ImGui.IsMouseDown(ImGui.MouseButton.Left) ? 1 : 0;

    drawSequenceIcon(icon, x - L.columnIconSize / 2, y - L.columnIconSize / 2 + pressedOffset, L.columnIconSize, tint);
    if (hovered) { ImGui.SetTooltip(hint); }
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

  private getCurve (document: SequencerDocument, channel: SequenceChannel): BezierCurve {
    const cached = this.curves.get(channel);

    if (cached?.revision === document.revision) { return cached.curve; }
    const curve = new BezierCurve([]);

    curve.setKeyFrames(channel.keys);
    this.curves.set(channel, { revision: document.revision, curve });

    return curve;
  }

  private clipCurveSegment (x1: number, y1: number, x2: number, y2: number): number[] | undefined {
    const left = this.graphLeft, right = this.plot.x + this.plot.width;
    const top = this.plot.y, bottom = this.plot.y + this.plot.height;
    const dx = x2 - x1, dy = y2 - y1;

    if (![x1, y1, x2, y2, dx, dy].every(Number.isFinite)) { return; }
    if (Math.max(x1, x2) < left || Math.min(x1, x2) > right || Math.max(y1, y2) < top || Math.min(y1, y2) > bottom) { return; }
    let from = 0, to = 1;
    const p = [-dx, dx, -dy, dy], q = [x1 - left, right - x1, y1 - top, bottom - y1];

    for (let index = 0; index < 4; index++) {
      if (p[index] === 0) {
        if (q[index] < 0) { return; }
      } else {
        const ratio = q[index] / p[index];

        if (p[index] < 0) { from = Math.max(from, ratio); } else { to = Math.min(to, ratio); }
        if (from > to) { return; }
      }
    }

    return [Math.max(left, Math.min(right, x1 + from * dx)), Math.max(top, Math.min(bottom, y1 + from * dy)),
      Math.max(left, Math.min(right, x1 + to * dx)), Math.max(top, Math.min(bottom, y1 + to * dy))];
  }

  private curvePointVisible (x: number, y: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) && x >= this.graphLeft - 6 && x <= this.plot.x + this.plot.width + 6 &&
      y >= this.plot.y - 6 && y <= this.plot.y + this.plot.height + 6;
  }

  private drawCurveLine (section: SequenceSection, curve: BezierCurve, color: ImGui.Vec4): void {
    const start = Math.max(this.graphLeft, this.timeX(section.clip.start));
    const end = Math.min(this.plot.x + this.plot.width, this.timeX(section.clip.start + section.clip.duration));

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || section.clip.duration <= 0) { return; }
    const dl = ImGui.GetWindowDrawList(), tint = ImGui.GetColorU32(color);
    const points: ImGui.Vec2[] = [];
    const flush = () => {
      if (points.length > 1) { dl.AddPolyline(points, points.length, tint, 0, 1.6); }
      points.length = 0;
    };
    const append = (x: number, y: number) => {
      const last = points.at(-1), previous = points.at(-2);

      if (last && Math.abs(last.x - x) < 1e-6 && Math.abs(last.y - y) < 1e-6) { return; }
      if (previous && last) {
        const cross = (last.x - previous.x) * (y - previous.y) - (last.y - previous.y) * (x - previous.x);
        const length = Math.hypot(x - previous.x, y - previous.y);

        if (Math.abs(cross) <= 1e-4 * Math.max(1, length)) {
          points[points.length - 1] = new ImGui.Vec2(x, y);

          return;
        }
      }
      points.push(new ImGui.Vec2(x, y));
    };
    let lastX = start, lastY = this.valueY(curve.getValue((this.timeAt(start) - section.clip.start) / section.clip.duration));

    for (let x = start + 3; x < end + 3; x += 3) {
      const nextX = Math.min(end, x);
      const y = this.valueY(curve.getValue((this.timeAt(nextX) - section.clip.start) / section.clip.duration));
      const segment = this.clipCurveSegment(lastX, lastY, nextX, y);

      if (segment) {
        const last = points.at(-1);

        if (last && (Math.abs(last.x - segment[0]) > 1e-4 || Math.abs(last.y - segment[1]) > 1e-4)) { flush(); }
        append(segment[0], segment[1]); append(segment[2], segment[3]);
      } else { flush(); }
      lastX = nextX; lastY = y;
    }
    flush();
  }

  private drawCurves (document: SequencerDocument): void {
    const step = niceStep((this.state.curveMax - this.state.curveMin) / Math.max(2, this.plot.height / 65));

    for (let value = Math.ceil(this.state.curveMin / step) * step; value <= this.state.curveMax; value += step) {
      const y = this.valueY(value);

      const label = Math.abs(value) < 1e-8 ? '0' : Number(value.toPrecision(4)).toString();

      this.line(this.graphLeft, y, this.plot.x + this.plot.width, y, Math.abs(value) < 1e-8 ? C.inputBorder : C.grid);
      this.text(this.graphLeft - ImGui.CalcTextSize(label).x - 7, y - ImGui.GetTextLineHeight() / 2, label, C.muted);
    }
    this.drawTimeGrid();
    this.line(this.graphLeft - 1, this.plot.y, this.graphLeft - 1, this.plot.y + this.plot.height, C.line);
    const channels = this.state.curveChannels(document);

    if (!channels.length) {
      this.text(this.plot.x + 20, this.plot.y + 25, 'Select a property track or add keyframes to edit its curves.', C.muted);
    }
    const dl = ImGui.GetWindowDrawList();

    dl.PushClipRect(new ImGui.Vec2(this.graphLeft, this.plot.y), new ImGui.Vec2(this.plot.x + this.plot.width, this.plot.y + this.plot.height), true);
    for (const { section, channel } of channels) {
      const curve = this.getCurve(document, channel);
      const color = C.axes[channel.axis] ?? C.text;

      this.drawCurveLine(section, curve, color);
      channel.keys.forEach((key, index) => {
        const x = this.timeX(section.clip.start + key.time * section.clip.duration), y = this.valueY(key.value);
        const item = { section, channel, key };

        if (!Number.isFinite(x) || !Number.isFinite(y)) { return; }
        if (document.selectedKeys.has(key.id) && this.state.showTangents && key.interpolationMode === InterpolationMode.Cubic) {
          for (const side of ['in', 'out'] as const) {
            if ((side === 'in' && index === 0) || (side === 'out' && index + 1 === channel.keys.length)) { continue; }
            const control = controlPoint(channel.keys, index, side);
            const hx = this.timeX(section.clip.start + control.time * section.clip.duration), hy = this.valueY(control.value);

            const segment = this.clipCurveSegment(x, y, hx, hy);

            if (segment) { this.line(segment[0], segment[1], segment[2], segment[3], C.muted); }
            if (this.curvePointVisible(hx, hy)) {
              dl.AddCircleFilled(new ImGui.Vec2(hx, hy), 3.5, ImGui.GetColorU32(C.selectedKey));
              if (this.selectedTangents.some(hit => hit.item.key === key && hit.side === side)) {
                dl.AddCircle(new ImGui.Vec2(hx, hy), 5, ImGui.GetColorU32(C.text), 16, 1);
              }
              this.tangentHits.push({ x: hx, y: hy, item, side });
            }
          }
        }
        if (this.curvePointVisible(x, y)) {
          this.diamond(x, y, document.selectedKeys.has(key.id) ? C.selectedKey : color, document.selectedKeys.has(key.id) ? 5 : 4);
          this.keyHits.push({ x, y, keys: [item] });
        }
      });
    }
    dl.PopClipRect();
    this.drawMarquee();
  }

  private drawPlaybackRange (): void {
    const left = this.timeX(this.state.playbackStart), right = this.timeX(this.state.playbackEnd);

    if (left > this.graphLeft) { this.fill({ x: this.graphLeft, y: this.plot.y, width: left - this.graphLeft, height: this.plot.height }, new ImGui.Vec4(0, 0, 0, 0.3)); }
    if (right < this.plot.x + this.plot.width) { this.fill({ x: right, y: this.plot.y, width: this.plot.x + this.plot.width - right, height: this.plot.height }, new ImGui.Vec4(0, 0, 0, 0.3)); }
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

  private drawScrollbar (): void {
    const x = this.plot.x + this.plot.width + 2;

    this.fill({ x, y: this.plot.y, width: 7, height: this.plot.height }, C.toolbar);
    if (this.scrollMax > 0) {
      const height = Math.max(20, this.plot.height * this.plot.height / (this.scrollMax + this.plot.height));
      const y = this.plot.y + this.state.scrollY / this.scrollMax * (this.plot.height - height);

      this.fill({ x, y, width: 7, height }, C.muted);
    }
  }

  private drawMarquee (): void {
    if (this.drag?.kind !== 'marquee' || !this.drag.moved) { return; }
    const mouse = ImGui.GetMousePos();
    const rect = { x: Math.min(this.drag.x, mouse.x), y: Math.min(this.drag.y, mouse.y),
      width: Math.abs(mouse.x - this.drag.x), height: Math.abs(mouse.y - this.drag.y) };

    this.fill(rect, new ImGui.Vec4(0.2, 0.5, 0.9, 0.16)); this.border(rect, C.active);
  }

  private start (kind: Drag['kind'], document: SequencerDocument): Drag {
    const mouse = ImGui.GetMousePos();
    const drag: Drag = { kind, x: mouse.x, y: mouse.y, time: this.timeAt(mouse.x), value: this.valueAt(mouse.y),
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
    let nearest: { section: SequenceSection, channel: SequenceChannel } | undefined;
    let distance = 7;

    for (const entry of this.state.curveChannels(document)) {
      const { section, channel } = entry;

      if (section.clip.duration <= 0) { continue; }
      const start = Math.max(this.graphLeft, this.timeX(section.clip.start), x - 7);
      const end = Math.min(this.plot.x + this.plot.width, this.timeX(section.clip.start + section.clip.duration), x + 7);
      const curve = this.getCurve(document, channel);
      const sample = (px: number) => this.valueY(curve.getValue((this.timeAt(px) - section.clip.start) / section.clip.duration));
      let lastX = start, lastY = sample(start);

      for (let px = start + 2; px < end + 2; px += 2) {
        const nextX = Math.min(end, px), nextY = sample(nextX);
        const dx = nextX - lastX, dy = nextY - lastY;
        const ratio = Math.max(0, Math.min(1, ((x - lastX) * dx + (y - lastY) * dy) / (dx * dx + dy * dy || 1)));
        const delta = Math.hypot(x - lastX - ratio * dx, y - lastY - ratio * dy);

        if (delta < distance) { distance = delta; nearest = entry; }
        lastX = nextX; lastY = nextY;
      }
    }

    return nearest;
  }

  private zoomView (timeFactor: number, valueFactor: number, time: number, value: number, view =
  [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax]): void {
    const timeRange = view[1] - view[0], valueRange = view[3] - view[2];
    const x = Math.max(1e-6 / timeRange, Math.min(36000 / timeRange, timeFactor));
    const y = Math.max(1e-8 / valueRange, Math.min(1e12 / valueRange, valueFactor));
    const bounds = [time + (view[0] - time) * x, time + (view[1] - time) * x,
      value + (view[2] - value) * y, value + (view[3] - value) * y];

    if (bounds.every(Number.isFinite) && bounds[1] > bounds[0] && bounds[3] > bounds[2]) {
      [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax] = bounds;
    }
  }

  private startKeyDrag (document: SequencerDocument, button = ImGui.MouseButton.Left): Drag | undefined {
    const keys = document.selectedKeyItems().filter(item => !document.isLocked(item.section.track));

    if (!keys.length) { return; }
    const drag = this.start('keys', document);

    drag.button = button;
    drag.keys = keys.map(item => ({ item, time: item.key.time, value: item.key.value }));

    return drag;
  }

  private startTangentDrag (document: SequencerDocument, button: ImGui.MouseButton): boolean {
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
    if (context.keys?.length) {
      if (!context.keys.some(item => document.selectedKeys.has(item.key.id))) {
        document.clearSelection(); context.keys.forEach(item => document.selectedKeys.add(item.key.id));
      }
    } else if (context.section && !document.selectedSections.has(context.section.clip.getInstanceId())) {
      document.clearSelection(); document.selectedSections.add(context.section.clip.getInstanceId());
    } else if (context.row && !document.selectedTracks.has(context.row.track.getInstanceId())) {
      document.clearSelection(); document.selectedTracks.add(context.row.track.getInstanceId());
      this.state.activeChannel = context.row.kind === 'channel' || context.row.kind === 'group' ? context.row.id : '';
    }
  }

  private interact (document: SequencerDocument): void {
    const mouse = ImGui.GetMousePos(), io = ImGui.GetIO();
    const modified = io.KeyCtrl || io.KeySuper;
    const keyHit = [...this.keyHits].reverse().find(hit => Math.hypot(hit.x - mouse.x, hit.y - mouse.y) <= 8);
    const tangent = this.tangentHits.find(hit => Math.hypot(hit.x - mouse.x, hit.y - mouse.y) <= 7);
    const sectionHit = [...this.sectionHits].reverse().find(hit => this.contains(hit, mouse.x, mouse.y));
    const sectionEdge = sectionHit && !this.state.curveMode &&
      (Math.abs(mouse.x - sectionHit.x) < 5 || Math.abs(mouse.x - sectionHit.x - sectionHit.width) < 5);
    const row = this.rowAt(mouse.y);
    const hovered = this.hover || this.outlinerHover || this.overviewHover;
    const graph = this.hover && mouse.y >= this.plot.y && mouse.x >= this.graphLeft && mouse.x <= this.plot.x + this.plot.width;

    this.selectedTangents = this.selectedTangents.filter(hit => this.state.curveMode && document.selectedKeys.has(hit.item.key.id) &&
      hit.item.channel.keys.includes(hit.item.key));
    if (hovered && ImGui.IsMouseClicked(ImGui.MouseButton.Left) && !tangent) { this.selectedTangents = []; }
    if (!this.drag && (this.valueHovered || this.editingValue)) { return; }
    if ((!this.drag || this.drag.kind === 'pan') && hovered && (io.MouseWheel !== 0 || io.MouseWheelH !== 0)) {
      const playheadVisible = document.currentTime >= this.state.viewStart && document.currentTime <= this.state.viewEnd;
      const anchor = playheadVisible ? document.currentTime : this.timeAt(mouse.x);

      if (this.outlinerHover || mouse.x > this.plot.x + this.plot.width) {
        this.state.scrollY = Math.max(0, Math.min(this.scrollMax, this.state.scrollY - io.MouseWheel * L.rowHeight * 2));
      } else if (this.state.curveMode && graph && io.MouseWheel !== 0) {
        const factor = 1 - Math.max(-0.9, Math.min(0.9, io.MouseWheel * 0.1));

        this.zoomView(factor, factor, this.drag ? this.timeAt(mouse.x) : anchor, this.valueAt(mouse.y));
      } else if (modified && io.MouseWheel !== 0) {
        this.zoomView(Math.pow(0.8, io.MouseWheel), 1, anchor, this.valueAt(mouse.y));
      } else if (io.KeyShift) {
        const delta = -io.MouseWheel * (this.state.viewEnd - this.state.viewStart) * 0.1;

        this.state.viewStart += delta; this.state.viewEnd += delta;
      } else if (!this.state.curveMode) { this.state.scrollY = Math.max(0, Math.min(this.scrollMax, this.state.scrollY - io.MouseWheel * L.rowHeight * 2)); }
      if (this.hover && io.MouseWheelH !== 0) {
        const delta = -io.MouseWheelH * 50 / this.pixelsPerSecond;

        this.state.viewStart += delta; this.state.viewEnd += delta;
      }
      if (this.drag) {
        this.drag.x = mouse.x; this.drag.y = mouse.y;
        this.drag.view = [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax, this.state.scrollY];
      }
    }
    if (!this.drag && graph && ImGui.IsMouseClicked(ImGui.MouseButton.Middle)) {
      if (io.KeyAlt) {
        const drag = this.start('pan', document);

        drag.button = ImGui.MouseButton.Middle; drag.graph = this.state.curveMode; drag.horizontalOnly = true;
        drag.view = [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax, this.state.scrollY];
      } else {
        const curve = this.state.curveMode ? this.curveAt(document, mouse.x, mouse.y) : undefined;

        if (keyHit && !this.state.curveMode) {
          if (!keyHit.keys.some(item => document.selectedKeys.has(item.key.id))) {
            document.clearSelection(); keyHit.keys.forEach(item => document.selectedKeys.add(item.key.id));
          }
        } else if (!keyHit && !tangent && !(io.KeyShift && document.selectedKeys.size) && (curve || !this.state.curveMode && row?.channels.length)) {
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
        if (!this.state.curveMode || !this.startTangentDrag(document, ImGui.MouseButton.Middle)) {
          this.startKeyDrag(document, ImGui.MouseButton.Middle);
        }
      }
    }
    if (!this.drag && this.hover) {
      if (sectionEdge) {
        ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeEW);
      } else if (tangent || keyHit) { ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeAll); }
    }
    if (!this.drag && hovered && ImGui.IsMouseClicked(ImGui.MouseButton.Right)) {
      const context: SequencerContext = { row: this.outlinerHover || !this.state.curveMode ? row : undefined,
        section: sectionHit?.section, channel: keyHit?.keys[0]?.channel, keys: keyHit?.keys,
        time: this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond) };
      const zoom = !this.outlinerHover && io.KeyAlt && (this.state.curveMode || io.KeyShift);
      const drag = this.start(zoom ? 'zoom' : 'pan', document);

      drag.button = ImGui.MouseButton.Right; drag.context = zoom ? undefined : context; drag.graph = this.state.curveMode && graph;
      drag.view = [this.state.viewStart, this.state.viewEnd, this.state.curveMin, this.state.curveMax, this.state.scrollY];
    }
    if (!this.drag && this.outlinerHover && row && ImGui.IsMouseClicked(ImGui.MouseButton.Left)) {
      const expanderX = this.rect.x + L.treePadding + row.depth * L.treeIndent;
      const columns = this.outlinerColumns;
      const withinColumn = (x: number) => Math.abs(mouse.x - x) < L.columnSpacing / 2;

      if ((row.kind === 'object' || row.kind === 'track') && withinColumn(columns.mute)) {
        document.toggleMute(row.track);
      } else if (row.expandable && mouse.x >= expanderX && mouse.x < expanderX + L.expanderSize) {
        if (this.state.expanded.has(row.id)) { this.state.expanded.delete(row.id); } else { this.state.expanded.add(row.id); }
      } else if (row.kind === 'object' && withinColumn(columns.key)) {
        this.context = { row, time: document.currentTime };
      } else if (row.channels.length && columns.navigation && (withinColumn(columns.previous) || withinColumn(columns.next))) {
        const direction = mouse.x < columns.key ? -1 : 1;
        const times = row.channels.flatMap(({ section, channel }) => channel.keys.map(key => section.clip.start + key.time * section.clip.duration))
          .filter(time => direction > 0 ? time > document.currentTime + 1e-6 : time < document.currentTime - 1e-6);

        if (times.length) { document.setTime(direction > 0 ? Math.min(...times) : Math.max(...times)); }
      } else if (withinColumn(columns.key) && row.channels.length && !document.isLocked(row.track)) {
        document.edit('Add property key', () => row.channels.forEach(entry => document.insertKey(entry.section, entry.channel, document.currentTime)));
      } else {
        if (!modified && !io.KeyShift) { document.clearSelection(); }
        if (modified && document.selectedTracks.has(row.track.getInstanceId())) { document.selectedTracks.delete(row.track.getInstanceId()); } else { document.selectedTracks.add(row.track.getInstanceId()); }
        this.state.activeChannel = row.kind === 'channel' || row.kind === 'group' ? row.id : '';
        this.selectTrack(row.track);
        if (ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left) && row.expandable) {
          if (this.state.expanded.has(row.id)) { this.state.expanded.delete(row.id); } else { this.state.expanded.add(row.id); }
        } else if (row.kind === 'object' || row.kind === 'track') { this.start('track', document).track = row.track; }
        if (this.state.curveMode) { this.state.fitValues(document); }
      }
    }
    if (!this.drag && (this.hover || this.overviewHover) && ImGui.IsMouseClicked(ImGui.MouseButton.Left)) {
      if (this.overviewHover) {
        const drag = this.start('overview', document);

        drag.view = [this.state.viewStart, this.state.viewEnd];
        const left = this.overview.x + Math.max(0, this.state.viewStart) / this.overviewExtent * this.overview.width;
        const right = this.overview.x + this.state.viewEnd / this.overviewExtent * this.overview.width;

        drag.edge = Math.abs(mouse.x - left) < 8 ? 'left' : Math.abs(mouse.x - right) < 8 ? 'right' : undefined;
      } else if (mouse.y < this.plot.y || this.state.curveMode && ImGui.IsKeyDown(ImGui.Key.B)) {
        const drag = this.start('scrub', document);

        drag.resume = !document.composition.getPaused();
        document.setTime(Math.max(0, this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond)));
      } else if (mouse.x > this.plot.x + this.plot.width) { this.start('scroll', document).value = this.state.scrollY; } else if (io.KeyAlt && (Math.abs(mouse.x - this.timeX(this.state.playbackStart)) < 6 || Math.abs(mouse.x - this.timeX(this.state.playbackEnd)) < 6)) {
        this.start(Math.abs(mouse.x - this.timeX(this.state.playbackStart)) < 6 ? 'range-start' : 'range-end', document);
      } else if (tangent && !document.isLocked(tangent.item.section.track)) {
        this.selectedTangents = this.tangentHits.filter(hit => hit.side === tangent.side && document.selectedKeys.has(hit.item.key.id));
        this.startTangentDrag(document, ImGui.MouseButton.Left);
      } else if (keyHit && !sectionEdge) {
        this.selectedTangents = [];
        if (this.state.curveMode && io.KeyAlt) {
          keyHit.keys.forEach(item => document.selectedKeys.delete(item.key.id));

          return;
        }
        if (!keyHit.keys.some(item => document.selectedKeys.has(item.key.id))) {
          if (!modified && !io.KeyShift) { document.clearSelection(); }
          keyHit.keys.forEach(item => document.selectedKeys.add(item.key.id));
        } else if (modified) { keyHit.keys.forEach(item => document.selectedKeys.delete(item.key.id)); }
        this.selectTrack(keyHit.keys[0].section.track);
        const drag = this.startKeyDrag(document);

        if (drag) { drag.duplicate = !this.state.curveMode && io.KeyAlt; }
      } else if (sectionHit && !this.state.curveMode) {
        const section = sectionHit.section;

        if (!document.selectedSections.has(section.clip.getInstanceId())) {
          if (!modified && !io.KeyShift) { document.clearSelection(); }
          document.selectedSections.add(section.clip.getInstanceId());
        } else if (modified && !sectionEdge) { document.selectedSections.delete(section.clip.getInstanceId()); }
        this.selectTrack(section.track);
        if (!document.isLocked(section.track)) {
          const drag = this.start('section', document);

          drag.sections = document.selectedSectionItems.filter(item => !document.isLocked(item.track)).map(item => ({
            section: item, start: item.clip.start, duration: item.clip.duration, keys: item.channels.map(channel => channel.keys.map(key => ({ ...key }))),
          }));
          drag.edge = Math.abs(mouse.x - sectionHit.x) < 7 ? 'left' : Math.abs(mouse.x - sectionHit.x - sectionHit.width) < 7 ? 'right' : undefined;
          drag.duplicate = !drag.edge && io.KeyAlt;
        }
      } else {
        const drag = this.start('marquee', document);

        drag.initialSelection = modified || io.KeyShift || io.KeyAlt ? new Set(document.selectedKeys) : new Set();
        if (!modified && !io.KeyShift && !io.KeyAlt) { document.selectedKeys.clear(); document.selectedSections.clear(); }
        if (this.state.curveMode && graph) {
          const entry = this.curveAt(document, mouse.x, mouse.y);

          if (entry) {
            drag.context = { ...entry, time: this.timeAt(mouse.x), keys: entry.channel.keys.map(key => ({ ...entry, key })) };
          }
        }
      }
    }
    this.updateDrag(document);
  }

  private updateDrag (document: SequencerDocument): void {
    const drag = this.drag;

    if (!drag) { return; }
    const mouse = ImGui.GetMousePos(), io = ImGui.GetIO();
    const down = ImGui.IsMouseDown(drag.button ?? ImGui.MouseButton.Left);

    if (!down) {
      if (drag.kind === 'pan' && !drag.moved && drag.context) {
        this.selectContext(document, drag.context); this.context = drag.context;
      }
      if (drag.kind === 'marquee' && !drag.moved && drag.context?.keys) {
        drag.context.keys.forEach(item => {
          if (io.KeyAlt || (io.KeyCtrl || io.KeySuper) && drag.initialSelection?.has(item.key.id)) { document.selectedKeys.delete(item.key.id); } else { document.selectedKeys.add(item.key.id); }
        });
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
    const dx = mouse.x - drag.x, dy = mouse.y - drag.y;

    if (Math.hypot(dx, dy) > 3) { drag.moved = true; }
    if (io.KeyShift && drag.moved && !drag.axis) { drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'; }
    if (!io.KeyShift) { drag.axis = undefined; }
    if (drag.moved && drag.duplicate) {
      drag.duplicate = false;
      if (drag.keys) {
        document.selectedKeys.clear();
        drag.keys = drag.keys.map(seed => {
          const key = { ...seed.item.key, id: makeKey(0, 0).id };
          const channel = seed.item.channel;

          channel.keys.push(key); document.selectedKeys.add(key.id);
          if (channel.references) { channel.references.set(key.id, channel.references.get(seed.item.key.id) ?? null); }

          return { ...seed, item: { ...seed.item, key } };
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
      this.state.outlinerWidth = Math.max(150, Math.min(this.rect.width * 0.62, mouse.x - this.rect.x));
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

      this.zoomView(factor, drag.graph ? io.KeyShift ? Math.exp(dy * 0.01) : factor : 1, drag.time, drag.value, drag.view);
    } else if (drag.kind === 'overview' && drag.view) {
      const dt = dx / this.overview.width * this.overviewExtent;

      if (drag.edge === 'left') { this.state.viewStart = Math.min(drag.view[1] - 2 / this.state.frameRate, drag.view[0] + dt); } else if (drag.edge === 'right') { this.state.viewEnd = Math.max(drag.view[0] + 2 / this.state.frameRate, drag.view[1] + dt); } else { this.state.viewStart = drag.view[0] + dt; this.state.viewEnd = drag.view[1] + dt; }
    } else if (drag.kind === 'scroll') { this.state.scrollY = Math.max(0, Math.min(this.scrollMax, drag.value + dy * (this.scrollMax + this.plot.height) / this.plot.height)); } else if (drag.kind === 'range-start') { this.state.playbackStart = Math.max(0, Math.min(this.state.playbackEnd - 1 / this.state.frameRate, this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond))); } else if (drag.kind === 'range-end') { this.state.playbackEnd = Math.max(this.state.playbackStart + 1 / this.state.frameRate, this.state.snap(this.timeAt(mouse.x), document, this.pixelsPerSecond)); } else if (drag.kind === 'keys' && drag.moved && drag.keys?.length) {
      const anchor = drag.keys[0], duration = anchor.item.section.clip.duration;
      const initial = anchor.item.section.clip.start + anchor.time * duration;
      let dt = this.state.curveMode && drag.axis === 'y' ? 0 :
        this.state.snap(initial + dx / this.pixelsPerSecond, document, this.pixelsPerSecond, document.selectedKeys) - initial;
      const low = Math.max(...drag.keys.map(seed => -seed.time * seed.item.section.clip.duration));
      const high = Math.min(...drag.keys.map(seed => (1 - seed.time) * seed.item.section.clip.duration));

      dt = Math.max(low, Math.min(high, dt));
      const dv = this.state.curveMode && drag.axis !== 'x' ? -dy * (drag.valueScale ?? 0) : 0;
      const sections = new Set<SequenceSection>();

      for (const seed of drag.keys) {
        seed.item.key.time = seed.time + dt / seed.item.section.clip.duration;
        seed.item.key.value = seed.value + dv;
        updateAutoTangents(seed.item.channel.keys); sections.add(seed.item.section);
      }
      sections.forEach(section => document.write(section)); document.changed();
    } else if (drag.kind === 'section' && drag.moved && drag.sections?.length) {
      const anchor = drag.sections[0];
      const initial = drag.edge === 'right' ? anchor.start + anchor.duration : anchor.start;
      const dt = this.state.snap(initial + dx / this.pixelsPerSecond, document, this.pixelsPerSecond, document.selectedSections) - initial;

      for (const seed of drag.sections) {
        const section = seed.section;

        section.clip.start = seed.start; section.clip.duration = seed.duration;
        section.channels.forEach((channel, index) => channel.keys = seed.keys[index].map(key => ({ ...key })));
        if (drag.edge) {
          const start = drag.edge === 'left' ? Math.max(0, Math.min(seed.start + seed.duration - 1 / this.state.frameRate, seed.start + dt)) : seed.start;
          const end = drag.edge === 'right' ? Math.max(seed.start + 1 / this.state.frameRate, seed.start + seed.duration + dt) : seed.start + seed.duration;

          document.resizeSection(section, start, end, io.KeyCtrl || io.KeySuper);
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

        if (io.KeyShift) {
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
        if (io.KeyAlt || item.key.tangentMode === 'break') { item.key.tangentMode = 'break'; } else { item.key.tangentMode = 'user'; item.key.inSlope = item.key.outSlope = slope; }
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
            if (this.state.curveMode && (io.KeyAlt || (io.KeyCtrl || io.KeySuper) && drag.initialSelection?.has(item.key.id))) {
              document.selectedKeys.delete(item.key.id);
            } else { document.selectedKeys.add(item.key.id); }
          });
        }
      }
      if (!this.state.curveMode && !io.KeyShift && !io.KeyCtrl && !io.KeySuper) {
        document.selectedSections.clear();
        for (const hit of this.sectionHits) {
          if (hit.x < maxX && hit.x + hit.width > minX && hit.y < maxY && hit.y + hit.height > minY) { document.selectedSections.add(hit.section.clip.getInstanceId()); }
        }
      }
    }
  }

  private contains (rect: Rect, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }
  private fill (rect: Rect, color: ImGui.Vec4, rounding = 0, flags = ImGui.DrawCornerFlags.All): void {
    ImGui.GetWindowDrawList().AddRectFilled(new ImGui.Vec2(rect.x, rect.y), new ImGui.Vec2(rect.x + rect.width, rect.y + rect.height), ImGui.GetColorU32(color), rounding, flags);
  }
  private border (rect: Rect, color: ImGui.Vec4, width = 1, rounding = 1): void {
    ImGui.GetWindowDrawList().AddRect(new ImGui.Vec2(rect.x, rect.y), new ImGui.Vec2(rect.x + rect.width, rect.y + rect.height), ImGui.GetColorU32(color), rounding, 0, width);
  }
  private text (x: number, y: number, value: string, color: ImGui.Vec4): void {
    ImGui.GetWindowDrawList().AddText(new ImGui.Vec2(x, y), ImGui.GetColorU32(color), value);
  }
  private line (x1: number, y1: number, x2: number, y2: number, color: ImGui.Vec4, width = 1): void {
    if (Math.abs(x1 - x2) < 1e-6) { x1 = x2 = Math.floor(x1) + 0.5; }
    if (Math.abs(y1 - y2) < 1e-6) { y1 = y2 = Math.floor(y1) + 0.5; }
    ImGui.GetWindowDrawList().AddLine(new ImGui.Vec2(x1, y1), new ImGui.Vec2(x2, y2), ImGui.GetColorU32(color), width);
  }
  private diamond (x: number, y: number, color: ImGui.Vec4, radius: number): void {
    const dl = ImGui.GetWindowDrawList(), tint = ImGui.GetColorU32(color);

    dl.AddQuadFilled(new ImGui.Vec2(x, y - radius), new ImGui.Vec2(x + radius, y), new ImGui.Vec2(x, y + radius), new ImGui.Vec2(x - radius, y), tint);
    dl.AddQuad(new ImGui.Vec2(x, y - radius), new ImGui.Vec2(x + radius, y), new ImGui.Vec2(x, y + radius), new ImGui.Vec2(x - radius, y), ImGui.GetColorU32(C.line), 0.8);
  }

  private drawNumericKey (x: number, y: number, key: SequenceKey, selected: boolean): void {
    const dl = ImGui.GetWindowDrawList(), radius = selected ? 4.5 : 4;
    const color = selected ? C.selectedKey : key.interpolationMode === InterpolationMode.Linear ? C.keyLinear :
      key.interpolationMode === InterpolationMode.Constant ? C.keyConstant :
        key.tangentMode === 'auto' ? C.keyAuto : key.tangentMode === 'break' ? C.keyBreak : C.keyUser;
    const fill = ImGui.GetColorU32(color), border = ImGui.GetColorU32(C.line);

    if (key.interpolationMode === InterpolationMode.Linear) {
      const points = [new ImGui.Vec2(x, y - radius), new ImGui.Vec2(x + radius, y + radius), new ImGui.Vec2(x - radius, y + radius)];

      dl.AddTriangleFilled(points[0], points[1], points[2], fill);
      dl.AddTriangle(points[0], points[1], points[2], border, 0.8);
    } else if (key.interpolationMode === InterpolationMode.Constant) {
      dl.AddRectFilled(new ImGui.Vec2(x - radius, y - radius), new ImGui.Vec2(x + radius, y + radius), fill);
      dl.AddRect(new ImGui.Vec2(x - radius, y - radius), new ImGui.Vec2(x + radius, y + radius), border, 0, 0, 0.8);
    } else {
      dl.AddCircleFilled(new ImGui.Vec2(x, y), radius, fill, 16);
      dl.AddCircle(new ImGui.Vec2(x, y), radius, border, 16, 0.8);
    }
  }
}
