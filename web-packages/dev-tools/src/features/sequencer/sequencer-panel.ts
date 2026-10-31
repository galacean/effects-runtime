import { EditorSearchField } from '../../ui/controls/search-field';
import { setTooltip } from '../../ui/controls/tooltip';
import type { Engine, TrackAsset, InputEventKey } from '@galacean/effects';
import { CompositionComponent, InterpolationMode, ObjectBindingTrack, TransformPlayableAsset, TransformTrack, VFXItem, spec } from '@galacean/effects';
import type { HBoxContainer, Label, LineEdit } from '@galacean/effects-plugin-gui';
import { Control, SizeFlags, TextOverflow, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { editorPanel, menuItem } from '../../framework/registry/editor-registry';
import { EditorSelection } from '../../framework/selection/editor-selection';
import { EditorWindow } from '../../framework/windows/editor-window';
import { downloadBlob } from '../../platform/browser-files/file-dialog';
import { EditorRuntimeSession } from '../../platform/effects-runtime/editor-runtime-session';
import { append, column, row, expand, margin, label, disposeChildren } from '../../ui/controls/layout';
import { EditorMenu, EditorMenuButton } from '../../ui/controls/menu';
import type { MenuAction } from '../../ui/controls/menu';
import { EditorDialog } from '../../ui/controls/dialog';
import { NumberEdit } from '../../ui/controls/number-edit';
import { EditorToolbar, EditorToggleButton } from '../../ui/controls/toolbar';
import { EditorTextField } from '../../ui/controls/text-field';
import { EditorPositiveActionButton } from '../../ui/controls/positive-action-button';
import { EditorIconButton, EditorIconControl } from '../../ui/icons/control-icons';
import type { EditorIcon } from '../../ui/icons/control-icons';
import { commandMenuItem } from '../../ui/menus/command-menu-item';
import { PropertySheet } from '../../ui/property-editor/property-sheet';
import { EDITOR_FONT } from '../../ui/theme/control-theme';
import type { TransformEdit } from '../scene/document/scene-document';
import { sceneWorkspace } from '../scene/scene-workspace';
import { updateAutoTangents } from './curve-data';
import type { SequencerContext } from './sequencer-canvas';
import { SequencerCanvas } from './sequencer-canvas';
import type { KeySelection, SequenceSection } from './sequencer-document';
import { SequencerDocument } from './sequencer-document';
import { SequencerState } from './sequencer-state';
import { findSequenceTimeline } from './sequencer-preview';
type Interpolation = 'Auto' | 'User' | 'Break' | 'Linear' | 'Constant';
const interpolationModes: Interpolation[] = ['Auto', 'User', 'Break', 'Linear', 'Constant'];
const interpolationIcons: Record<Interpolation, EditorIcon> = { Auto: 'tangentAuto', User: 'tangentUser', Break: 'tangentBreak', Linear: 'linear', Constant: 'constant' };

function transformChannelIndex (channel: import('./sequencer-document').SequenceChannel): number {
  return channel.axis < 3 ? channel.group === 'Location' ? channel.axis : channel.group === 'Rotation' ? 3 + channel.axis :
    channel.group === 'Scale' ? 6 + channel.axis : -1 : -1;
}

@editorPanel()
export class SequencerPanel extends EditorWindow {
  private readonly state = new SequencerState();
  private canvas: SequencerCanvas;
  private search: LineEdit;
  private details: HBoxContainer;
  private detailsSignature = '';
  private detailRefresh: (() => void)[] = [];
  private keyTools: Control;
  private keyToolbar: EditorToolbar;
  private interpolationTools: EditorToolbar;
  private footer: EditorToolbar;
  private keyTime: NumberEdit;
  private keyValue: NumberEdit;
  private keyValueGroup: Control;
  private interpolationButtons: EditorToggleButton[] = [];
  private flatten: EditorIconButton;
  private playhead: NumberEdit;
  private playButton: EditorIconButton;
  private caption: Label;
  private fps: EditorMenuButton;
  private contextMenu: EditorMenu;
  private dialog: EditorDialog;
  private document?: SequencerDocument;
  private documents = new Map<CompositionComponent, SequencerDocument>();
  private context?: SequencerContext;
  private autoKey = false;
  private syncingSelection = false;
  private restoredSelection = false;
  private autoRecording = false;
  private pointerHeld = false;
  private readonly pointerDown = (): void => { this.pointerHeld = true; };
  private readonly pointerUp = (): void => { this.pointerHeld = false; };
  private readonly onClipboard = (event: ClipboardEvent): void => {
    if (!this.hasFocus() || !this.document || event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) { return; }
    if (event.type === 'paste') { this.document.paste(); } else { this.document.copySelection(); if (event.type === 'cut') { this.document.deleteSelection(); } }
    event.preventDefault();
  };

  @menuItem('Window/Sequencer')
  static showWindow (): void { EditorWindow.getWindow(SequencerPanel).open(); }
  constructor () { super(); this.title = 'Sequencer'; this.open(); }

  protected override createContent (engine: Engine): Control {
    const body = column(engine);

    window.addEventListener('pointerdown', this.pointerDown, true); window.addEventListener('pointerup', this.pointerUp, true);
    window.addEventListener('pointercancel', this.pointerUp, true); window.addEventListener('blur', this.pointerUp);
    this.contextMenu = new EditorMenu(engine); this.dialog = new EditorDialog(engine);
    const toolbar = new EditorToolbar(engine, 28);

    append(body, margin(engine, toolbar, 6, 6));
    const menu = (name: string, actions: () => MenuAction[], icon?: EditorIcon): EditorMenuButton => {
      const button = append(toolbar, new EditorMenuButton(engine, icon ? '' : name, actions));

      button.iconName = icon; button.iconSize = 20; button.showArrow = true; button.setCustomMinimumSize(icon ? 44 : 0, 28); setTooltip(button, name);

      return button;
    };

    menu('Actions', () => this.editActions(), 'actions');
    menu('View Options', () => this.viewActions(), 'view');
    menu('Playback', () => [
      { label: 'Playback Settings…', action: () => this.playbackSettings() },
      { label: 'Loop Playback', checked: this.state.loop, action: () => { this.state.loop = !this.state.loop; } },
      { label: 'Jump to Start', action: () => this.document?.setTime(this.state.playbackStart) },
      { label: 'Jump to End', action: () => this.document?.setTime(this.state.playbackEnd) },
    ], 'play');
    toolbar.separator();
    this.icon(toolbar, 'key', 'Add Key (Enter)', () => { if (this.document) { this.addKeys(this.document); } });
    this.toggle(toolbar, 'auto', 'Auto Key', () => this.autoKey, () => this.autoKey = !this.autoKey);
    toolbar.separator();
    this.toggle(toolbar, 'snap', 'Snapping', () => this.state.snapping, () => { this.state.snapping = !this.state.snapping; });
    const snapOptions = menu('Snapping Options', () => ([['Frames', 'snapFrames'], ['Keyframes', 'snapKeys'], ['Section Edges', 'snapSections']] as const).map(([label, key]) => ({ label, checked: this.state[key], action: () => { this.state[key] = !this.state[key]; } })));

    snapOptions.text = ''; snapOptions.setCustomMinimumSize(16, 28);
    this.fps = menu('30 fps', () => [12, 15, 24, 25, 30, 48, 50, 60, 120].map(rate => ({ label: rate + ' fps', checked: this.state.frameRate === rate, action: () => { this.state.frameRate = rate; } })));
    toolbar.separator();
    this.toggle(toolbar, 'curve', 'Curve Editor', () => this.state.curveMode, () => {
      this.state.curveMode = !this.state.curveMode;
      if (this.document) { this.state.captureCurveSelection(this.document); this.state.fitValues(this.document); }
    });
    const sequence = new EditorToolbar(engine, 28);

    append(toolbar, expand(margin(engine, sequence, 8, 0), true, false));
    append(sequence, new EditorIconControl(engine, 'folder'));
    this.caption = expand(sequence.label(''), true, false); this.caption.textOverflow = TextOverflow.Ellipsis;
    this.caption.setThemeFontOverride('font', { family: EDITOR_FONT, weight: 'bold', style: 'normal' });
    this.keyTools = append(body, margin(engine, this.createKeyTools(engine), 6, 6)); this.keyTools.visible = false;
    this.canvas = append(body, expand(new SequencerCanvas(engine, this.state, track => this.selectBoundItems(track))));
    this.canvas.contextRequested = (context, position) => { this.context = context; this.contextMenu.setActions(this.contextActions()); this.contextMenu.show(this.canvas, position); };
    this.canvas.shortcut = event => this.handleShortcuts(event);
    const header = append(this.canvas.outlinerHeader, row(engine));

    header.setAnchorMax(1, 1); header.setOffsetMin(6, 5); header.setOffsetMax(-2, -5);
    const add = append(header, new EditorPositiveActionButton(engine, 'Track', () => this.addTrackActions()));

    this.search = append(header, expand(new EditorSearchField(engine), true, false)); this.search.placeholderText = 'Search tracks';
    this.search.on('textChanged', value => { this.state.search = value; });
    this.details = append(body, row(engine)); this.details.visible = false;
    const footer = this.footer = new EditorToolbar(engine, 24);

    append(body, margin(engine, footer, 6, 3));

    this.icon(footer, 'first', 'Jump to Start', () => this.document?.setTime(this.state.playbackStart));
    this.icon(footer, 'previous', 'Previous Key (,)', () => { if (this.document) { this.stepKey(this.document, -1); } });
    this.icon(footer, 'back', 'Previous Frame', () => this.document?.setTime(Math.max(this.state.playbackStart, this.document.currentTime - 1 / this.state.frameRate)));
    this.playButton = this.icon(footer, 'play', 'Play / Pause (Space)', () => { if (this.document) { this.togglePlay(this.document); } });
    this.icon(footer, 'forward', 'Next Frame', () => this.document?.setTime(Math.min(this.state.playbackEnd, this.document.currentTime + 1 / this.state.frameRate)));
    this.icon(footer, 'next', 'Next Key (.)', () => { if (this.document) { this.stepKey(this.document, 1); } });
    this.icon(footer, 'last', 'Jump to End', () => this.document?.setTime(this.state.playbackEnd));
    this.toggle(footer, 'loop', 'Loop Playback', () => this.state.loop, () => { this.state.loop = !this.state.loop; });
    footer.separator();
    footer.label('Time');
    this.playhead = append(footer, new NumberEdit(engine)); this.playhead.setCustomMinimumSize(90, 24);
    this.playhead.changed = value => this.document?.setTime(Math.max(0, value / this.factor));
    append(footer, expand(new Control(engine), true, false));
    append(footer, this.interpolationTools);
    for (const control of footer.children) { if (control instanceof EditorIconButton) { control.setCustomMinimumSize(22, 24); control.iconSize = 16; } }
    for (const control of this.interpolationTools.children) { if (control instanceof EditorIconButton) { control.setCustomMinimumSize(24, 24); control.iconSize = 16; } }

    return body;
  }
  private createKeyTools (engine: Engine): EditorToolbar {
    const toolbar = this.keyToolbar = new EditorToolbar(engine, 28);
    const selection = (): { document: SequencerDocument, keys: KeySelection[] } | undefined => {
      const document = this.document, keys = document?.selectedKeyItems();

      return document && keys?.length ? { document, keys } : undefined;
    };
    const number = (parent: EditorToolbar, caption: string, write: (document: SequencerDocument, keys: KeySelection[], value: number) => void): NumberEdit => {
      parent.label(caption);
      const field = append(parent, new NumberEdit(engine));

      field.setCustomMinimumSize(84, 24); field.verticalSizeFlags = SizeFlags.ShrinkCenter;
      field.beginEdit = () => this.document?.begin('Edit key ' + caption.toLowerCase());
      field.changed = value => {
        const selected = selection();

        if (selected) { write(selected.document, selected.keys, value); }
      };
      field.endEdit = canceled => { if (canceled) { this.document?.cancel(); } else { this.document?.commit(); } };

      return field;
    };

    this.keyTime = number(toolbar, 'Time', (document, keys, value) => this.setKeyTime(document, keys, value / this.factor));
    const values = append(toolbar, new EditorToolbar(engine, 28));

    this.keyValueGroup = values;
    this.keyValue = number(values, 'Value', (document, keys, value) => {
      const delta = value - keys[0].key.value;

      this.updateKeys(document, keys.filter(item => item.channel.kind === 'number' && item.channel.pathView !== 'timing'), item => { item.key.value += delta; });
    }); this.keyValue.step = .01;
    toolbar.separator();
    const interpolation = this.interpolationTools = append(toolbar, new EditorToolbar(engine, 24));

    interpolation.setThemeConstantOverride('separation', 1);
    this.interpolationButtons = interpolationModes.map((mode, index) => {
      const button = append(interpolation, new EditorToggleButton(engine, interpolationIcons[mode], () => {
        const keys = this.document?.selectedKeyItems().filter(item => item.channel.kind === 'number') ?? [];

        return keys.length > 0 && keys.every(item => this.keyMode(item) === mode);
      }, () => { if (this.document) { this.setInterpolation(this.document, mode); } }));

      button.iconSize = 20; button.setCustomMinimumSize(28, 28); setTooltip(button, mode + ' (' + (index + 1) + ')');

      return button;
    });
    interpolation.separator();
    this.flatten = this.icon(interpolation, 'flatten', 'Flatten Tangents', () => { if (this.document) { this.flattenTangents(this.document); } });
    this.icon(interpolation, 'fit', 'Frame Selection (F)', () => { if (this.document) { this.state.fit(this.document); } });

    return toolbar;
  }
  private get factor (): number { return this.state.displayFrames ? this.state.frameRate : 1; }
  private icon (parent: Control, icon: EditorIcon, hint: string, action: () => void): EditorIconButton {
    const button = append(parent, new EditorIconButton(parent.engine, icon));

    button.iconSize = 20; button.setCustomMinimumSize(28, 28);
    setTooltip(button, hint); button.on('pressed', action);

    return button;
  }
  private toggle (parent: Control, icon: EditorIcon, hint: string, read: () => boolean, action: () => void): void {
    const button = append(parent, new EditorToggleButton(parent.engine, icon, read, () => action()));

    button.iconSize = 20; button.setCustomMinimumSize(28, 28); setTooltip(button, hint);
  }
  protected override onEnable (): void {
    for (const command of ['copy', 'cut', 'paste'] as const) { window.document.addEventListener(command, this.onClipboard); }
  }
  protected override onDisable (): void {
    for (const command of ['copy', 'cut', 'paste'] as const) { window.document.removeEventListener(command, this.onClipboard); }
    if (this.document) { this.canvas.cancel(this.document); this.document.commit(); }
  }
  override dispose (): void {
    window.removeEventListener('pointerdown', this.pointerDown, true); window.removeEventListener('pointerup', this.pointerUp, true);
    window.removeEventListener('pointercancel', this.pointerUp, true); window.removeEventListener('blur', this.pointerUp);
    super.dispose(); this.documents.forEach(document => document.dispose()); this.documents.clear(); this.contextMenu.dispose(); this.dialog.dispose();
  }
  private refreshControls (): void {
    const document = this.document;

    this.canvas.document = document;
    if (!document) {
      this.keyTools.visible = this.details.visible = false; this.caption.text = '';
      this.interpolationButtons.forEach(button => button.disabled = true); this.flatten.disabled = true;

      return;
    }
    const keys = document.selectedKeyItems(), first = keys[0], editable = keys.some(item => !document.isLocked(item.section.track));
    const numeric = keys.some(item => item.channel.kind === 'number' && !document.isLocked(item.section.track));

    this.keyTools.visible = this.state.curveMode;
    const toolsParent = this.state.curveMode ? this.keyToolbar : this.footer;

    if (this.interpolationTools.parent !== toolsParent) {
      append(toolsParent, this.interpolationTools);
      for (const control of this.interpolationTools.children) {
        if (control instanceof EditorIconButton) { control.iconSize = this.state.curveMode ? 20 : 16; control.setCustomMinimumSize(this.state.curveMode ? 28 : 24, this.state.curveMode ? 28 : 24); }
      }
    }
    this.keyTime.enabled = editable; this.keyTime.precision = this.state.displayFrames ? 0 : 3; this.keyTime.step = this.factor / this.state.frameRate;
    if (!this.keyTime.isEditing) { this.keyTime.value = first ? (first.section.clip.start + first.key.time * first.section.clip.duration) * this.factor : 0; }
    this.keyValueGroup.visible = !first || first.channel.kind === 'number';
    this.keyValue.enabled = numeric && !!first && first.channel.kind === 'number' && first.channel.pathView !== 'timing';
    if (!this.keyValue.isEditing) { this.keyValue.value = first?.key.value ?? 0; }
    this.interpolationButtons.forEach(button => button.disabled = !numeric); this.flatten.disabled = !numeric;
    this.playButton.iconName = document.composition.getPaused() ? 'play' : 'pause'; this.caption.text = document.composition.name || 'Sequence';
    this.fps.text = this.state.frameRate + ' fps';
    this.playhead.precision = this.state.displayFrames ? 0 : 3; this.playhead.step = this.factor / this.state.frameRate;
    if (!this.playhead.isEditing) { this.playhead.value = document.currentTime * this.factor; }
    this.details.visible = !this.state.curveMode && this.state.showDetails && (keys.length > 0 || document.selectedSectionItems.length > 0);
    const signature = document.component.getInstanceId() + '/' + keys.map(item => item.key.id).join(',') + '/' + document.selectedSectionItems.map(section => section.clip.getInstanceId()).join(',') + '/' + this.factor + '/' + [...document.locked].join(',');

    if (signature !== this.detailsSignature) { this.detailsSignature = signature; this.buildDetails(document); }
    this.detailRefresh.forEach(refresh => refresh());
  }
  private buildDetails (document: SequencerDocument): void {
    disposeChildren(this.details); this.detailRefresh = [];
    const keys = document.selectedKeyItems(), first = keys[0], section = document.selectedSectionItems[0];
    const number = (caption: string, read: () => number, write: (value: number) => void, enabled = true): void => {
      const text = append(this.details, label(this.details.engine, caption));

      text.verticalAlignment = VerticalAlignment.Center;
      const field = append(this.details, new NumberEdit(this.details.engine));

      field.setCustomMinimumSize(84, 24); field.enabled = enabled;
      field.beginEdit = () => document.begin('Edit ' + caption); field.changed = write; field.endEdit = canceled => canceled ? document.cancel() : document.commit();
      this.detailRefresh.push(() => { if (!field.isEditing) { field.value = read(); } });
    };

    if (first) {
      const enabled = keys.some(item => !document.isLocked(item.section.track));

      number('Time', () => (first.section.clip.start + first.key.time * first.section.clip.duration) * this.factor, value => this.setKeyTime(document, keys, value / this.factor), enabled);
      if (first.channel.kind === 'number') {
        number('Value', () => first.key.value, value => {
          const delta = value - first.key.value;

          this.updateKeys(document, keys, item => { item.key.value += delta; });
        }, enabled && first.channel.pathView !== 'timing');
        for (const side of ['inSlope', 'outSlope'] as const) {
          number(side === 'inSlope' ? 'Arrive' : 'Leave', () => first.key[side] / first.section.clip.duration, value => this.updateKeys(document, keys, item => {
            const slope = value * item.section.clip.duration;

            item.key[side] = slope;
            if (item.key.tangentMode !== 'break') { item.key.inSlope = item.key.outSlope = slope; item.key.tangentMode = 'user'; }
          }), enabled && first.channel.pathView !== 'point');
        }
      }
    } else if (section) {
      const enabled = !document.isLocked(section.track);

      number('Start', () => section.clip.start * this.factor, value => { section.clip.start = Math.max(0, value / this.factor); document.write(section); document.changed(); }, enabled);
      number('Duration', () => section.clip.duration * this.factor, value => { section.clip.duration = Math.max(1 / this.state.frameRate, value / this.factor); document.write(section); document.changed(); }, enabled);
    } else { append(this.details, label(this.details.engine, 'Select keys or a section to edit properties.')); }
  }
  private editActions (): MenuAction[] {
    const document = this.document;

    if (!document) { return []; }
    const selected = !!(document.selectedKeys.size + document.selectedSections.size + document.selectedTracks.size);

    return [
      { label: 'Edit', heading: true }, commandMenuItem('document.undo'), commandMenuItem('document.redo'), { label: '', separator: true },
      { label: 'Cut', shortcut: 'Ctrl+X', enabled: selected, action: () => { document.copySelection(); document.deleteSelection(); } },
      { label: 'Copy', shortcut: 'Ctrl+C', enabled: selected, action: () => document.copySelection() },
      { label: 'Paste', shortcut: 'Ctrl+V', enabled: document.hasClipboard, action: () => document.paste(this.context?.time) },
      { label: 'Duplicate', shortcut: 'Ctrl+D', enabled: selected, action: () => document.duplicateSelection() },
      { label: 'Delete', shortcut: 'Delete', enabled: selected, action: () => document.deleteSelection() },
      { label: 'Export Timeline…', action: () => this.exportTimeline(document) },
    ];
  }
  private viewActions (): MenuAction[] {
    const document = this.document;

    if (!document) { return []; }

    return [
      { label: 'Frame Selection', shortcut: 'F', action: () => this.state.fit(document) },
      { label: 'Frame All', shortcut: 'Home', action: () => this.state.fit(document, false) },
      { label: 'Focus Playhead', shortcut: 'A', action: () => this.focusPlayhead(document) },
      { label: 'Expand All', action: () => this.state.expandAll(document, true) }, { label: 'Collapse All', action: () => this.state.expandAll(document, false) },
      { label: 'Selection Details', checked: this.state.showDetails, action: () => { this.state.showDetails = !this.state.showDetails; } },
      { label: 'Frames', checked: this.state.displayFrames, action: () => { this.state.displayFrames = true; } },
      { label: 'Seconds', checked: !this.state.displayFrames, action: () => { this.state.displayFrames = false; } },
      { label: 'Show Tangents', checked: this.state.showTangents, action: () => { this.state.showTangents = !this.state.showTangents; } },
      { label: 'Fit Curve Values', action: () => this.state.fitValues(document) },
    ];
  }
  private addTrackActions (): MenuAction[] {
    const document = this.document;

    if (!document) { return []; }
    const add = (items: VFXItem[]): void => document.edit('Add object tracks', () => items.forEach(item => {
      const binding = document.addBinding(item);

      if (!binding.getChildTracks().some(track => track instanceof TransformTrack)) { document.addTrack(binding, 'transform'); }
      this.state.expanded.add(binding.getInstanceId());
    }));
    const selected = EditorSelection.getSelectedObjects().filter((object): object is VFXItem => object instanceof VFXItem && object.composition === document.composition);

    return [{ label: 'Selected Objects with Transform', enabled: selected.length > 0, action: () => add(selected) }, { label: '', separator: true },
      ...document.composition.items.filter(item => item !== document.composition.pluginRoot && !item.name?.startsWith('__')).map(item => ({ label: item.name || 'Object', action: () => add([item]) }))];
  }
  private playbackSettings (): void {
    this.dialog.show(this.canvas, 'Playback Settings', body => {
      const sheet = append(body, new PropertySheet(body.engine, { change: (_name, _owner, action) => action(), finish: () => {} }));

      sheet.setCustomMinimumSize(420, 140);
      const group = sheet.section('playback', 'Playback Range');

      group.number('Start', { read: () => this.state.playbackStart * this.factor, write: value => { this.state.playbackStart = Math.max(0, Math.min(this.state.playbackEnd - 1 / this.state.frameRate, value / this.factor)); } });
      group.number('End', { read: () => this.state.playbackEnd * this.factor, write: value => { this.state.playbackEnd = Math.max(this.state.playbackStart + 1 / this.state.frameRate, value / this.factor); } });
      group.number('Jump Frames', { read: () => this.state.jumpFrames, write: value => { this.state.jumpFrames = Math.max(1, Math.round(value)); } }, { precision: 0, step: 1 });
      sheet.refresh();
    }, [{ label: 'Close', action: () => this.dialog.close() }], 460);
  }
  private interpolationActions (): MenuAction[] {
    const keys = this.document?.selectedKeyItems().filter(item => item.channel.kind === 'number') ?? [];

    return interpolationModes.map((mode, index) => ({ label: mode, icon: interpolationIcons[mode], shortcut: String(index + 1),
      enabled: keys.some(item => !this.document!.isLocked(item.section.track)), checked: keys.length > 0 && keys.every(item => this.keyMode(item) === mode),
      action: () => { if (this.document) { this.setInterpolation(this.document, mode); } } }));
  }
  private contextActions (): MenuAction[] {
    const document = this.document;

    if (!document) { return []; }
    const row = this.context?.row, section = this.context?.section ?? document.selectedSectionItems[0], keys = document.selectedKeyItems();
    const actions: MenuAction[] = [];
    const positions = [...new Set(section ? [section] : row ? row.channels.map(entry => entry.section) : keys.map(item => item.section))].filter(section => section.position && !document.isLocked(section.track));

    if (positions.length) {
      actions.push({ label: 'Separate Dimensions', action: () => {
        try { document.separateDimensions(positions); } catch (error) { this.dialog.show(this.canvas, 'Separate Dimensions', body => this.dialog.message(body, String(error)), [{ label: 'Close', action: () => this.dialog.close() }]); }
      } });
    }
    if (keys.length) {
      actions.push({ label: 'Keys', heading: true }, { label: 'Key Properties…', action: () => { this.state.showDetails = true; } }, { label: 'Add Key at Playhead', shortcut: 'Enter', action: () => this.addKeys(document) },
        { label: 'Interpolation', children: () => this.interpolationActions() }, { label: 'Flatten Tangents', icon: 'flatten', enabled: keys.some(item => item.channel.kind === 'number' && !document.isLocked(item.section.track)), action: () => this.flattenTangents(document) });
    }
    if (section) {
      const enabled = !document.isLocked(section.track), inside = document.currentTime > section.clip.start && document.currentTime < section.clip.start + section.clip.duration;

      actions.push({ label: 'Sections', heading: true }, { label: 'Section Properties…', action: () => { this.state.showDetails = true; } },
        { label: 'Trimming', heading: true },
        { label: 'Split at Playhead', enabled, action: () => document.splitSelection(document.currentTime) },
        { label: 'Trim Left to Playhead', enabled: enabled && inside, action: () => document.edit('Trim section left', () => document.resizeSection(section, document.currentTime, section.clip.start + section.clip.duration)) },
        { label: 'Trim Right to Playhead', enabled: enabled && inside, action: () => document.edit('Trim section right', () => document.resizeSection(section, section.clip.start, document.currentTime)) },
        { label: 'Post Roll', enabled, children: (['Finish', 'Hold', 'Loop'] as const).map((label, index) => {
          const behavior = [spec.EndBehavior.destroy, spec.EndBehavior.freeze, spec.EndBehavior.restart][index];

          return { label, checked: section.clip.endBehavior === behavior, action: () => document.edit('Set section end behavior', () => { section.clip.endBehavior = behavior; document.write(section); }) };
        }) });
    }
    if (row) {
      const parent = this.bindingParent(row.track), ownLock = document.locked.has(row.track.getInstanceId());

      actions.push({ label: 'Rename…', action: () => this.rename(row.track) }, { label: 'Mute Track', checked: document.isMuted(row.track), action: () => document.toggleMute(row.track) },
        { label: 'Lock Track', checked: ownLock, action: () => document.edit('Toggle track lock', () => { if (ownLock) { document.locked.delete(row.track.getInstanceId()); } else { document.locked.add(row.track.getInstanceId()); } }, false) },
        { label: 'Add Section', enabled: row.kind !== 'object' && !document.isLocked(row.track), action: () => document.edit('Add section', () => { document.createSection(row.track); }) });
      if (parent) { actions.push({ label: 'Add Property Track', enabled: !document.isLocked(parent), children: (['transform', 'activation', 'opacity'] as const).map(kind => ({ label: kind[0].toUpperCase() + kind.slice(1), action: () => document.edit('Add property track', () => { document.addTrack(parent, kind); this.state.expanded.add(parent.getInstanceId()); }) })) }); }
    }

    return [...actions, { label: '', separator: true }, ...this.editActions()];
  }
  private rename (track: TrackAsset): void {
    const document = this.document!; let field: LineEdit;
    const accept = (): void => { if (field.text.trim()) { document.edit('Rename track', () => { track.name = field.text.trim(); }); this.dialog.close(); } };

    this.dialog.show(this.canvas, 'Rename Track', body => { field = append(body, new EditorTextField(body.engine)); field.text = document.trackLabel(track); field.on('textSubmitted', accept); }, [{ label: 'Rename', primary: true, enabled: () => !!field?.text.trim(), action: accept }, { label: 'Cancel', action: () => this.dialog.close() }]);
    field!.grabFocus(); field!.selectAll();
  }
  override update (): void {
    this.canvas.document = undefined;
    const composition = EditorRuntimeSession.player.getCompositions()[0];

    if (sceneWorkspace.current) { sceneWorkspace.current.autoKeyTarget = () => false; sceneWorkspace.current.autoKeyTransforms = undefined; }

    for (const [component, document] of this.documents) {
      if (document.composition !== composition) { document.dispose(); this.documents.delete(component); }
    }

    if (!composition) {
      this.document = undefined; this.refreshControls();

      return;
    }
    let component = composition.sceneRoot.getComponent(CompositionComponent);
    const selected = EditorSelection.getSelectedObjects()[0];

    if (selected instanceof VFXItem) { component = selected.getComponent(CompositionComponent) ?? component; }
    const timeline = component ? findSequenceTimeline(component) : undefined;

    if (!component || !timeline) {
      this.document = undefined; this.refreshControls();

      return;
    }
    if (this.document?.component !== component || this.document.timeline !== timeline) {
      this.document?.commit();

      const cached = this.documents.get(component);

      if (cached && cached.timeline !== timeline) { cached.dispose(); }
      this.document = cached?.timeline === timeline ? cached : new SequencerDocument(composition, component);
      this.documents.set(component, this.document);
      this.state.initialize(this.document); this.search.text = '';
      this.autoRecording = false;
      if (!this.restoredSelection) { this.onSelectionChange(); }
    }
    this.restoredSelection = false;
    const document = this.document;

    if (sceneWorkspace.current) {
      sceneWorkspace.current.autoKeyTarget = item => this.autoKey && document.composition.getPaused() && document.allSections().some(section =>
        section.clip instanceof TransformPlayableAsset && document.boundItem(section.track) === item && !document.isLocked(section.track) && !document.isMuted(section.track) &&
        document.currentTime >= section.clip.start && document.currentTime <= section.clip.start + section.clip.duration);
      sceneWorkspace.current.autoKeyTransforms = edits => this.recordAutoKey(document, edits);
    }

    document.sync();
    if (!composition.getPaused() && document.currentTime >= this.state.playbackEnd) {
      document.setTime(this.state.loop ? this.state.playbackStart : this.state.playbackEnd);
      if (this.state.loop) { void composition.resume(); }
    }
    if (this.autoRecording && (!this.autoKey || !this.pointerHeld && !(window.document.activeElement instanceof HTMLTextAreaElement))) {
      document.commit(); this.autoRecording = false;
    }
    this.refreshControls();
  }

  override flushEdits (): void { this.document?.commit(); }

  override onUndoRedo (): void {
    this.canvas.resetInteraction();
    this.autoRecording = false;
    this.context = undefined; this.restoredSelection = true; this.detailsSignature = '';
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
    EditorSelection.setObjects(items, 'sync'); this.syncingSelection = false;
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

  private flattenTangents (document: SequencerDocument): void {
    document.edit('Flatten tangents', () => this.updateKeys(document, document.temporalKeys(document.selectedKeyItems()).filter(item => item.channel.kind === 'number'), item => {
      item.key.inSlope = item.key.outSlope = 0; item.key.tangentMode = 'user'; item.key.interpolationMode = InterpolationMode.Cubic;
    }));
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

  private handleShortcuts (event: InputEventKey): void {
    const document = this.document;

    if (!document || event.echo) { return; }
    const command = event.ctrlPressed || event.metaPressed;
    const pressed = (key: string): boolean => event.keycode.toLowerCase() === key.toLowerCase();

    event.accept();
    if (command && pressed('c')) { document.copySelection(); } else if (command && pressed('x')) { document.copySelection(); document.deleteSelection(); } else if (command && pressed('v')) { document.paste(); } else if (command && (pressed('z') || pressed('y'))) {
      if (pressed('y') || event.shiftPressed) { document.redo(); } else { document.undo(); }
    } else if (pressed('Escape')) {
      this.canvas.cancel(document); document.clearSelection();
      if (!this.state.curveMode) { this.state.activeChannel = ''; this.state.captureCurveSelection(document); }
    } else if (command && pressed('d')) {
      if (this.state.curveMode) { document.selectedKeys.clear(); } else { document.duplicateSelection(); }
    } else if (command && pressed('a')) {
      const channels = this.state.curveMode ? this.state.curveChannels(document).map(entry => entry.channel) : document.allSections().flatMap(section => section.channels);

      channels.forEach(channel => channel.keys.forEach(key => document.selectedKeys.add(key.id)));
    } else if (!command && pressed('v')) {
      this.state.toggleSelectedExpansion(document, event.shiftPressed);
    } else if (pressed('ArrowDown')) {
      if (document.composition.getPaused()) { this.togglePlay(document); }
    } else if (pressed('k')) {
      document.composition.pause();
    } else if (pressed('ArrowUp')) {
      document.setTime(command ? this.state.playbackEnd : this.state.playbackStart);
    } else if (!command && !event.altPressed && pressed('[')) {
      this.state.playbackStart = Math.min(document.currentTime, this.state.playbackEnd - 1 / this.state.frameRate);
    } else if (!command && !event.altPressed && pressed(']')) {
      this.state.playbackEnd = Math.max(document.currentTime, this.state.playbackStart + 1 / this.state.frameRate);
    } else if (command && pressed('/')) { document.splitSelection(document.currentTime); } else if (pressed('Delete') || pressed('Backspace')) { document.deleteSelection(); } else if (pressed(' ')) { this.togglePlay(document); } else if (pressed('Enter')) { this.addKeys(document); } else if (pressed('f')) { this.state.fit(document); } else if (pressed('Home')) { this.state.fit(document, false); } else if (pressed('a')) { this.focusPlayhead(document); } else if (pressed(',')) { this.stepKey(document, -1); } else if (pressed('.')) { this.stepKey(document, 1); } else if (pressed('ArrowLeft') || pressed('ArrowRight')) {
      const direction = pressed('ArrowLeft') ? -1 : 1;

      if (command && (document.selectedKeys.size || document.selectedSections.size)) {
        document.edit('Nudge selection', () => {
          const keys = document.selectedKeyItems();

          if (keys.length) { this.setKeyTime(document, keys, keys[0].section.clip.start + keys[0].key.time * keys[0].section.clip.duration + direction / this.state.frameRate); } else {
            const sections = document.selectedSectionItems.filter(section => !document.isLocked(section.track));
            const delta = Math.max(-Math.min(...sections.map(section => section.clip.start)), direction / this.state.frameRate);

            sections.forEach(section => { section.clip.start += delta; document.write(section); });
          }
        });
      } else { document.setTime(Math.max(0, document.currentTime + direction * (event.shiftPressed ? this.state.jumpFrames : 1) / this.state.frameRate)); }
    } else {
      const index = ['1', '2', '3', '4', '5'].findIndex(pressed);

      if (index >= 0) { this.setInterpolation(document, ['Auto', 'User', 'Break', 'Linear', 'Constant'][index] as Interpolation); } else { event.clearAccepted(); }
    }
  }

  private recordAutoKey (document: SequencerDocument, edits: TransformEdit[]): boolean {
    if (!this.autoKey || !document.composition.getPaused()) { return false; }
    const initialTransforms = new Map(edits.map(edit => [edit.item, edit.before]));
    let recorded = false;

    for (const { item, before, after } of edits) {
      const changed = after.map((value, index) => Math.abs(value - before[index]) > 1e-6);

      if (!changed.some(Boolean)) { continue; }
      const sections = document.allSections().filter(section => section.clip instanceof TransformPlayableAsset && document.boundItem(section.track) === item &&
        !document.isLocked(section.track) && !document.isMuted(section.track) && document.currentTime >= section.clip.start && document.currentTime <= section.clip.start + section.clip.duration &&
        section.channels.some(channel => changed[transformChannelIndex(channel)]));

      if (!sections.length) { continue; }
      document.begin('Auto key transforms', true, initialTransforms); this.autoRecording = true;
      sections.forEach(section => {
        section.channels.forEach(channel => {
          const index = transformChannelIndex(channel);

          if (changed[index]) {
            document.insertKey(section, channel, document.currentTime, after[index]);
          }
        });
      });
      recorded = true;
    }
    if (recorded) {
      // Evaluate only after every selected item's keys have been written.
      document.changed();
    }

    return recorded;
  }

  private exportTimeline (document: SequencerDocument): void {
    downloadBlob(new Blob([JSON.stringify(document.exportData(), null, 2)], { type: 'application/json' }), (document.composition.name || 'sequence') + '-timeline.json');
  }

}
