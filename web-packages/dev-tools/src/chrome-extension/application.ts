import type { Engine } from '@galacean/effects';
import type { Control, Label } from '@galacean/effects-plugin-gui';
import { PanelContainer, TextOverflow } from '@galacean/effects-plugin-gui';
import { DockModel, validDockSnapshot } from '../framework/layout/dock-model';
import type { DockSnapshot } from '../framework/layout/dock-model';
import type { EditorWindow } from '../framework/windows/editor-window';
import type { RuntimeConnection } from './bridge/runtime-connection';
import { DockWorkspace } from '../ui/controls/dock-workspace';
import { append, column, expand, label, margin } from '../ui/controls/layout';
import { EditorMenuBar, EditorMenuButton } from '../ui/controls/menu';
import { EditorToolbar, EditorToggleButton } from '../ui/controls/toolbar';
import { NumberEdit } from '../ui/controls/number-edit';
import { EditorIconButton } from '../ui/icons/control-icons';
import { editorBox, editorColors } from '../ui/theme/control-theme';
import { setTooltip } from '../ui/controls/tooltip';
import { RuntimeHierarchyPanel } from './panels/runtime-hierarchy-panel';
import { RuntimeInspectorPanel } from './panels/runtime-inspector-panel';
import { ConnectedAssetsPanel } from './panels/runtime-assets-panel';

const LAYOUT_KEY = 'effects-devtools.layout.v1';

function defaultLayout (): DockSnapshot {
  return { root: { kind: 'split', id: 'runtime-root', vertical: true, ratio: .6,
    first: { kind: 'split', id: 'runtime-main', vertical: false, ratio: .45,
      first: { kind: 'tabs', id: 'runtime-hierarchy', tabs: ['Hierarchy'], active: 'Hierarchy' },
      second: { kind: 'tabs', id: 'runtime-inspector', tabs: ['Inspector'], active: 'Inspector' } },
    second: { kind: 'tabs', id: 'runtime-assets', tabs: ['Runtime Assets'], active: 'Runtime Assets' } }, floating: [] };
}

export class RuntimeInspectorApplication {
  private dock!: DockWorkspace;
  private player!: EditorMenuButton;
  private pause!: EditorIconButton;
  private pick!: EditorToggleButton;
  private highlight!: EditorToggleButton;
  private seek!: NumberEdit;
  private status!: Label;
  private playback!: EditorToolbar;
  private windows: EditorWindow[] = [];
  private timer?: number;
  private lastFrame = 0;

  constructor (readonly connection: RuntimeConnection) {}
  initialize (engine: Engine, surface: Control): void {
    const root = append(surface, column(engine));

    root.setAnchorMax(1, 1); root.setOffsetMax(0, 0);
    const menuPanel = append(root, new PanelContainer(engine));

    menuPanel.setThemeStyleBoxOverride('panel', editorBox(editorColors.title));
    const menus = append(menuPanel, new EditorMenuBar(engine));
    const edit = append(menus, new EditorMenuButton(engine, 'Edit')), windows = append(menus, new EditorMenuButton(engine, 'Window'));

    edit.menuBar = windows.menuBar = true;
    edit.actions = () => [{ label: 'History', heading: true },
      { label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z', enabled: this.connection.snapshot.canUndo, action: () => this.connection.command({ type: 'undo' }) },
      { label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Shift+Z', enabled: this.connection.snapshot.canRedo, action: () => this.connection.command({ type: 'redo' }) }];
    windows.actions = () => [...this.windows.map(window => ({ label: window.title, icon: window.tabIcon, checked: window.isOpened(), action: () => { if (window.isOpened()) { window.close(); } else { window.open(); } this.saveLayout(); } })),
      { label: 'Layout', heading: true }, { label: 'Default Layout', action: () => { this.dock.model.snapshot = defaultLayout(); this.windows.forEach(window => window.open()); this.dock.rebuild(); this.saveLayout(); } }];
    const toolbar = append(root, new EditorToolbar(engine));

    this.player = append(toolbar, new EditorMenuButton(engine, 'No Player')); this.player.showArrow = true;
    this.player.setCustomMinimumSize(150, 26); this.player.actions = () => this.connection.snapshot.players.map(player => ({ label: player.name + ' (' + player.canvas + ')', checked: player.id === this.connection.snapshot.playerId, action: () => this.connection.selectPlayer(player.id) }));
    const reconnect = append(toolbar, new EditorIconButton(engine, 'refresh'));

    setTooltip(reconnect, 'Reconnect to the inspected page'); reconnect.on('pressed', () => this.connection.reconnect());
    this.playback = append(toolbar, new EditorToolbar(engine));
    this.pause = append(this.playback, new EditorIconButton(engine, 'play'));
    this.pause.on('pressed', () => this.connection.command({ type: this.connection.snapshot.paused ? 'resume' : 'pause' }));
    const restart = append(this.playback, new EditorIconButton(engine, 'stop'));

    setTooltip(restart, 'Return to start'); restart.on('pressed', () => this.connection.command({ type: 'restart' }));
    this.playback.separator(); this.playback.label('Time');
    this.seek = append(this.playback, new NumberEdit(engine)); this.seek.minimum = 0; this.seek.precision = 3; this.seek.suffix = ' s'; this.seek.setCustomMinimumSize(90, 22);
    this.seek.changed = time => this.connection.command({ type: 'seek', time });
    toolbar.separator();
    this.pick = append(toolbar, new EditorToggleButton(engine, 'object', () => this.connection.snapshot.picking, value => this.connection.command({ type: 'pick', value })));
    this.highlight = append(toolbar, new EditorToggleButton(engine, 'view', () => this.connection.snapshot.highlighting, value => this.connection.command({ type: 'highlight', value })));

    setTooltip(this.pick, 'Pick an object in the inspected page'); setTooltip(this.highlight, 'Highlight the selected object');
    let snapshot = defaultLayout();
    let opened: Record<string, boolean> = {};

    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null');

      if (validDockSnapshot(saved?.dock)) { snapshot = saved.dock; opened = saved.opened ?? {}; }
    } catch (error) { console.warn('Unable to restore the runtime panel layout.', error); }
    this.dock = append(root, expand(new DockWorkspace(engine, new DockModel(snapshot))));
    const hierarchy = new RuntimeHierarchyPanel(this.connection), inspector = new RuntimeInspectorPanel(this.connection), assets = new ConnectedAssetsPanel(this.connection);

    this.windows = [hierarchy, inspector, assets];
    this.windows.forEach(window => { if (opened[window.layoutId] === false) { window.close(); } window.mount(engine, this.dock); });
    this.dock.rebuild(); this.dock.layoutChanged = () => { window.clearTimeout(this.timer); this.timer = window.setTimeout(() => this.saveLayout(), 250); };
    this.status = label(engine, 'Connecting to the inspected page…'); append(root, margin(engine, this.status, 10, 4));
    this.status.textOverflow = TextOverflow.Ellipsis;
    this.connection.changed = () => { hierarchy.refresh(); inspector.refresh(); assets.refresh(); this.refresh(); };
    window.addEventListener('keydown', this.key);
    this.refresh();
  }
  tick (time: number): number {
    const delta = this.lastFrame ? (time - this.lastFrame) / 1000 : 0;

    this.lastFrame = time;
    this.connection.update(time);

    return delta;
  }
  private refresh (): void {
    const snapshot = this.connection.snapshot, player = snapshot.players.find(player => player.id === snapshot.playerId);

    this.player.text = player?.name ?? 'No Player'; this.player.enabled = snapshot.players.length > 0;
    this.playback.enabled = this.pick.enabled = this.highlight.enabled = !!player;
    this.pause.iconName = snapshot.paused ? 'play' : 'pause'; setTooltip(this.pause, snapshot.paused ? 'Resume' : 'Pause');
    if (!this.seek.isEditing) { this.seek.value = snapshot.time; }
    this.status.text = this.connection.error || (!snapshot.registered ? 'Runtime not detected. Expose window.ge.getActivePlayers in the inspected page.' : !player ? 'Waiting for a Player…' : player.width + ' × ' + player.height + ' · ' + snapshot.nodes.filter(node => !node.parent).length + ' scenes · ' + snapshot.assets.length + ' runtime assets');
    this.status.setThemeColorOverride('fontColor', this.connection.error ? editorColors.error : editorColors.foreground);
    setTooltip(this.status, () => this.status.text);
  }
  private readonly key = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) { return; }
    this.connection.finishEdits(); this.connection.command({ type: event.shiftKey ? 'redo' : 'undo' }); event.preventDefault();
  };
  private saveLayout (): void {
    window.clearTimeout(this.timer);
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ dock: this.dock.model.snapshot, opened: Object.fromEntries(this.windows.map(window => [window.layoutId, window.isOpened()])) }));
  }
  dispose (): void {
    this.saveLayout(); window.removeEventListener('keydown', this.key); this.connection.changed = undefined;
    this.connection.dispose(); this.windows.forEach(window => window.dispose());
  }
}
