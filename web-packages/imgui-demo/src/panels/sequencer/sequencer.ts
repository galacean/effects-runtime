import { CompositionComponent, InterpolationMode, ObjectBindingTrack, TransformTrack, VFXItem } from '@galacean/effects';
import type { TrackAsset } from '@galacean/effects';
import { editorWindow, menuItem } from '../../core/decorators';
import { Selection } from '../../core/selection';
import { getEditorRotation } from '../../core/editor-transform';
import { GalaceanEffects } from '../../ge';
import { ImGui } from '../../imgui';
import { searchBar } from '../../widgets';
import { editorMenuSection } from '../../widgets/editor-menu';
import { EditorWindow } from '../editor-window';
import { SequencerCanvas } from './sequencer-canvas';
import type { SequencerContext } from './sequencer-canvas';
import { SequencerDocument } from './sequencer-document';
import type { KeySelection, SequenceSection } from './sequencer-document';
import { SequencerState } from './sequencer-state';
import { updateAutoTangents } from './curve-data';
import { SEQUENCE_COLORS as C, SEQUENCE_LAYOUT as L } from './sequencer-style';

import { drawSequenceIcon } from './sequencer-icons';
import type { SequenceIcon } from './sequencer-icons';
import { findSequenceTimeline } from './sequencer-preview';
type Interpolation = 'Auto' | 'User' | 'Break' | 'Linear' | 'Constant';

@editorWindow()
export class Sequencer extends EditorWindow {
  private readonly state = new SequencerState();
  private readonly canvas = new SequencerCanvas(this.state, track => this.selectBoundItems(track));
  private document?: SequencerDocument;
  private searchBuffer: ImGui.ImScalar<string> = [''];
  private renameTrack?: TrackAsset;
  private renameValue = '';
  private renameRequested = false;
  private context?: SequencerContext;
  private viewWidth = 500;
  private autoKey = false;
  private autoValues = new Map<string, number[]>();
  private lastRevision = -1;
  private syncingSelection = false;
  private lastAutoTime = NaN;
  private autoRecording = false;
  private acceptsClipboard = false;
  private clipboardCommands: string[] = [];
  private readonly onClipboard = (event: ClipboardEvent): void => {
    if (!this.acceptsClipboard || event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) { return; }
    this.clipboardCommands.push(event.type);
    event.preventDefault();
  };

  @menuItem('Window/Sequencer')
  static showWindow (): void { EditorWindow.getWindow(Sequencer).open(); }

  constructor () {
    super(); this.title = 'Sequencer';
    this.setWindowFlags(ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
    this.open();
  }

  override update (): void {
    const composition = GalaceanEffects.player.getCompositions()[0];

    if (!composition) {
      this.document?.dispose();
      this.document = undefined;

      return;
    }
    let component = composition.sceneRoot.getComponent(CompositionComponent);
    const selected = Selection.getSelectedObjects()[0];

    if (selected instanceof VFXItem) { component = selected.getComponent(CompositionComponent) ?? component; }
    const timeline = component ? findSequenceTimeline(component) : undefined;

    if (!component || !timeline) {
      this.document?.dispose();
      this.document = undefined;

      return;
    }
    if (this.document?.component !== component || this.document.timeline !== timeline) {
      this.document?.dispose();
      this.document = new SequencerDocument(composition, component);
      this.state.initialize(this.document); this.searchBuffer[0] = '';
      this.autoValues.clear(); this.lastRevision = -1;
      this.lastAutoTime = NaN; this.autoRecording = false;
      this.onSelectionChange();
    }
    const document = this.document;

    document.sync();
    if (!composition.getPaused() && document.currentTime >= this.state.playbackEnd) {
      document.setTime(this.state.loop ? this.state.playbackStart : this.state.playbackEnd);
      if (this.state.loop) { void composition.resume(); }
    }
    this.updateAutoKey(document);
  }

  override onSelectionChange (): void {
    const document = this.document;

    if (!document || this.syncingSelection) { return; }
    const objects = Selection.getSelectedObjects().filter((item): item is VFXItem => item instanceof VFXItem);

    if (!objects.length) { return; }
    document.clearSelection(); this.state.activeChannel = '';
    for (const track of document.timeline.tracks) {
      if (objects.includes(document.boundItem(track)!)) { document.selectedTracks.add(track.getInstanceId()); }
    }
    this.state.captureCurveSelection(document);
  }

  private selectBoundItems (track: TrackAsset): void {
    const document = this.document;

    if (!document) { return; }
    const selected = document.tracks.filter(item => document.selectedTracks.has(item.getInstanceId()));

    selected.push(...document.selectedSectionItems.map(section => section.track), ...document.selectedKeyItems().map(item => item.section.track));
    if (!selected.length) { selected.push(track); }
    if (!this.state.curveMode) {
      this.state.curveTracks.clear(); selected.forEach(item => this.state.curveTracks.add(item.getInstanceId()));
    }
    const items = selected.map(item => document.boundItem(item)).filter((item): item is VFXItem => !!item);

    this.syncingSelection = true;
    try { Selection.setObjects(items); } finally { this.syncingSelection = false; }
  }

  override draw (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
    ImGui.PushStyleColor(ImGui.Col.WindowBg, C.background);
    super.draw(); ImGui.PopStyleColor(); ImGui.PopStyleVar();
  }

  protected override onEnable (): void {
    for (const command of ['copy', 'cut', 'paste'] as const) { window.document.addEventListener(command, this.onClipboard); }
  }

  protected override onDisable (): void {
    this.acceptsClipboard = false; this.clipboardCommands.length = 0;
    for (const command of ['copy', 'cut', 'paste'] as const) { window.document.removeEventListener(command, this.onClipboard); }
    if (this.document) { this.canvas.cancel(this.document); this.document.commit(); }
  }

  protected override onGUI (): void {
    const document = this.document;

    if (!document) {
      this.acceptsClipboard = false; this.clipboardCommands.length = 0;
      ImGui.TextDisabled('Open a composition with a timeline to start editing.');

      return;
    }
    for (const command of this.clipboardCommands.splice(0)) {
      if (command === 'paste') { document.paste(); } else {
        document.copySelection();
        if (command === 'cut') { document.deleteSelection(); }
      }
    }
    this.viewWidth = ImGui.GetContentRegionAvail().x;
    ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 4);
    ImGui.PushStyleVar(ImGui.StyleVar.PopupRounding, 0);
    ImGui.PushStyleVar(ImGui.StyleVar.PopupBorderSize, 1);
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(3, 3));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, 3));
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(12, 6));
    const colors: [ImGui.Col, ImGui.Vec4][] = [
      [ImGui.Col.Text, C.text], [ImGui.Col.TextDisabled, C.muted], [ImGui.Col.PopupBg, C.popup],
      [ImGui.Col.Border, C.menuBorder], [ImGui.Col.Separator, C.menuSeparator],
      [ImGui.Col.FrameBg, C.input], [ImGui.Col.FrameBgHovered, C.hover], [ImGui.Col.FrameBgActive, C.inputBorder],
      [ImGui.Col.ButtonHovered, C.hover], [ImGui.Col.ButtonActive, C.inputBorder],
      [ImGui.Col.Header, C.selection], [ImGui.Col.HeaderHovered, C.hover], [ImGui.Col.HeaderActive, C.selection],
      [ImGui.Col.CheckMark, C.active],
    ];

    colors.forEach(([name, color]) => ImGui.PushStyleColor(name, color));
    this.drawToolbar(document);
    if (this.state.curveMode) { this.drawCurveTools(document); }
    const origin = ImGui.GetCursorScreenPos();
    const availableHeight = ImGui.GetContentRegionAvail().y;
    const hasDetails = !this.state.curveMode && this.state.showDetails && (document.selectedKeys.size > 0 || document.selectedSections.size > 0);
    const detailsHeight = hasDetails && availableHeight > 150 ? L.detailsHeight : 0;
    const bodyHeight = Math.max(65, availableHeight - L.footerHeight - detailsHeight);

    this.canvas.draw(document, this.viewWidth, bodyHeight);
    this.drawOutlinerHeader(document);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + bodyHeight));
    if (detailsHeight) { this.drawDetails(document); }
    this.drawTransport(document);
    this.canvas.processInput(document);
    if (this.canvas.context) {
      this.context = this.canvas.context; this.canvas.context = undefined;
      ImGui.OpenPopup('##SequencerContext');
    }
    this.drawContextMenu(document);
    this.drawRenamePopup(document);
    this.handleShortcuts(document);
    this.acceptsClipboard = ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows) && !ImGui.GetIO().WantTextInput &&
      !ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup);
    ImGui.PopStyleColor(colors.length); ImGui.PopStyleVar(6);
  }

  private drawToolbar (document: SequencerDocument): void {
    const origin = ImGui.GetCursorScreenPos();
    const hasSelection = document.selectedKeys.size + document.selectedSections.size + document.selectedTracks.size > 0;

    this.bar(origin, L.toolbarHeight);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + L.toolbarPadding, origin.y + L.toolbarPadding));
    if (this.icon('actions', 'Actions', false, true, L.toolbarMenuWidth, true)) { this.openBelow('##SequenceActions'); }
    if (ImGui.BeginPopup('##SequenceActions')) {
      this.section('Editing');
      if (ImGui.MenuItem('Undo', 'Ctrl+Z', false, document.canUndo)) { document.undo(); }
      if (ImGui.MenuItem('Redo', 'Ctrl+Y', false, document.canRedo)) { document.redo(); }
      ImGui.Separator();
      if (ImGui.MenuItem('Cut', 'Ctrl+X', false, hasSelection)) { document.copySelection(); document.deleteSelection(); }
      if (ImGui.MenuItem('Copy', 'Ctrl+C', false, hasSelection)) { document.copySelection(); }
      if (ImGui.MenuItem('Paste', 'Ctrl+V', false, document.hasClipboard)) { document.paste(); }
      if (ImGui.MenuItem('Duplicate', this.state.curveMode ? '' : 'Ctrl+D', false, hasSelection)) { document.duplicateSelection(); }
      if (ImGui.MenuItem('Delete', 'Delete', false, hasSelection)) { document.deleteSelection(); }
      ImGui.Separator(); this.section('Sequence');
      if (ImGui.MenuItem('Export Timeline...')) { this.exportTimeline(document); }
      ImGui.EndPopup();
    }
    ImGui.SameLine();
    if (this.icon('view', 'View Options', false, true, L.toolbarMenuWidth, true)) { this.openBelow('##SequenceView'); }
    if (ImGui.BeginPopup('##SequenceView')) {
      this.section('Framing');
      if (ImGui.MenuItem('Frame Selection', 'F')) { this.state.fit(document); }
      if (ImGui.MenuItem('Frame All', 'Home')) { this.state.fit(document, false); }
      if (ImGui.MenuItem('Focus Playhead', 'A')) { this.focusPlayhead(document); }
      ImGui.Separator(); this.section('Tracks');
      if (ImGui.MenuItem('Expand All')) { this.state.expandAll(document, true); }
      if (ImGui.MenuItem('Collapse All')) { this.state.expandAll(document, false); }
      if (ImGui.MenuItem('Selection Details', '', this.state.showDetails)) { this.state.showDetails = !this.state.showDetails; }
      ImGui.Separator(); this.section('Display');
      if (ImGui.MenuItem('Frames', '', this.state.displayFrames)) { this.state.displayFrames = true; }
      if (ImGui.MenuItem('Seconds', '', !this.state.displayFrames)) { this.state.displayFrames = false; }
      if (ImGui.MenuItem('Show Tangents', '', this.state.showTangents)) { this.state.showTangents = !this.state.showTangents; }
      ImGui.EndPopup();
    }
    ImGui.SameLine();
    if (this.icon('play', 'Playback Options', false, true, L.toolbarMenuWidth, true)) { this.openBelow('##SequencePlayback'); }
    if (ImGui.BeginPopup('##SequencePlayback')) {
      this.section('Playback Range');
      const factor = this.state.displayFrames ? this.state.frameRate : 1;

      for (const side of ['Start', 'End'] as const) {
        ImGui.SetNextItemWidth(180);
        let value = (side === 'Start' ? this.state.playbackStart : this.state.playbackEnd) * factor;

        if (ImGui.DragFloat('##Playback' + side, next => value = next ?? value, factor / this.state.frameRate, 0, 1e8,
          side + (this.state.displayFrames ? '  %.0f' : '  %.3f s'))) {
          if (side === 'Start') { this.state.playbackStart = Math.max(0, Math.min(this.state.playbackEnd - 1 / this.state.frameRate, value / factor)); } else {
            this.state.playbackEnd = Math.max(this.state.playbackStart + 1 / this.state.frameRate, value / factor);
          }
        }
      }
      ImGui.Separator();
      ImGui.SetNextItemWidth(180);
      ImGui.DragInt('Jump Frames', value => this.state.jumpFrames = value ?? this.state.jumpFrames, 1, 1, 10000);
      if (ImGui.MenuItem('Loop Playback', '', this.state.loop)) { this.state.loop = !this.state.loop; }
      if (ImGui.MenuItem('Jump to Start')) { document.setTime(this.state.playbackStart); }
      if (ImGui.MenuItem('Jump to End')) { document.setTime(this.state.playbackEnd); }
      ImGui.EndPopup();
    }
    this.divider();
    if (this.icon('key', 'Add key at playhead (Enter)', false, hasSelection || this.state.curveMode && this.state.curveTracks.size > 0)) { this.addKeys(document); }
    ImGui.SameLine();
    if (this.icon('auto', 'Auto Key: record transform changes at the playhead', this.autoKey)) { this.autoKey = !this.autoKey; this.autoValues.clear(); }
    this.divider();
    if (this.icon('snap', 'Toggle snapping', this.state.snapping)) { this.state.snapping = !this.state.snapping; }
    if (ImGui.IsItemClicked(ImGui.MouseButton.Right)) { ImGui.OpenPopup('##SequenceSnapping'); }
    ImGui.SameLine(0, 0);
    if (this.icon('chevron', 'Snapping Options', false, true, 18)) { this.openBelow('##SequenceSnapping'); }
    if (ImGui.BeginPopup('##SequenceSnapping')) {
      this.section('Snap To');
      if (ImGui.MenuItem('Frames', '', this.state.snapFrames)) { this.state.snapFrames = !this.state.snapFrames; }
      if (ImGui.MenuItem('Keyframes', '', this.state.snapKeys)) { this.state.snapKeys = !this.state.snapKeys; }
      if (ImGui.MenuItem('Section Edges', '', this.state.snapSections)) { this.state.snapSections = !this.state.snapSections; }
      ImGui.EndPopup();
    }
    ImGui.SameLine();
    if (this.textButton(this.state.frameRate + ' fps', false, true)) { this.openBelow('##SequenceFPS'); }
    if (ImGui.BeginPopup('##SequenceFPS')) {
      this.section('Display Rate');
      [12, 15, 24, 25, 30, 48, 50, 60, 120].forEach(rate => {
        if (ImGui.MenuItem(rate + ' fps', '', this.state.frameRate === rate)) { this.state.frameRate = rate; }
      });
      ImGui.EndPopup();
    }
    this.divider();
    if (this.icon('curve', 'Curve Editor', this.state.curveMode)) {
      this.state.curveMode = !this.state.curveMode;
      if (this.state.curveMode && document.selectedTracks.size) { this.state.captureCurveSelection(document); }
      this.state.fitValues(document);
    }
    ImGui.SameLine(0, 12);
    const labelPosition = ImGui.GetCursorScreenPos();
    const available = origin.x + this.viewWidth - labelPosition.x - 26;

    if (available > 100) {
      drawSequenceIcon('folder', labelPosition.x, origin.y + 12, 16, C.text);
      ImGui.SetCursorScreenPos(new ImGui.Vec2(labelPosition.x + 22, origin.y + 10));
      let name = document.composition.name || 'Sequence';

      while (name.length > 1 && ImGui.CalcTextSize(name).x > available - 22) { name = name.slice(0, -2) + '…'; }
      ImGui.TextColored(C.text, name);
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + L.toolbarHeight));
    ImGui.Dummy(new ImGui.Vec2(this.viewWidth, 0));
  }

  private drawOutlinerHeader (document: SequencerDocument): void {
    const header = this.canvas.header;
    const compact = header.width < 250;
    const addWidth = compact ? 28 : 70;
    const timeWidth = compact ? 56 : 68;

    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, Math.max(2, (24 - ImGui.GetFontSize()) / 2)));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(header.x + 6, header.y + 7));
    ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Vec4(0.18, 0.42, 0.20, 1));
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.Vec4(0.22, 0.50, 0.25, 1));
    const add = ImGui.Button('##SequenceAddTrack', new ImGui.Vec2(addWidth, 24));
    const addMin = ImGui.GetItemRectMin();

    drawSequenceIcon('plus', addMin.x + (compact ? 7 : 5), addMin.y + 5, 14, C.selectedText);
    if (!compact) {
      ImGui.GetWindowDrawList().AddText(new ImGui.Vec2(addMin.x + 23, addMin.y + (24 - ImGui.GetTextLineHeight()) / 2),
        ImGui.GetColorU32(C.selectedText), 'Track');
    }

    ImGui.PopStyleColor(2);
    if (add) { this.openBelow('##SequenceAddTrack'); }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(header.x + addWidth + 12, header.y + 7));
    searchBar('##SequenceSearch', this.searchBuffer, { width: Math.max(24, header.width - addWidth - timeWidth - 27), hint: compact ? '' : 'Search' });
    this.state.search = this.searchBuffer[0];
    ImGui.SetCursorScreenPos(new ImGui.Vec2(header.x + header.width - timeWidth - 5, header.y + 7));
    ImGui.SetNextItemWidth(timeWidth);
    ImGui.PushStyleColor(ImGui.Col.FrameBg, new ImGui.Vec4(0, 0, 0, 0));
    ImGui.PushStyleColor(ImGui.Col.Text, C.time);
    let time = this.state.displayFrames ? document.currentTime * this.state.frameRate : document.currentTime;

    if (ImGui.DragFloat('##CurrentFrame', value => time = value ?? time, this.state.displayFrames ? 1 : 0.01, 0, 1e6,
      this.state.displayFrames ? '%04.0f' : '%.3f s')) { document.setTime(this.state.displayFrames ? time / this.state.frameRate : time); }
    ImGui.PopStyleColor(2);
    ImGui.PopStyleVar();
    if (ImGui.BeginPopup('##SequenceAddTrack')) {
      this.section('Add Selected Objects');
      const selected = Selection.getSelectedObjects().filter((object): object is VFXItem => object instanceof VFXItem && object.composition === document.composition);

      if (!selected.length) { ImGui.TextDisabled('Select an object in the scene or hierarchy.'); }
      if (ImGui.MenuItem('Selected Objects with Transform', '', false, selected.length > 0)) {
        document.edit('Add object tracks', () => selected.forEach(item => {
          const binding = document.addBinding(item);

          if (!binding.getChildTracks().some(track => track instanceof TransformTrack)) { document.addTrack(binding, 'transform'); }
          this.state.expanded.add(binding.getInstanceId());
        }));
      }
      ImGui.Separator(); this.section('Scene Objects');
      const items = document.composition.items.filter(item => item !== document.composition.pluginRoot && !item.name?.startsWith('__'));

      for (const item of items) {
        if (ImGui.MenuItem(item.name || 'Object')) {
          document.edit('Add object track', () => {
            const binding = document.addBinding(item);

            document.addTrack(binding, 'transform'); this.state.expanded.add(binding.getInstanceId());
          });
        }
      }
      ImGui.EndPopup();
    }
  }

  private drawDetails (document: SequencerDocument): void {
    const origin = ImGui.GetCursorScreenPos();

    this.bar(origin, L.detailsHeight);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 7, origin.y + 3));
    const keys = document.selectedKeyItems();

    if (keys.length) {
      const first = keys[0];

      ImGui.BeginDisabled(keys.every(item => document.isLocked(item.section.track)));
      ImGui.AlignTextToFramePadding(); ImGui.Text(first.channel.label + '  Key');
      ImGui.SameLine(); ImGui.SetNextItemWidth(85);
      let time = this.state.displayFrames ? (first.section.clip.start + first.key.time * first.section.clip.duration) * this.state.frameRate :
        first.section.clip.start + first.key.time * first.section.clip.duration;

      if (ImGui.DragFloat('##KeyTime', value => time = value ?? time, this.state.displayFrames ? 1 : 0.01, 0, 1e6,
        this.state.displayFrames ? '%.0f' : '%.3f')) {
        document.begin('Edit key time'); this.setKeyTime(document, keys, this.state.displayFrames ? time / this.state.frameRate : time);
      }
      if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
      if (first.channel.kind === 'number') {
        ImGui.SameLine(); ImGui.SetNextItemWidth(95);
        let value = first.key.value;

        if (ImGui.DragFloat('##KeyValue', next => value = next ?? value, 0.01, -1e8, 1e8, '%.3f')) {
          document.begin('Edit key values');
          const delta = value - first.key.value;

          this.updateKeys(document, keys, item => item.key.value += delta);
        }
        if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
        ImGui.SameLine();
        if (this.textButton(this.keyMode(first))) { this.openBelow('##KeyInterpolation'); }
        if (ImGui.BeginPopup('##KeyInterpolation')) { this.drawInterpolation(document); ImGui.EndPopup(); }
        if (this.viewWidth > 800) {
          for (const side of ['in', 'out'] as const) {
            ImGui.SameLine(); ImGui.SetNextItemWidth(105);
            let slope = side === 'in' ? first.key.inSlope / first.section.clip.duration : first.key.outSlope / first.section.clip.duration;

            if (ImGui.DragFloat(side === 'in' ? '##InSlope' : '##OutSlope', value => slope = value ?? slope, 0.01, -1e6, 1e6,
              side === 'in' ? 'In %.2f' : 'Out %.2f')) {
              document.begin('Edit tangent slopes');
              this.updateKeys(document, keys, item => {
                const value = slope * item.section.clip.duration;

                item.key[side === 'in' ? 'inSlope' : 'outSlope'] = value;
                if (item.key.tangentMode !== 'break') { item.key.inSlope = item.key.outSlope = value; item.key.tangentMode = 'user'; }
              });
            }
            if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
          }
        }
      } else {
        const reference = first.channel.references?.get(first.key.id);

        ImGui.SameLine(); ImGui.TextDisabled(reference?.definition.name ?? reference?.getInstanceId().slice(0, 8) ?? 'None');
      }
      ImGui.EndDisabled();
    } else {
      const section = document.selectedSectionItems[0];

      if (section) {
        ImGui.BeginDisabled(document.isLocked(section.track));
        ImGui.AlignTextToFramePadding(); ImGui.Text('Section');
        ImGui.SameLine(); ImGui.SetNextItemWidth(100);
        const factor = this.state.displayFrames ? this.state.frameRate : 1;
        let start = section.clip.start * factor;

        if (ImGui.DragFloat('##SectionStart', value => start = value ?? start, factor / this.state.frameRate, 0, 1e6,
          this.state.displayFrames ? 'Start %04.0f' : 'Start %.3f s')) {
          document.begin('Move section'); section.clip.start = Math.max(0, start / factor); document.write(section); document.changed();
        }
        if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
        ImGui.SameLine(); ImGui.SetNextItemWidth(115);
        let duration = section.clip.duration * factor;

        if (ImGui.DragFloat('##SectionDuration', value => duration = value ?? duration, factor / this.state.frameRate,
          factor / this.state.frameRate, 1e6, this.state.displayFrames ? 'Length %.0f f' : 'Length %.3f s')) {
          document.begin('Stretch section'); section.clip.duration = Math.max(1 / this.state.frameRate, duration / factor); document.write(section); document.changed();
        }
        if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
        if (this.viewWidth > 590) {
          ImGui.SameLine();
          if (this.textButton('Split at Playhead')) { document.splitSelection(document.currentTime); }
        }
        ImGui.EndDisabled();
      }
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + L.detailsHeight));
    ImGui.Dummy(new ImGui.Vec2(this.viewWidth, 0));
  }

  private drawTransport (document: SequencerDocument): void {
    const origin = ImGui.GetCursorScreenPos();
    const detailed = this.state.outlinerWidth >= 230;
    const controls: { icon: SequenceIcon, hint: string, action: () => void, active?: boolean }[] = [
      { icon: 'first', hint: 'Jump to Start', action: () => document.setTime(this.state.playbackStart) },
      ...(detailed ? [{ icon: 'previous' as const, hint: 'Previous Key (,)', action: () => this.stepKey(document, -1) }] : []),
      { icon: 'back', hint: 'Previous Frame', action: () => document.setTime(Math.max(this.state.playbackStart, document.currentTime - 1 / this.state.frameRate)) },
      { icon: document.composition.getPaused() ? 'play' : 'pause', hint: 'Play / Pause (Space)', action: () => this.togglePlay(document) },
      { icon: 'forward', hint: 'Next Frame', action: () => document.setTime(Math.min(this.state.playbackEnd, document.currentTime + 1 / this.state.frameRate)) },
      ...(detailed ? [{ icon: 'next' as const, hint: 'Next Key (.)', action: () => this.stepKey(document, 1) }] : []),
      { icon: 'last', hint: 'Jump to End', action: () => document.setTime(this.state.playbackEnd) },
      { icon: 'loop', hint: 'Loop Playback', action: () => this.state.loop = !this.state.loop, active: this.state.loop },
    ];

    this.bar(origin, L.footerHeight);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + 6, origin.y + 3));
    const buttonWidth = detailed ? 24 : Math.max(20, Math.min(24, Math.floor((this.state.outlinerWidth - 16) / 6) - 2));

    for (const [index, control] of controls.entries()) {
      if (index) { ImGui.SameLine(0, 2); }
      if (this.icon(control.icon, control.hint, control.active, true, buttonWidth, false, 24)) { control.action(); }
    }
    this.canvas.drawFooter(document, origin.y);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + L.footerHeight));
    ImGui.Dummy(new ImGui.Vec2(this.viewWidth, 0));
  }

  private drawCurveTools (document: SequencerDocument): void {
    const origin = ImGui.GetCursorScreenPos();
    const keys = document.selectedKeyItems();
    const first = keys[0];
    const factor = this.state.displayFrames ? this.state.frameRate : 1;

    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, Math.max(2, (L.toolbarButtonHeight - ImGui.GetFontSize()) / 2)));
    this.bar(origin, L.curveToolbarHeight);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + L.toolbarPadding, origin.y + L.toolbarPadding));
    ImGui.BeginDisabled(!first || keys.every(item => document.isLocked(item.section.track)));
    ImGui.SetNextItemWidth(104);
    let time = first ? (first.section.clip.start + first.key.time * first.section.clip.duration) * factor : 0;

    if (ImGui.DragFloat('##CurveKeyTime', value => time = value ?? time, factor / this.state.frameRate, 0, 1e8,
      this.state.displayFrames ? 'Time  %.0f' : 'Time  %.3f s') && first) {
      document.begin('Edit key time'); this.setKeyTime(document, keys, time / factor);
    }
    if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
    ImGui.SameLine(); ImGui.SetNextItemWidth(112);
    let value = first?.key.value ?? 0;

    if (ImGui.DragFloat('##CurveKeyValue', next => value = next ?? value, 0.01, -1e8, 1e8, 'Value  %.3f') && first) {
      document.begin('Edit key value');
      const delta = value - first.key.value;

      this.updateKeys(document, keys, item => item.key.value += delta);
    }
    if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
    this.divider();
    const modes: { name: Interpolation, icon: SequenceIcon }[] = [
      { name: 'Auto', icon: 'tangentAuto' }, { name: 'User', icon: 'tangentUser' }, { name: 'Break', icon: 'tangentBreak' },
      { name: 'Linear', icon: 'linear' }, { name: 'Constant', icon: 'constant' },
    ];

    for (const [index, mode] of modes.entries()) {
      if (index) { ImGui.SameLine(0, 1); }
      if (this.icon(mode.icon, mode.name, !!first && this.keyMode(first) === mode.name)) { this.setInterpolation(document, mode.name); }
    }
    ImGui.EndDisabled();
    if (this.viewWidth > 550) {
      this.divider();
      if (this.icon('flatten', 'Flatten Tangents', false, !!first)) {
        document.edit('Flatten tangents', () => this.updateKeys(document, keys, item => {
          item.key.inSlope = item.key.outSlope = 0; item.key.tangentMode = 'user'; item.key.interpolationMode = InterpolationMode.Cubic;
        }));
      }
      ImGui.SameLine(0, 1);
      if (this.icon('fit', 'Frame Selection (F)')) { this.state.fit(document); }
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x, origin.y + L.curveToolbarHeight));
    ImGui.Dummy(new ImGui.Vec2(this.viewWidth, 0));
    ImGui.PopStyleVar();
  }

  private drawContextMenu (document: SequencerDocument): void {
    if (!ImGui.BeginPopup('##SequencerContext')) { return; }
    const row = this.context?.row;
    const section = this.context?.section ?? document.selectedSectionItems[0];
    const keys = document.selectedKeyItems();

    if (keys.length) {
      this.section('Keyframes');
      if (!this.state.curveMode && ImGui.MenuItem('Key Properties...')) { this.state.showDetails = true; }
      if (ImGui.MenuItem('Add Key at Playhead', 'Enter')) { this.addKeys(document); }
      if (ImGui.BeginMenu('Interpolation', keys.some(item => item.channel.kind === 'number'))) {
        this.drawInterpolation(document); ImGui.EndMenu();
      }
      if (ImGui.MenuItem('Flatten Tangents')) {
        document.edit('Flatten tangents', () => this.updateKeys(document, keys, item => {
          item.key.inSlope = item.key.outSlope = 0; item.key.tangentMode = 'user'; item.key.interpolationMode = InterpolationMode.Cubic;
        }));
      }
      ImGui.Separator();
    }
    if (section) {
      ImGui.BeginDisabled(document.isLocked(section.track));
      this.section('Section');
      if (ImGui.MenuItem('Section Properties...')) { this.state.showDetails = true; }
      if (ImGui.MenuItem('Split at Playhead', 'Ctrl+/')) { document.splitSelection(document.currentTime); }
      const inside = document.currentTime > section.clip.start && document.currentTime < section.clip.start + section.clip.duration;

      if (ImGui.MenuItem('Trim Left to Playhead', '', false, inside)) {
        document.edit('Trim section left', () => document.resizeSection(section, document.currentTime, section.clip.start + section.clip.duration));
      }
      if (ImGui.MenuItem('Trim Right to Playhead', '', false, inside)) {
        document.edit('Trim section right', () => document.resizeSection(section, section.clip.start, document.currentTime));
      }
      ImGui.Separator(); this.section('Post Roll');
      for (const [name, behavior] of [['Finish', 0], ['Hold', 4], ['Loop', 5]] as const) {
        if (ImGui.MenuItem(name, '', section.clip.endBehavior === behavior)) {
          document.edit('Set section end behavior', () => { section.clip.endBehavior = behavior; document.write(section); });
        }
      }
      ImGui.EndDisabled();
      ImGui.Separator();
    }
    if (row) {
      this.section('Track');
      if (ImGui.MenuItem('Rename...')) {
        this.renameTrack = row.track; this.renameValue = document.trackLabel(row.track); this.renameRequested = true;
      }
      if (ImGui.MenuItem('Mute Track', '', document.muted.has(row.track.getInstanceId()))) { document.toggleMute(row.track); }
      const ownLock = document.locked.has(row.track.getInstanceId());

      if (ImGui.MenuItem('Lock Track', '', ownLock)) {
        document.edit('Toggle track lock', () => {
          if (ownLock) { document.locked.delete(row.track.getInstanceId()); } else { document.locked.add(row.track.getInstanceId()); }
        });
      }
      if (ImGui.MenuItem('Add Section', '', false, row.kind !== 'object' && !document.isLocked(row.track))) {
        document.edit('Add section', () => { document.createSection(row.track); });
      }
      const parent = this.bindingParent(row.track);

      if (parent && ImGui.BeginMenu('Add Property Track', !document.isLocked(parent))) {
        for (const [name, kind] of [['Transform', 'transform'], ['Activation', 'activation'], ['Opacity', 'opacity']] as const) {
          if (ImGui.MenuItem(name)) { document.edit('Add property track', () => { document.addTrack(parent, kind); this.state.expanded.add(parent.getInstanceId()); }); }
        }
        ImGui.EndMenu();
      }
      ImGui.Separator();
    }
    this.section('Edit');
    if (ImGui.MenuItem('Copy', 'Ctrl+C')) { document.copySelection(); }
    if (ImGui.MenuItem('Paste', 'Ctrl+V', false, document.hasClipboard)) { document.paste(this.context?.time ?? document.currentTime); }
    if (ImGui.MenuItem('Duplicate', this.state.curveMode ? '' : 'Ctrl+D')) { document.duplicateSelection(); }
    if (ImGui.MenuItem('Delete', 'Delete')) { document.deleteSelection(); }
    ImGui.EndPopup();
  }

  private drawRenamePopup (document: SequencerDocument): void {
    if (this.renameRequested) { ImGui.OpenPopup('##RenameTrack'); this.renameRequested = false; }
    if (ImGui.BeginPopup('##RenameTrack')) {
      ImGui.Text('Track Name');
      ImGui.SetNextItemWidth(240);
      if (ImGui.IsWindowAppearing()) { ImGui.SetKeyboardFocusHere(); }
      const accepted = ImGui.InputText('##TrackName', value => {
        if (value !== undefined) { this.renameValue = value; }

        return this.renameValue;
      }, undefined, ImGui.InputTextFlags.EnterReturnsTrue | ImGui.InputTextFlags.AutoSelectAll);

      if ((accepted || ImGui.Button('Rename')) && this.renameTrack && this.renameValue.trim()) {
        document.edit('Rename track', () => { this.renameTrack!.name = this.renameValue.trim(); });
        this.renameTrack = undefined; ImGui.CloseCurrentPopup();
      }
      ImGui.SameLine();
      if (ImGui.Button('Cancel') || ImGui.IsKeyPressed(ImGui.Key.Escape)) { this.renameTrack = undefined; ImGui.CloseCurrentPopup(); }
      ImGui.EndPopup();
    }
  }

  private drawInterpolation (document: SequencerDocument): void {
    for (const mode of ['Auto', 'User', 'Break', 'Linear', 'Constant'] as Interpolation[]) {
      const first = document.selectedKeyItems()[0];

      if (ImGui.MenuItem(mode, '', !!first && this.keyMode(first) === mode, !!first)) { this.setInterpolation(document, mode); }
    }
  }

  private setInterpolation (document: SequencerDocument, mode: Interpolation): void {
    document.edit('Set key interpolation', () => {
      this.updateKeys(document, document.selectedKeyItems(), item => {
        if (item.channel.kind !== 'number') { return; }
        item.key.interpolationMode = mode === 'Linear' ? InterpolationMode.Linear : mode === 'Constant' ? InterpolationMode.Constant : InterpolationMode.Cubic;
        item.key.tangentMode = mode === 'Auto' ? 'auto' : mode === 'Break' ? 'break' : 'user';
      });
    });
  }

  private keyMode (item: KeySelection): Interpolation {
    if (item.key.interpolationMode === InterpolationMode.Linear) { return 'Linear'; }
    if (item.key.interpolationMode === InterpolationMode.Constant) { return 'Constant'; }

    return item.key.tangentMode === 'auto' ? 'Auto' : item.key.tangentMode === 'break' ? 'Break' : 'User';
  }

  private updateKeys (document: SequencerDocument, keys: KeySelection[], action: (item: KeySelection) => void): void {
    const sections = new Set<SequenceSection>();

    keys.forEach(item => {
      if (!document.isLocked(item.section.track)) { action(item); sections.add(item.section); }
    });
    sections.forEach(section => {
      section.channels.forEach(channel => updateAutoTangents(channel.keys)); document.write(section);
    });
    document.changed();
  }

  private setKeyTime (document: SequencerDocument, keys: KeySelection[], time: number): void {
    const first = keys[0];
    let delta = time - (first.section.clip.start + first.key.time * first.section.clip.duration);

    delta = Math.max(Math.max(...keys.map(item => -item.key.time * item.section.clip.duration)),
      Math.min(Math.min(...keys.map(item => (1 - item.key.time) * item.section.clip.duration)), delta));
    this.updateKeys(document, keys, item => item.key.time += delta / item.section.clip.duration);
  }

  private addKeys (document: SequencerDocument): void {
    const row = this.state.rows(document).find(row => row.id === this.state.activeChannel);

    if (row || this.state.curveMode) {
      const channels = row?.channels ?? this.state.curveChannels(document, true);

      if (!channels.length) { return; }
      document.edit('Add channel keys', () => {
        document.selectedKeys.clear();
        channels.forEach(entry => document.insertKey(entry.section, entry.channel, document.currentTime));
      });
    } else { document.addKeys(document.currentTime); }
  }

  private bindingParent (track: TrackAsset): TrackAsset | undefined {
    let parent: TrackAsset | undefined = track;

    while (parent && !(parent instanceof ObjectBindingTrack)) { parent = parent.parent; }

    return parent;
  }

  private stepKey (document: SequencerDocument, direction: number): void {
    const selectedTracks = document.selectedTracks;
    const channels = this.state.curveMode ? this.state.curveChannels(document) : document.allSections()
      .filter(section => !selectedTracks.size || document.trackSelected(section.track)).flatMap(section => section.channels.map(channel => ({ section, channel })));
    const times = channels.flatMap(({ section, channel }) => channel.keys.map(key => section.clip.start + key.time * section.clip.duration));
    const candidates = times.filter(time => direction > 0 ? time > document.currentTime + 1e-6 : time < document.currentTime - 1e-6);

    if (candidates.length) { document.setTime(direction > 0 ? Math.min(...candidates) : Math.max(...candidates)); }
  }

  private togglePlay (document: SequencerDocument): void {
    if (!document.composition.getPaused()) { document.composition.pause(); } else {
      if (document.currentTime >= this.state.playbackEnd || document.currentTime < this.state.playbackStart) { document.setTime(this.state.playbackStart); }
      void document.composition.resume();
    }
  }

  private focusPlayhead (document: SequencerDocument): void {
    const range = this.state.viewEnd - this.state.viewStart;

    this.state.viewStart = document.currentTime - range / 2; this.state.viewEnd = document.currentTime + range / 2;
  }

  private handleShortcuts (document: SequencerDocument): void {
    if (!ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows) || this.canvas.editingValue || ImGui.GetIO().WantTextInput || ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup)) { return; }
    const io = ImGui.GetIO(), command = io.KeyCtrl || io.KeySuper;
    const pressed = (key: ImGui.Key) => ImGui.IsKeyPressed(key, false);

    if (pressed(ImGui.Key.Escape)) {
      this.canvas.cancel(document); document.clearSelection();
      if (!this.state.curveMode) { this.state.activeChannel = ''; this.state.captureCurveSelection(document); }
    } else if (command && pressed(ImGui.Key.Z)) { if (io.KeyShift) { document.redo(); } else { document.undo(); } } else if (command && pressed(ImGui.Key.Y)) { document.redo(); } else if (command && pressed(ImGui.Key.D)) {
      if (this.state.curveMode) { document.selectedKeys.clear(); } else { document.duplicateSelection(); }
    } else if (command && pressed(ImGui.Key.A)) {
      const channels = this.state.curveMode ? this.state.curveChannels(document).map(entry => entry.channel) : document.allSections().flatMap(section => section.channels);

      channels.forEach(channel => channel.keys.forEach(key => document.selectedKeys.add(key.id)));
    } else if (!command && pressed(ImGui.Key.V)) {
      this.state.toggleSelectedExpansion(document, io.KeyShift);
    } else if (pressed(ImGui.Key.DownArrow)) {
      if (document.composition.getPaused()) { this.togglePlay(document); }
    } else if (pressed(ImGui.Key.K)) {
      document.composition.pause();
    } else if (pressed(ImGui.Key.UpArrow)) {
      document.setTime(command ? this.state.playbackEnd : this.state.playbackStart);
    } else if (!command && !io.KeyAlt && pressed(ImGui.Key.LeftBracket)) {
      this.state.playbackStart = Math.min(document.currentTime, this.state.playbackEnd - 1 / this.state.frameRate);
    } else if (!command && !io.KeyAlt && pressed(ImGui.Key.RightBracket)) {
      this.state.playbackEnd = Math.max(document.currentTime, this.state.playbackStart + 1 / this.state.frameRate);
    } else if (command && pressed(ImGui.Key.Slash)) { document.splitSelection(document.currentTime); } else if (pressed(ImGui.Key.Delete) || pressed(ImGui.Key.Backspace)) { document.deleteSelection(); } else if (pressed(ImGui.Key.Space)) { this.togglePlay(document); } else if (pressed(ImGui.Key.Enter)) { this.addKeys(document); } else if (pressed(ImGui.Key.F)) { this.state.fit(document); } else if (pressed(ImGui.Key.Home)) { this.state.fit(document, false); } else if (pressed(ImGui.Key.A)) { this.focusPlayhead(document); } else if (pressed(ImGui.Key.Comma)) { this.stepKey(document, -1); } else if (pressed(ImGui.Key.Period)) { this.stepKey(document, 1); } else if (pressed(ImGui.Key.LeftArrow) || pressed(ImGui.Key.RightArrow)) {
      const direction = pressed(ImGui.Key.LeftArrow) ? -1 : 1;

      if (command && (document.selectedKeys.size || document.selectedSections.size)) {
        document.edit('Nudge selection', () => {
          const keys = document.selectedKeyItems();

          if (keys.length) { this.setKeyTime(document, keys, keys[0].section.clip.start + keys[0].key.time * keys[0].section.clip.duration + direction / this.state.frameRate); } else {
            const sections = document.selectedSectionItems.filter(section => !document.isLocked(section.track));
            const delta = Math.max(-Math.min(...sections.map(section => section.clip.start)), direction / this.state.frameRate);

            sections.forEach(section => { section.clip.start += delta; document.write(section); });
          }
        });
      } else { document.setTime(Math.max(0, document.currentTime + direction * (io.KeyShift ? this.state.jumpFrames : 1) / this.state.frameRate)); }
    } else {
      [ImGui.Key._1, ImGui.Key._2, ImGui.Key._3, ImGui.Key._4, ImGui.Key._5].forEach((key, index) => {
        if (pressed(key)) { this.setInterpolation(document, ['Auto', 'User', 'Break', 'Linear', 'Constant'][index] as Interpolation); }
      });
    }
  }

  private updateAutoKey (document: SequencerDocument): void {
    const shouldRecord = this.autoKey && document.composition.getPaused() && this.lastRevision === document.revision &&
      Math.abs(this.lastAutoTime - document.currentTime) < 1e-8;

    this.lastRevision = document.revision; this.lastAutoTime = document.currentTime;
    const selected = Selection.getSelectedObjects().filter((object): object is VFXItem =>
      object instanceof VFXItem && object.composition === document.composition);
    const selectedIds = new Set(selected.map(object => object.getInstanceId()));

    for (const id of this.autoValues.keys()) { if (!selectedIds.has(id)) { this.autoValues.delete(id); } }
    for (const object of selected) {
      const values = [...object.transform.position.toArray(), ...getEditorRotation(object.transform).toArray(), ...object.transform.scale.toArray()];
      const previous = this.autoValues.get(object.getInstanceId());

      this.autoValues.set(object.getInstanceId(), values);
      if (!shouldRecord || !previous) { continue; }
      const changed = values.map((value, index) => Math.abs(value - previous[index]) > 1e-6);

      if (!changed.some(Boolean)) { continue; }
      const sections = document.allSections().filter(section => section.channels.length === 9 && document.boundItem(section.track) === object &&
        !document.isLocked(section.track) && !document.isMuted(section.track) && document.currentTime >= section.clip.start && document.currentTime <= section.clip.start + section.clip.duration &&
        section.channels.some((channel, index) => changed[index]));

      if (!sections.length) { continue; }
      document.begin('Auto key transforms'); this.autoRecording = true;
      sections.forEach(section => {
        section.channels.forEach((channel, index) => {
          if (changed[index]) {
            document.insertKey(section, channel, document.currentTime, values[index]);
          }
        });
      });
      document.changed();
      this.lastRevision = document.revision;
    }
    if (this.autoRecording && (!this.autoKey || !ImGui.IsMouseDown(ImGui.MouseButton.Left) && !ImGui.IsAnyItemActive())) {
      document.commit(); this.autoRecording = false;
    }
  }

  private exportTimeline (document: SequencerDocument): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(document.exportData(), null, 2)], { type: 'application/json' }));
    const anchor = window.document.createElement('a');

    anchor.href = url; anchor.download = (document.composition.name || 'sequence') + '-timeline.json';
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private openBelow (id: string): void {
    const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax();

    ImGui.OpenPopup(id);
    ImGui.SetNextWindowPos(new ImGui.Vec2(min.x, max.y + 3));
  }

  private section (label: string): void { editorMenuSection(label); }
  private textButton (label: string, active = false, menu = false): boolean {
    ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.Vec4(0, 0, 0, 0));
    ImGui.PushStyleColor(ImGui.Col.Text, active ? C.active : C.text);
    const result = ImGui.Button(menu ? '##SequenceText' + label : label, new ImGui.Vec2(ImGui.CalcTextSize(label).x + (menu ? 28 : 12), L.toolbarButtonHeight));

    if (menu) {
      const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax();

      ImGui.GetWindowDrawList().AddText(new ImGui.Vec2(min.x + 6, min.y + (max.y - min.y - ImGui.GetTextLineHeight()) / 2),
        ImGui.GetColorU32(active ? C.active : C.text), label);
      drawSequenceIcon('chevron', max.x - 20, min.y + (max.y - min.y - 16) / 2, 16, ImGui.IsItemHovered() ? C.selectedText : C.muted);
    }

    ImGui.PopStyleColor(2);

    return result;
  }
  private divider (): void {
    ImGui.SameLine(0, 5);
    const point = ImGui.GetCursorScreenPos();

    ImGui.GetWindowDrawList().AddLine(new ImGui.Vec2(point.x, point.y + 2), new ImGui.Vec2(point.x, point.y + L.toolbarButtonHeight - 2), ImGui.GetColorU32(C.line));
    ImGui.Dummy(new ImGui.Vec2(1, L.toolbarButtonHeight)); ImGui.SameLine(0, 5);
  }
  private bar (origin: ImGui.Vec2, height: number): void {
    const dl = ImGui.GetWindowDrawList();

    dl.AddRectFilled(origin, new ImGui.Vec2(origin.x + this.viewWidth, origin.y + height), ImGui.GetColorU32(C.toolbar));
    dl.AddLine(new ImGui.Vec2(origin.x, origin.y), new ImGui.Vec2(origin.x + this.viewWidth, origin.y), ImGui.GetColorU32(C.line));
  }

  private icon (icon: SequenceIcon, hint: string, active = false, enabled = true, width: number = L.toolbarButtonSize, menu = false, height: number = L.toolbarButtonHeight): boolean {
    ImGui.BeginDisabled(!enabled);
    const filled = active && icon !== 'loop';

    ImGui.PushStyleColor(ImGui.Col.Button, filled ? C.selection : new ImGui.Vec4(0, 0, 0, 0));
    ImGui.PushStyleColor(ImGui.Col.ButtonHovered, filled ? C.selectionHovered : C.hover);
    ImGui.PushStyleColor(ImGui.Col.ButtonActive, filled ? C.selectionPressed : C.inputBorder);
    const clicked = ImGui.Button('##Sequence' + icon + hint, new ImGui.Vec2(width, height));

    ImGui.PopStyleColor(3);
    const point = ImGui.GetItemRectMin();
    const size = icon === 'chevron' ? 16 : L.toolbarIconSize;
    const left = menu ? 6 : (width - size) / 2;
    const tint = !enabled ? C.muted : filled ? C.selectedText : active ? C.active : ImGui.IsItemHovered() ? C.selectedText : C.text;

    drawSequenceIcon(icon, point.x + left, point.y + (height - size) / 2, size, tint);
    if (menu) { drawSequenceIcon('chevron', point.x + width - 18, point.y + (height - 16) / 2, 16, C.muted); }
    if (ImGui.IsItemHovered()) { ImGui.SetTooltip(hint); }
    ImGui.EndDisabled();

    return clicked;
  }
}
