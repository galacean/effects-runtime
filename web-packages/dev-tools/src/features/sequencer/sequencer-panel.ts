import type { TrackAsset } from '@galacean/effects';
import { CompositionComponent, InterpolationMode, ObjectBindingTrack, TransformPlayableAsset, TransformTrack, VFXItem } from '@galacean/effects';
import { editorPanel, menuItem } from '../../framework/registry/editor-registry';
import { EditorSelection } from '../../framework/selection/editor-selection';
import { EditorWindow } from '../../framework/windows/editor-window';
import { downloadBlob } from '../../platform/browser-files/file-dialog';
import { EditorRuntimeSession } from '../../platform/effects-runtime/editor-runtime-session';
import { ImGui } from '../../platform/imgui/index';
import { commandMenuItem } from '../../ui/menus/command-menu-item';
import { InteractionColors } from '../../ui/theme/editor-interaction';
import { beginEditorMenu, beginEditorPopup, editorMenuItem, editorMenuSection, endEditorMenu, endEditorPopup } from '../../ui/widgets/editor-menu';
import { searchBar } from '../../ui/widgets/index';
import { toolbarButton, toolbarSeparator } from '../../ui/widgets/toolbar-button';
import { getEditorRotation } from '../scene/operations/editor-transform';
import { sceneWorkspace } from '../scene/scene-workspace';
import { updateAutoTangents } from './curve-data';
import type { SequencerContext } from './sequencer-canvas';
import { SequencerCanvas } from './sequencer-canvas';
import type { KeySelection, SequenceChannel, SequenceSection } from './sequencer-document';
import { SequencerDocument } from './sequencer-document';
import { SequencerState } from './sequencer-state';
import { SEQUENCE_COLORS as C, SEQUENCE_LAYOUT as L } from './sequencer-style';

import type { SequenceIcon } from './sequencer-icons';
import { drawSequenceIcon } from './sequencer-icons';
import { findSequenceTimeline } from './sequencer-preview';
type Interpolation = 'Auto' | 'User' | 'Break' | 'Linear' | 'Constant';

function transformChannelIndex (channel: SequenceChannel): number {
  return channel.axis < 3 ? channel.group === 'Location' ? channel.axis : channel.group === 'Rotation' ? 3 + channel.axis :
    channel.group === 'Scale' ? 6 + channel.axis : -1 : -1;
}

@editorPanel()
export class SequencerPanel extends EditorWindow {
  private readonly state = new SequencerState();
  private readonly canvas = new SequencerCanvas(this.state, track => this.selectBoundItems(track));
  private document?: SequencerDocument;
  private documents = new Map<CompositionComponent, SequencerDocument>();
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
  private restoredSelection = false;
  private lastAutoTime = NaN;
  private autoRecording = false;
  private acceptsClipboard = false;
  private clipboardCommands: string[] = [];
  private positionError = '';
  private showPositionError = false;
  private readonly onClipboard = (event: ClipboardEvent): void => {
    if (!this.acceptsClipboard || event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) { return; }
    this.clipboardCommands.push(event.type);
    event.preventDefault();
  };

  @menuItem('Window/Sequencer')
  static showWindow (): void { EditorWindow.getWindow(SequencerPanel).open(); }

  constructor () {
    super(); this.title = 'Sequencer';
    this.setWindowFlags(ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
    this.open();
  }

  override update (): void {
    const composition = EditorRuntimeSession.player.getCompositions()[0];

    if (sceneWorkspace.current) { sceneWorkspace.current.autoKeyTarget = () => false; }

    for (const [component, document] of this.documents) {
      if (document.composition !== composition) { document.dispose(); this.documents.delete(component); }
    }

    if (!composition) {
      this.document = undefined;

      return;
    }
    let component = composition.sceneRoot.getComponent(CompositionComponent);
    const selected = EditorSelection.getSelectedObjects()[0];

    if (selected instanceof VFXItem) { component = selected.getComponent(CompositionComponent) ?? component; }
    const timeline = component ? findSequenceTimeline(component) : undefined;

    if (!component || !timeline) {
      this.document = undefined;

      return;
    }
    if (this.document?.component !== component || this.document.timeline !== timeline) {
      this.document?.commit();
      this.positionError = '';
      const cached = this.documents.get(component);

      if (cached && cached.timeline !== timeline) { cached.dispose(); }
      this.document = cached?.timeline === timeline ? cached : new SequencerDocument(composition, component);
      this.documents.set(component, this.document);
      this.state.initialize(this.document); this.searchBuffer[0] = '';
      this.autoValues.clear(); this.lastRevision = -1;
      this.lastAutoTime = NaN; this.autoRecording = false;
      if (!this.restoredSelection) { this.onSelectionChange(); }
    }
    this.restoredSelection = false;
    const document = this.document;

    if (sceneWorkspace.current) {
      sceneWorkspace.current.autoKeyTarget = item => this.autoKey && document.composition.getPaused() && document.allSections().some(section =>
        section.clip instanceof TransformPlayableAsset && document.boundItem(section.track) === item && !document.isLocked(section.track) && !document.isMuted(section.track) &&
        document.currentTime >= section.clip.start && document.currentTime <= section.clip.start + section.clip.duration);
    }

    document.sync();
    if (!composition.getPaused() && document.currentTime >= this.state.playbackEnd) {
      document.setTime(this.state.loop ? this.state.playbackStart : this.state.playbackEnd);
      if (this.state.loop) { void composition.resume(); }
    }
    this.updateAutoKey(document);
  }

  override flushEdits (): void { this.document?.commit(); }

  override onUndoRedo (): void {
    this.canvas.resetInteraction();
    this.autoValues.clear(); this.lastRevision = -1; this.lastAutoTime = NaN; this.autoRecording = false;
    this.context = undefined; this.renameTrack = undefined; this.restoredSelection = true;
    this.document?.sync();
  }

  override onSelectionChange (): void {
    const document = this.document;

    if (!document || this.syncingSelection || EditorSelection.changeSource === 'history') { return; }
    const objects = EditorSelection.getSelectedObjects().filter((item): item is VFXItem => item instanceof VFXItem);

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
    try { EditorSelection.setObjects(items, 'sync'); } finally { this.syncingSelection = false; }
  }

  override draw (): void {
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
    ImGui.PushStyleColor(ImGui.Col.WindowBg, C.background);
    if (sceneWorkspace.current) { sceneWorkspace.current.observeEditor('Select timeline elements', () => super.draw()); } else { super.draw(); }
    ImGui.PopStyleColor(); ImGui.PopStyleVar();
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

    if (ImGui.IsWindowHovered() && (ImGui.IsMouseClicked(ImGui.MouseButton.Left) || ImGui.IsMouseClicked(ImGui.MouseButton.Right))) {
      sceneWorkspace.flushEdits(); sceneWorkspace.current?.commit(true);
    }
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
    ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(3, 3));
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(6, 3));
    ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(12, 6));
    const colors: [ImGui.Col, ImGui.Vec4][] = [
      [ImGui.Col.Text, C.text], [ImGui.Col.TextDisabled, C.muted], [ImGui.Col.Border, C.inputBorder],
      [ImGui.Col.FrameBg, C.input], [ImGui.Col.FrameBgHovered, C.input], [ImGui.Col.FrameBgActive, C.input],
      [ImGui.Col.ButtonHovered, C.hover], [ImGui.Col.ButtonActive, C.inputBorder],
      [ImGui.Col.Header, C.selection], [ImGui.Col.HeaderHovered, InteractionColors.panel], [ImGui.Col.HeaderActive, C.selection],
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
    this.drawPositionError();
    this.drawRenamePopup(document);
    this.handleShortcuts(document);
    this.acceptsClipboard = ImGui.IsWindowFocused(ImGui.FocusedFlags.RootAndChildWindows) && !ImGui.GetIO().WantTextInput &&
      !ImGui.IsPopupOpen('', ImGui.PopupFlags.AnyPopup);
    ImGui.PopStyleColor(colors.length); ImGui.PopStyleVar(4);
  }

  private drawToolbar (document: SequencerDocument): void {
    const origin = ImGui.GetCursorScreenPos();
    const hasSelection = document.selectedKeys.size + document.selectedSections.size + document.selectedTracks.size > 0;

    this.bar(origin, L.toolbarHeight);
    ImGui.SetCursorScreenPos(new ImGui.Vec2(origin.x + L.toolbarPadding, origin.y + L.toolbarPadding));
    if (this.icon('actions', 'Actions', false, true, L.toolbarMenuWidth, true)) { this.openBelow('##SequenceActions'); }
    if (beginEditorPopup('##SequenceActions')) {
      this.section('Editing');
      if (sceneWorkspace.current?.composition === document.composition) {
        commandMenuItem('document.undo', { label: 'Undo' });
        commandMenuItem('document.redo', { label: 'Redo', shortcut: 'Ctrl+Y' });
      } else {
        if (editorMenuItem('Undo', 'Ctrl+Z', false, document.canUndo)) { document.undo(); }
        if (editorMenuItem('Redo', 'Ctrl+Y', false, document.canRedo)) { document.redo(); }
      }
      ImGui.Separator();
      if (editorMenuItem('Cut', 'Ctrl+X', false, hasSelection)) { document.copySelection(); document.deleteSelection(); }
      if (editorMenuItem('Copy', 'Ctrl+C', false, hasSelection)) { document.copySelection(); }
      if (editorMenuItem('Paste', 'Ctrl+V', false, document.hasClipboard)) { document.paste(); }
      if (editorMenuItem('Duplicate', this.state.curveMode ? '' : 'Ctrl+D', false, hasSelection)) { document.duplicateSelection(); }
      if (editorMenuItem('Delete', 'Delete', false, hasSelection)) { document.deleteSelection(); }
      ImGui.Separator(); this.section('Sequence');
      if (editorMenuItem('Export Timeline...')) { this.exportTimeline(document); }
      endEditorPopup();
    }
    ImGui.SameLine();
    if (this.icon('view', 'View Options', false, true, L.toolbarMenuWidth, true)) { this.openBelow('##SequenceView'); }
    if (beginEditorPopup('##SequenceView')) {
      this.section('Framing');
      if (editorMenuItem('Frame Selection', 'F')) { this.state.fit(document); }
      if (editorMenuItem('Frame All', 'Home')) { this.state.fit(document, false); }
      if (editorMenuItem('Focus Playhead', 'A')) { this.focusPlayhead(document); }
      ImGui.Separator(); this.section('Tracks');
      if (editorMenuItem('Expand All')) { this.state.expandAll(document, true); }
      if (editorMenuItem('Collapse All')) { this.state.expandAll(document, false); }
      if (editorMenuItem('Selection Details', '', this.state.showDetails)) { this.state.showDetails = !this.state.showDetails; }
      ImGui.Separator(); this.section('Display');
      if (editorMenuItem('Frames', '', this.state.displayFrames)) { this.state.displayFrames = true; }
      if (editorMenuItem('Seconds', '', !this.state.displayFrames)) { this.state.displayFrames = false; }
      if (editorMenuItem('Show Tangents', '', this.state.showTangents)) { this.state.showTangents = !this.state.showTangents; }
      endEditorPopup();
    }
    ImGui.SameLine();
    if (this.icon('play', 'Playback Options', false, true, L.toolbarMenuWidth, true)) { this.openBelow('##SequencePlayback'); }
    if (beginEditorPopup('##SequencePlayback')) {
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
      if (editorMenuItem('Loop Playback', '', this.state.loop)) { this.state.loop = !this.state.loop; }
      if (editorMenuItem('Jump to Start')) { document.setTime(this.state.playbackStart); }
      if (editorMenuItem('Jump to End')) { document.setTime(this.state.playbackEnd); }
      endEditorPopup();
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
    if (beginEditorPopup('##SequenceSnapping')) {
      this.section('Snap To');
      if (editorMenuItem('Frames', '', this.state.snapFrames)) { this.state.snapFrames = !this.state.snapFrames; }
      if (editorMenuItem('Keyframes', '', this.state.snapKeys)) { this.state.snapKeys = !this.state.snapKeys; }
      if (editorMenuItem('Section Edges', '', this.state.snapSections)) { this.state.snapSections = !this.state.snapSections; }
      endEditorPopup();
    }
    ImGui.SameLine();
    if (this.textButton(this.state.frameRate + ' fps', false, true)) { this.openBelow('##SequenceFPS'); }
    if (beginEditorPopup('##SequenceFPS')) {
      this.section('Display Rate');
      [12, 15, 24, 25, 30, 48, 50, 60, 120].forEach(rate => {
        if (editorMenuItem(rate + ' fps', '', this.state.frameRate === rate)) { this.state.frameRate = rate; }
      });
      endEditorPopup();
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
    if (beginEditorPopup('##SequenceAddTrack')) {
      this.section('Add Selected Objects');
      const selected = EditorSelection.getSelectedObjects().filter((object): object is VFXItem => object instanceof VFXItem && object.composition === document.composition);

      if (!selected.length) { ImGui.TextDisabled('Select an object in the scene or hierarchy.'); }
      if (editorMenuItem('Selected Objects with Transform', '', false, selected.length > 0)) {
        document.edit('Add object tracks', () => selected.forEach(item => {
          const binding = document.addBinding(item);

          if (!binding.getChildTracks().some(track => track instanceof TransformTrack)) { document.addTrack(binding, 'transform'); }
          this.state.expanded.add(binding.getInstanceId());
        }));
      }
      ImGui.Separator(); this.section('Scene Objects');
      const items = document.composition.items.filter(item => item !== document.composition.pluginRoot && !item.name?.startsWith('__'));

      for (const item of items) {
        if (editorMenuItem(item.name || 'Object')) {
          document.edit('Add object track', () => {
            const binding = document.addBinding(item);

            document.addTrack(binding, 'transform'); this.state.expanded.add(binding.getInstanceId());
          });
        }
      }
      endEditorPopup();
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

        ImGui.BeginDisabled(first.channel.pathView === 'timing');
        if (ImGui.DragFloat('##KeyValue', next => value = next ?? value, 0.01, -1e8, 1e8, '%.3f')) {
          document.begin('Edit key values');
          const delta = value - first.key.value;

          this.updateKeys(document, keys, item => item.key.value += delta);
        }
        if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
        ImGui.EndDisabled();
        ImGui.SameLine();
        if (this.textButton(this.keyMode(first))) { this.openBelow('##KeyInterpolation'); }
        if (beginEditorPopup('##KeyInterpolation')) { this.drawInterpolation(document); endEditorPopup(); }
        if (this.viewWidth > 800 && first.channel.pathView !== 'point') {
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

    ImGui.BeginDisabled(first?.channel.pathView === 'timing');
    if (ImGui.DragFloat('##CurveKeyValue', next => value = next ?? value, 0.01, -1e8, 1e8, 'Value  %.3f') && first) {
      document.begin('Edit key value');
      const delta = value - first.key.value;

      this.updateKeys(document, keys, item => item.key.value += delta);
    }
    if (ImGui.IsItemDeactivatedAfterEdit()) { document.commit(); }
    ImGui.EndDisabled();
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
        document.edit('Flatten tangents', () => this.updateKeys(document, document.temporalKeys(keys), item => {
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
    if (!beginEditorPopup('##SequencerContext')) { return; }
    const row = this.context?.row;
    const section = this.context?.section ?? document.selectedSectionItems[0];
    const keys = document.selectedKeyItems();
    const positions = Array.from(new Set(section ? [section] : row ? row.channels.map(entry => entry.section) : keys.map(item => item.section)))
      .filter(section => section.position && !document.isLocked(section.track));

    if (positions.length) {
      this.section('Position');
      if (editorMenuItem('Separate Dimensions')) {
        try { document.separateDimensions(positions); this.positionError = ''; } catch (error) {
          this.positionError = error instanceof Error ? error.message : String(error); this.showPositionError = true;
        }
      }
      ImGui.Separator();
    }

    if (keys.length) {
      this.section('Keyframes');
      if (!this.state.curveMode && editorMenuItem('Key Properties...')) { this.state.showDetails = true; }
      if (editorMenuItem('Add Key at Playhead', 'Enter')) { this.addKeys(document); }
      if (beginEditorMenu('Interpolation', keys.some(item => item.channel.kind === 'number'))) {
        this.drawInterpolation(document); endEditorMenu();
      }
      if (editorMenuItem('Flatten Tangents')) {
        document.edit('Flatten tangents', () => this.updateKeys(document, document.temporalKeys(keys), item => {
          item.key.inSlope = item.key.outSlope = 0; item.key.tangentMode = 'user'; item.key.interpolationMode = InterpolationMode.Cubic;
        }));
      }
      ImGui.Separator();
    }
    if (section) {
      ImGui.BeginDisabled(document.isLocked(section.track));
      this.section('Section');
      if (editorMenuItem('Section Properties...')) { this.state.showDetails = true; }
      if (editorMenuItem('Split at Playhead', 'Ctrl+/')) { document.splitSelection(document.currentTime); }
      const inside = document.currentTime > section.clip.start && document.currentTime < section.clip.start + section.clip.duration;

      if (editorMenuItem('Trim Left to Playhead', '', false, inside)) {
        document.edit('Trim section left', () => document.resizeSection(section, document.currentTime, section.clip.start + section.clip.duration));
      }
      if (editorMenuItem('Trim Right to Playhead', '', false, inside)) {
        document.edit('Trim section right', () => document.resizeSection(section, section.clip.start, document.currentTime));
      }
      ImGui.Separator(); this.section('Post Roll');
      for (const [name, behavior] of [['Finish', 0], ['Hold', 4], ['Loop', 5]] as const) {
        if (editorMenuItem(name, '', section.clip.endBehavior === behavior)) {
          document.edit('Set section end behavior', () => { section.clip.endBehavior = behavior; document.write(section); });
        }
      }
      ImGui.EndDisabled();
      ImGui.Separator();
    }
    if (row) {
      this.section('Track');
      if (editorMenuItem('Rename...')) {
        this.renameTrack = row.track; this.renameValue = document.trackLabel(row.track); this.renameRequested = true;
      }
      if (editorMenuItem('Mute Track', '', document.muted.has(row.track.getInstanceId()))) { document.toggleMute(row.track); }
      const ownLock = document.locked.has(row.track.getInstanceId());

      if (editorMenuItem('Lock Track', '', ownLock)) {
        document.edit('Toggle track lock', () => {
          if (ownLock) { document.locked.delete(row.track.getInstanceId()); } else { document.locked.add(row.track.getInstanceId()); }
        }, false);
      }
      if (editorMenuItem('Add Section', '', false, row.kind !== 'object' && !document.isLocked(row.track))) {
        document.edit('Add section', () => { document.createSection(row.track); });
      }
      const parent = this.bindingParent(row.track);

      if (parent && beginEditorMenu('Add Property Track', !document.isLocked(parent))) {
        for (const [name, kind] of [['Transform', 'transform'], ['Activation', 'activation'], ['Opacity', 'opacity']] as const) {
          if (editorMenuItem(name)) { document.edit('Add property track', () => { document.addTrack(parent, kind); this.state.expanded.add(parent.getInstanceId()); }); }
        }
        endEditorMenu();
      }
      ImGui.Separator();
    }
    this.section('Edit');
    if (editorMenuItem('Copy', 'Ctrl+C')) { document.copySelection(); }
    if (editorMenuItem('Paste', 'Ctrl+V', false, document.hasClipboard)) { document.paste(this.context?.time ?? document.currentTime); }
    if (editorMenuItem('Duplicate', this.state.curveMode ? '' : 'Ctrl+D')) { document.duplicateSelection(); }
    if (editorMenuItem('Delete', 'Delete')) { document.deleteSelection(); }
    endEditorPopup();
  }

  private drawRenamePopup (document: SequencerDocument): void {
    if (this.renameRequested) { ImGui.OpenPopup('##RenameTrack'); this.renameRequested = false; }
    if (beginEditorPopup('##RenameTrack')) {
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
      endEditorPopup();
    }
  }

  private drawPositionError (): void {
    if (this.showPositionError) { ImGui.OpenPopup('##PositionSeparationError'); this.showPositionError = false; }
    if (beginEditorPopup('##PositionSeparationError')) {
      ImGui.Text('Separate Dimensions'); ImGui.TextWrapped(this.positionError);
      if (ImGui.Button('Close')) { ImGui.CloseCurrentPopup(); }
      endEditorPopup();
    }
  }

  private drawInterpolation (document: SequencerDocument): void {
    for (const mode of ['Auto', 'User', 'Break', 'Linear', 'Constant'] as Interpolation[]) {
      const first = document.selectedKeyItems()[0];

      if (editorMenuItem(mode, '', !!first && this.keyMode(first) === mode, !!first)) { this.setInterpolation(document, mode); }
    }
  }

  private setInterpolation (document: SequencerDocument, mode: Interpolation): void {
    document.edit('Set key interpolation', () => {
      this.updateKeys(document, document.temporalKeys(document.selectedKeyItems()), item => {
        if (item.channel.kind !== 'number') { return; }
        item.key.interpolationMode = mode === 'Linear' ? InterpolationMode.Linear : mode === 'Constant' ? InterpolationMode.Constant : InterpolationMode.Cubic;
        item.key.tangentMode = mode === 'Auto' ? 'auto' : mode === 'Break' ? 'break' : 'user';
      });
    });
  }

  private keyMode (item: KeySelection): Interpolation {
    if (item.channel.pathView === 'point') {
      const key = item.section.position?.keys.find(key => key.id === item.key.pathKeyId)?.timing;

      if (key) { item = { ...item, key }; }
    }
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
    } else if (command && pressed(ImGui.Key.D)) {
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
    const selected = EditorSelection.getSelectedObjects().filter((object): object is VFXItem =>
      object instanceof VFXItem && object.composition === document.composition);
    const selectedIds = new Set(selected.map(object => object.getInstanceId()));
    const transforms = selected.map(object => ({ object, values: [
      ...object.transform.position.toArray(), ...getEditorRotation(object.transform).toArray(), ...object.transform.scale.toArray(),
    ] }));
    let recorded = false;

    for (const id of this.autoValues.keys()) { if (!selectedIds.has(id)) { this.autoValues.delete(id); } }
    for (const { object, values } of transforms) {
      const previous = this.autoValues.get(object.getInstanceId());

      this.autoValues.set(object.getInstanceId(), values);
      if (!shouldRecord || !previous) { continue; }
      const changed = values.map((value, index) => Math.abs(value - previous[index]) > 1e-6);

      if (!changed.some(Boolean)) { continue; }
      const sections = document.allSections().filter(section => section.clip instanceof TransformPlayableAsset && document.boundItem(section.track) === object &&
        !document.isLocked(section.track) && !document.isMuted(section.track) && document.currentTime >= section.clip.start && document.currentTime <= section.clip.start + section.clip.duration &&
        section.channels.some(channel => changed[transformChannelIndex(channel)]));

      if (!sections.length) { continue; }
      document.begin('Auto key transforms'); this.autoRecording = true;
      sections.forEach(section => {
        section.channels.forEach(channel => {
          const index = transformChannelIndex(channel);

          if (changed[index]) {
            document.insertKey(section, channel, document.currentTime, values[index]);
          }
        });
      });
      recorded = true;
    }
    if (recorded) {
      // Evaluate only after every selected item's keys have been written.
      document.changed();
      this.lastRevision = document.revision;
    }
    if (this.autoRecording && (!this.autoKey || !ImGui.IsMouseDown(ImGui.MouseButton.Left) && !ImGui.IsAnyItemActive())) {
      document.commit(); this.autoRecording = false;
    }
  }

  private exportTimeline (document: SequencerDocument): void {
    downloadBlob(new Blob([JSON.stringify(document.exportData(), null, 2)], { type: 'application/json' }), (document.composition.name || 'sequence') + '-timeline.json');
  }

  private openBelow (id: string): void {
    const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax();

    ImGui.OpenPopup(id);
    ImGui.SetNextWindowPos(new ImGui.Vec2(min.x, max.y + 3));
  }

  private section (label: string): void { editorMenuSection(label); }
  private textButton (label: string, active = false, menu = false): boolean {
    return toolbarButton(menu ? '##SequenceText' + label : label, { label, checked: active,
      width: ImGui.CalcTextSize(label).x + (menu ? 28 : 12), height: L.toolbarButtonHeight,
      dropdown: menu, labelLeft: 6, checkedTint: C.active });
  }
  private divider (): void { toolbarSeparator(L.toolbarButtonHeight); }
  private bar (origin: ImGui.Vec2, height: number): void {
    const dl = ImGui.GetWindowDrawList();

    dl.AddRectFilled(origin, new ImGui.Vec2(origin.x + this.viewWidth, origin.y + height), ImGui.GetColorU32(C.toolbar));
    dl.AddLine(new ImGui.Vec2(origin.x, origin.y), new ImGui.Vec2(origin.x + this.viewWidth, origin.y), ImGui.GetColorU32(C.line));
  }

  private icon (icon: SequenceIcon, hint: string, active = false, enabled = true, width: number = L.toolbarButtonSize, menu = false, height: number = L.toolbarButtonHeight): boolean {
    return toolbarButton('##Sequence' + icon + hint, { width, height, checked: active, enabled, hint,
      appearance: icon === 'loop' ? 'plain' : 'toggle', dropdown: menu,
      iconSize: icon === 'chevron' ? 16 : L.toolbarIconSize, iconLeft: menu ? 6 : undefined,
      drawIcon: (x, y, size, tint) => drawSequenceIcon(icon, x, y, size, tint), checkedTint: C.active });
  }
}
