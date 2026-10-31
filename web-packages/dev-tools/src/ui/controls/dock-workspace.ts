import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion, InputEventKey } from '@galacean/effects';
import type { Button } from '@galacean/effects-plugin-gui';
import { ButtonDrawMode, Container, Control, FocusMode, MouseFilter } from '@galacean/effects-plugin-gui';
import type { DockBounds, DockEdge, DockNode, FloatingDock } from '../../framework/layout/dock-model';
import type { DockModel } from '../../framework/layout/dock-model';
import { editorBox, editorColors, editorMetrics } from '../theme/control-theme';
import { append, place, screenPosition } from './layout';
import { EditorSplitContainer } from './split-container';
import { EditorMenu, EditorMenuButton } from './menu';
import { EditorIconButton, paintIcon } from '../icons/control-icons';
import { EditorWindowTitleBar } from './window-title-bar';
import type { EditorIcon } from '../icons/control-icons';
import { setTooltip } from './tooltip';
import { EditorPanelTab } from './panel-tab';

export interface DockPanel {
  id: string,
  title: string,
  icon?: EditorIcon,
  content: Control,
  opened: boolean,
  initialSize?: math.Vector2,
  dockingRole?: 'panel' | 'document',
  close: () => void,
  visibilityChanged?: (visible: boolean) => void,
}

class DockTab extends EditorPanelTab {
  private origin?: math.Vector2;
  private dragging = false;
  private middlePressed = false;
  private foreground?: math.Color;
  setForeground (color: math.Color): void { if (this.foreground !== color) { this.foreground = color; this.setThemeColorOverride('fontColor', color); } }
  constructor (engine: Engine, readonly panel: DockPanel, private readonly workspace: DockWorkspace, documentTab: boolean) {
    super(engine, panel.title, panel.icon, documentTab);
    this.on('pressed', () => workspace.activatePanel(panel.id));
    setTooltip(this, panel.title);
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Middle) {
      this.middlePressed = true; event.accept();

      return;
    }
    if (event.buttonIndex === MouseButton.Right) {
      this.workspace.showTabContext(this.panel.id, event.globalPosition); event.accept();

      return;
    }
    super.onMouseDown(event);
    if (event.buttonIndex === MouseButton.Left) { this.workspace.activatePanel(this.panel.id); this.origin = event.globalPosition.clone(); this.dragging = false; this.workspace.grabPanel(this.panel.id, event.globalPosition); }
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    super.onMouseMove(event);
    if (!this.origin) { return; }
    this.dragging ||= Math.hypot(event.globalPosition.x - this.origin.x, event.globalPosition.y - this.origin.y) > 6;
    if (this.dragging) { this.workspace.dragPanel(this.panel.id, event.globalPosition, event.ctrlPressed || event.metaPressed); event.accept(); }
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Middle) {
      if (this.middlePressed && !event.canceled && this.hasPoint(event.position)) { this.panel.close(); }
      this.middlePressed = false; event.accept();

      return;
    }
    if (event.buttonIndex !== MouseButton.Left) { return; }
    const dragging = this.dragging;

    super.onMouseUp(event); this.origin = undefined;
    if (dragging) { this.workspace.dropPanel(event.canceled); event.accept(); }
    this.workspace.releasePanel();
    this.dragging = false;
  }
}

class DockCloseButton extends EditorIconButton {
  constructor (engine: Engine) {
    super(engine, 'close'); this.themeTypeVariation = 'EditorDockClose'; this.setCustomMaximumSize(16, 18);
  }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    paintIcon(this, 'close', 0, (this.height - 16) / 2, 16, mode === ButtonDrawMode.Hover || mode === ButtonDrawMode.HoverPressed ? editorColors.foregroundHover : editorColors.foreground);
  }
}

class DockGroupControl extends Container {
  private readonly tabs: { panel: DockPanel, tab: DockTab, close: Button }[] = [];
  private readonly tabMenu: EditorMenuButton;
  private readonly tabBar: Container;
  private tabScroll = 0;
  private totalTabsWidth = 0;
  private revealActive = true;
  private previousActive = '';
  private readonly unhide: EditorIconButton;
  private readonly documentTabs: boolean;
  get headerHeight (): number { return this.model.hidden && this.tabs.length === 1 ? 0 : this.documentTabs ? 32 : editorMetrics.tabHeight; }
  private readonly foreground = editorBox(editorColors.panel, 0, 4);
  private readonly panelBackground = editorBox(editorColors.panel, 0, 4);
  private readonly hovered = editorBox(new math.Color(editorColors.panel.r, editorColors.panel.g, editorColors.panel.b, .8), 0, 4);
  constructor (engine: Engine, readonly model: Extract<DockNode, { kind: 'tabs' }>, panels: DockPanel[], private readonly workspace: DockWorkspace) {
    super(engine); this.mouseFilter = MouseFilter.Pass; this.clipContents = true;
    this.documentTabs = panels.every(panel => panel.dockingRole === 'document');
    this.tabBar = append(this, new Container(engine)); this.tabBar.clipContents = true; this.tabBar.mouseFilter = MouseFilter.Pass;
    this.tabMenu = append(this, new EditorMenuButton(engine, '', () => panels.map(panel => ({ label: panel.title, checked: panel.id === model.active, action: () => workspace.activatePanel(panel.id) }))));
    this.tabMenu.iconName = 'caretDown'; this.tabMenu.iconSize = 12;
    setTooltip(this.tabMenu, 'Available Tabs');
    for (const panel of panels) {
      const tab = append(this.tabBar, new DockTab(engine, panel, workspace, this.documentTabs));
      const close = append(this.tabBar, new DockCloseButton(engine));

      setTooltip(close, 'Close Tab (Ctrl+W)');
      close.on('pressed', panel.close);
      this.tabs.push({ panel, tab, close });
      append(this, panel.content);
      const active = panel.id === model.active;

      panel.content.visible = panel.content.enabled = active; panel.visibilityChanged?.(active);
    }
    this.foreground.setCornerRadii(4, 4, 0, 0); this.hovered.setCornerRadii(4, 4, 0, 0);
    this.unhide = append(this, new EditorIconButton(engine, 'caretDown')); this.unhide.iconSize = 8; this.unhide.iconTint = editorColors.primary; this.unhide.setCustomMaximumSize(12, 12);
    this.unhide.on('pressed', () => workspace.setTabsHidden(model.active, false)); setTooltip(this.unhide, 'Show Tab');
  }
  tabBefore (position: math.Vector2, source: string): string | undefined {
    const point = this.tabBar.makePositionLocal(position);

    if (point.y > this.headerHeight) { return; }

    return this.tabs.find(({ panel, tab }) => panel.id !== source && point.x < tab.x + tab.width / 2)?.panel.id;
  }
  hasOnlyPanel (id: string): boolean { return this.tabs.length === 1 && this.tabs[0].panel.id === id; }
  canDock (panel: DockPanel): boolean { return this.tabs.every(entry => (entry.panel.dockingRole ?? 'panel') === (panel.dockingRole ?? 'panel')); }
  focusTab (id: string): void { this.tabs.find(entry => entry.panel.id === id)?.tab.grabFocus(); }
  revealTab (id: string): void { if (id === this.model.active) { this.revealActive = true; this.queueSort(); } }
  refresh (): void {
    if (this.previousActive !== this.model.active) { this.previousActive = this.model.active; this.revealActive = true; }
    for (const { panel, tab } of this.tabs) {
      const active = panel.id === this.model.active;

      if (panel.content.visible !== active) { panel.content.visible = panel.content.enabled = active; panel.visibilityChanged?.(active); }
      tab.text = panel.title; tab.iconName = panel.icon;
    }
    this.queueSort();
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(); }
  override update (delta: number): void {
    const mouse = this.root?.getMousePosition(), local = mouse && this.tabBar.makePositionLocal(mouse);

    for (const { panel, tab, close } of this.tabs) {
      const hovered = !!local && local.y >= 0 && local.y < this.headerHeight && local.x >= 0 && local.x < this.tabBar.width && local.x >= tab.x && local.x < tab.x + tab.width + 26;

      close.visible = panel.id === this.model.active || hovered;
      tab.setForeground(panel.id === this.workspace.activePanelId || hovered ? editorColors.foregroundHover : editorColors.foreground);
    }
    super.update(delta);
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    if (event.position.y >= this.headerHeight || this.totalTabsWidth <= this.tabBar.width) { return; }
    this.tabScroll = Math.max(0, Math.min(this.totalTabsWidth - this.tabBar.width, this.tabScroll + (event.buttonIndex === MouseButton.WheelDown ? 1 : -1) * event.factor * 60)); this.queueSort(); event.accept();
  }
  override draw (): void {
    this.drawStyleBox(this.panelBackground, 0, 0, this.width, this.height);
    if (!this.headerHeight) { return; }
    this.fillRect(0, 0, this.width, this.headerHeight, editorColors.title);
    const graphics = this.engine.renderingServer.graphics;
    const mouse = this.root?.getMousePosition(), local = mouse && this.tabBar.makePositionLocal(mouse);

    graphics.pushClipRect(this.tabBar.x, 0, this.tabBar.width, this.headerHeight);
    for (const { panel, tab } of this.tabs) {
      const width = tab.width + 26, hovered = local && local.y >= 0 && local.y < this.headerHeight && local.x >= tab.x && local.x < tab.x + width;

      if (panel.id === this.model.active || hovered) { this.drawStyleBox(panel.id === this.model.active ? this.foreground : this.hovered, this.tabBar.x + tab.x, 0, width, this.headerHeight); }
      if (panel.id === this.workspace.activePanelId) {
        for (let x = 0; x < width; x += 2) {
          const c = editorColors.primary;

          this.fillRect(this.tabBar.x + tab.x + x, 0, Math.min(2, width - x), 1, new math.Color(c.r, c.g, c.b, 1 - Math.abs(2 * (x + 1) / width - 1)));
        }
      }
    }
    graphics.popClipRect();
  }
  protected override sortChildren (): void {
    const header = this.headerHeight, overflow = this.tabs.length * 42 > this.width - 8;

    this.tabBar.visible = !!header; this.tabMenu.visible = !!header && overflow; this.unhide.visible = !header;
    place(this.unhide, 0, 0, 12, 12);
    place(this.tabMenu, this.width - 22, 2, 20, 20); place(this.tabBar, 0, 0, this.width - (overflow ? 24 : 0), header);
    const tabWidth = Math.max(40, Math.min(this.documentTabs ? 210 : 160, (this.tabBar.width - Math.max(0, this.tabs.length - 1) * 2) / Math.max(1, this.tabs.length)));
    const widths = this.tabs.map(() => tabWidth);

    this.totalTabsWidth = widths.reduce((total, width) => total + width + 2, 0);
    if (this.revealActive) {
      const index = this.tabs.findIndex(entry => entry.panel.id === this.model.active), left = widths.slice(0, index).reduce((total, width) => total + width + 2, 0), right = left + (widths[index] ?? 0);

      if (left < this.tabScroll) { this.tabScroll = left; } else if (right > this.tabScroll + this.tabBar.width) { this.tabScroll = right - this.tabBar.width; }
      this.revealActive = false;
    }
    this.tabScroll = Math.max(0, Math.min(Math.max(0, this.totalTabsWidth - this.tabBar.width), this.tabScroll));
    let x = -this.tabScroll;

    for (const [index, { panel, tab, close }] of this.tabs.entries()) {
      const width = widths[index];

      place(tab, x, 0, width - 26, header); place(close, x + width - 26, (header - 18) / 2, 16, 18);
      place(panel.content, 2, header + 2, this.width - 4, this.height - header - 4); x += width + 2;
    }
  }
}

class FloatingResizeHandle extends Control {
  private resize?: { pointer: math.Vector2, bounds: DockBounds };
  constructor (engine: Engine, private readonly frame: FloatingPanel, readonly horizontal: number, readonly vertical: number) {
    super(engine); this.focusMode = FocusMode.Click; this.mouseFilter = MouseFilter.Stop;
    this.defaultCursorShape = !horizontal ? 'ns-resize' : !vertical ? 'ew-resize' : horizontal === vertical ? 'nwse-resize' : 'nesw-resize';
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    this.frame.activate(); this.grabFocus();
    this.resize = { pointer: this.frame.parent!.makePositionLocal(event.globalPosition), bounds: { ...this.frame.bounds } }; event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.resize) { return; }
    const point = this.frame.parent!.makePositionLocal(event.globalPosition), start = this.resize.bounds;
    const dx = point.x - this.resize.pointer.x, dy = point.y - this.resize.pointer.y;
    const left = this.horizontal < 0 ? Math.min(start.x + start.width - 180, start.x + dx) : start.x;
    const top = this.vertical < 0 ? Math.max(0, Math.min(start.y + start.height - 100, start.y + dy)) : start.y;
    const right = this.horizontal > 0 ? Math.max(left + 180, start.x + start.width + dx) : start.x + start.width;
    const bottom = this.vertical > 0 ? Math.max(top + 100, start.y + start.height + dy) : start.y + start.height;

    Object.assign(this.frame.bounds, { x: left, y: top, width: right - left, height: bottom - top });
    this.frame.applyFrameBounds(); event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.resize) { this.finishResize(event.canceled); event.accept(); }
  }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape' && this.resize) { this.finishResize(true); event.accept(); }
  }
  private finishResize (canceled = false): void {
    const resize = this.resize;

    this.resize = undefined;
    if (canceled && resize) { Object.assign(this.frame.bounds, resize.bounds); this.frame.applyFrameBounds(); }
    this.frame.changed(); this.root?.updateMouseCursorState();
  }
}

const floatingTitleHeight = editorMetrics.windowTitleHeight;

class FloatingTitleBar extends EditorWindowTitleBar {
  constructor (engine: Engine, private readonly frame: FloatingPanel) {
    super(engine, frame, () => frame.close()); setTooltip(this, 'Move Window'); this.refresh();
  }
  refresh (): void { this.caption.text = this.frame.activePanel?.title ?? 'Editor'; this.icon = this.frame.activePanel?.icon; this.queueSort(); }
  protected override activateWindow (): void { this.frame.activate(); }
  protected override moveWindow (x: number, y: number): void { this.frame.moveTo(x, y); }
  protected override movedWindow (): void { this.frame.changed(); }
}

class FloatingPanel extends Container {
  private readonly resizeHandles: FloatingResizeHandle[] = [];
  private readonly titleBar: FloatingTitleBar;
  readonly bounds: DockBounds;
  constructor (engine: Engine, readonly entry: FloatingDock, private readonly body: Control, private readonly workspace: DockWorkspace) {
    super(engine); this.bounds = entry.bounds; append(this, body);
    this.titleBar = append(this, new FloatingTitleBar(engine, this));
    for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      this.resizeHandles.push(append(this, new FloatingResizeHandle(engine, this, x, y)));
    }
    this.applyFrameBounds();
  }
  private get openPanels (): DockPanel[] { return [...this.workspace.panels.values()].filter(panel => panel.opened && this.contains(panel.id)); }
  get activePanel (): DockPanel | undefined {
    const active = this.workspace.activePanelId;

    return active && this.contains(active) ? this.workspace.panels.get(active) : this.openPanels.find(panel => this.workspace.model.groupFor(panel.id)?.active === panel.id) ?? this.openPanels[0];
  }
  contains (id: string): boolean { return this.workspace.model.floatingFor(id) === this.entry; }
  applyFrameBounds (): void { place(this, this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height); this.queueSort(); }
  refreshTitle (): void { this.titleBar.refresh(); this.queueSort(); }
  activate (): void {
    const panel = this.activePanel;

    if (panel) { this.workspace.activatePanel(panel.id); }
  }
  close (): void { this.openPanels.forEach(panel => panel.close()); }
  moveTo (x: number, y: number): void {
    this.bounds.x = Math.max(40 - this.width, Math.min(this.workspace.width - 40, x));
    this.bounds.y = Math.max(0, Math.min(this.workspace.height - floatingTitleHeight, y)); this.applyFrameBounds();
  }
  changed (): void { this.workspace.layoutChanged?.(); }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(); }
  override draw (): void { this.drawRect(0, 0, this.width, this.height, editorColors.outline); }
  protected override sortChildren (): void {
    place(this.titleBar, 1, 1, this.width - 2, floatingTitleHeight);
    place(this.body, 1, floatingTitleHeight + 1, this.width - 2, this.height - floatingTitleHeight - 2);
    for (const handle of this.resizeHandles) {
      const corner = !!handle.horizontal && !!handle.vertical;
      const width = handle.horizontal ? corner ? 8 : 5 : this.width - 16;
      const height = handle.vertical ? corner ? 8 : 5 : this.height - 16;

      place(handle, handle.horizontal < 0 ? 0 : handle.horizontal > 0 ? this.width - width : 8,
        handle.vertical < 0 ? 0 : handle.vertical > 0 ? this.height - height : 8, width, height);
    }
  }
}

class DockPreview extends Control {
  bounds?: DockBounds;
  target?: DockBounds;
  floating = false;
  override draw (): void {
    const rect = this.bounds;

    if (!rect) { return; }
    if (!this.floating) { this.fillRect(rect.x, rect.y, rect.width, rect.height, new math.Color(0, .44, .88, .3)); }
    this.drawRect(rect.x, rect.y, rect.width, rect.height, this.floating ? editorColors.outline : editorColors.primary, this.floating ? 1 : 2);
    if (this.target) {
      const x = this.target.x + this.target.width / 2, y = this.target.y + this.target.height / 2;

      for (const [dx, dy] of [[0, 0], [-36, 0], [36, 0], [0, -36], [0, 36]]) {
        this.drawStyleBox(editorBox(editorColors.header, 0, 3, editorColors.primary), x + dx - 14, y + dy - 14, 28, 28);
        this.drawRect(x + dx - 7, y + dy - 7, 14, 14, editorColors.foreground);
      }
    }
  }
}

/** Hosts persistent panel contents. Changing docking reparents the existing contents. */
export class DockWorkspace extends Container {
  activePanelId?: string;
  layoutChanged?: () => void;
  readonly panels = new Map<string, DockPanel>();
  private groups = new Map<string, DockGroupControl>();
  private layoutRoot?: Control;
  private floats: FloatingPanel[] = [];
  private focused?: Control | null;
  private readonly preview: DockPreview;
  private drag?: { id: string, target?: string, edge: DockEdge, bounds: DockBounds, before?: string };
  private panelGrab?: { id: string, offset: math.Vector2, width: number, height: number };
  private dragCanceled = false;
  private readonly tabContext: EditorMenu;

  constructor (engine: Engine, readonly model: DockModel) {
    super(engine);
    this.tabContext = new EditorMenu(engine);
    this.preview = append(this, new DockPreview(engine)); this.preview.mouseFilter = MouseFilter.Ignore;
    model.changed = () => { this.rebuild(); this.layoutChanged?.(); };
    model.activated = id => {
      this.activePanelId = id;
      this.groups.forEach(group => group.refresh());
      const frame = this.floats.find(frame => frame.contains(id));

      if (frame) { this.changeChildIndex(frame, this.children.length - 2); frame.refreshTitle(); }
      this.layoutChanged?.();
    };
  }
  activatePanel (id: string): void {
    if (!this.panels.get(id)?.opened) { return; }
    this.activePanelId = id; this.model.activate(id);
    this.groups.forEach(group => { group.refresh(); group.revealTab(id); });
  }
  closeActivePanel (): void { if (this.activePanelId) { this.panels.get(this.activePanelId)?.close(); } }
  setTabsHidden (id: string, hidden: boolean): void {
    const group = this.model.groupFor(id);

    if (!group || hidden && group.tabs.filter(id => this.panels.get(id)?.opened).length !== 1) { return; }
    group.hidden = hidden; this.groups.get(group.id)?.refresh(); this.layoutChanged?.();
  }
  showTabContext (id: string, position: math.Vector2): void {
    const ids = this.model.groupFor(id)?.tabs.filter(id => this.panels.get(id)?.opened) ?? [], index = ids.indexOf(id);
    const close = (values: string[]): void => { values.forEach(id => this.panels.get(id)?.close()); };

    this.tabContext.setActions([
      { label: 'Hide Tab', enabled: ids.length === 1, action: () => this.setTabsHidden(id, true) },
      { label: '', separator: true },
      { label: 'Close', shortcut: 'Ctrl+W', action: () => close([id]) },
      { label: 'Close Tabs to the Left', enabled: index > 0, action: () => close(ids.slice(0, index)) },
      { label: 'Close Tabs to the Right', enabled: index >= 0 && index < ids.length - 1, action: () => close(ids.slice(index + 1)) },
      { label: 'Close Other Tabs', enabled: ids.length > 1, action: () => close(ids.filter(other => other !== id)) },
    ]); this.tabContext.show(this, position);
  }
  register (panel: DockPanel): void {
    this.panels.set(panel.id, panel); panel.content.visible = panel.content.enabled = false;
    if (panel.opened && !this.model.groupFor(panel.id) && !this.model.snapshot.floating.some(entry => entry.id === panel.id)) { this.model.snapshot.floating.push({ id: panel.id, bounds: this.initialBounds(panel) }); }
  }
  unregister (id: string): void {
    const panel = this.panels.get(id);

    if (!panel) { return; }
    panel.content.parent = null; this.panels.delete(id); this.rebuild(); this.layoutChanged?.();
  }
  updateTitle (id: string, title: string): void {
    const panel = this.panels.get(id);

    if (!panel || panel.title === title) { return; }
    panel.title = title; this.groups.forEach(group => group.refresh()); this.floats.forEach(frame => frame.refreshTitle());
  }
  private initialBounds (panel: DockPanel): DockBounds { return { x: 80, y: 50, width: Math.min(panel.initialSize?.x ?? 800, (this.width || window.innerWidth) - 100), height: Math.min(panel.initialSize?.y ?? 600, (this.height || window.innerHeight) - 100) }; }
  setOpened (id: string, opened: boolean): void {
    const panel = this.panels.get(id);

    if (!panel) { return; }
    panel.opened = opened;
    if (opened && !this.model.groupFor(id) && !this.model.snapshot.floating.some(entry => entry.id === id)) {
      this.model.snapshot.floating.push({ id, bounds: this.initialBounds(panel) });
    }
    if (opened) {
      const group = this.model.groupFor(id);

      if (group) { group.active = id; }
    }
    this.rebuild();
    if (opened) { this.activatePanel(id); } else if (this.activePanelId === id) {
      const next = this.model.groupFor(id)?.active;
      const successor = next && this.panels.get(next)?.opened ? next : this.model.groups().map(group => group.active).find(id => this.panels.get(id)?.opened);

      this.activePanelId = undefined;
      if (successor) { this.activatePanel(successor); this.groups.get(this.model.groupFor(successor)!.id)?.focusTab(successor); }
    }
    this.layoutChanged?.();
  }
  override update (delta: number): void {
    const focused = this.root?.guiGetFocusOwner();

    if (focused !== this.focused) {
      this.focused = focused;
      for (let control = focused; control; control = control.parent) {
        const panel = [...this.panels.values()].find(panel => panel.content === control);

        if (panel) {
          this.activatePanel(panel.id);

          break;
        }
      }
    }
    super.update(delta);
  }
  rebuild (): void {
    for (const panel of this.panels.values()) { panel.content.parent = null; panel.content.visible = panel.content.enabled = false; panel.visibilityChanged?.(false); }
    this.layoutRoot?.dispose(); this.floats.forEach(control => control.dispose()); this.floats = []; this.groups.clear();
    const build = (node: DockNode): Control | undefined => {
      if (node.kind === 'tabs') {
        const panels = node.tabs.flatMap(id => this.panels.get(id)?.opened ? [this.panels.get(id)!] : []);

        if (!panels.length) { return; }
        if (!panels.some(panel => panel.id === node.active)) { node.active = panels[0].id; }
        const group = new DockGroupControl(this.engine, node, panels, this);

        this.groups.set(node.id, group);

        return group;
      }
      const first = build(node.first), second = build(node.second);

      if (!first) { return second; }
      if (!second) { return first; }
      const split = new EditorSplitContainer(this.engine, first, second, node.vertical, node.ratio);

      split.changed = ratio => { node.ratio = ratio; this.layoutChanged?.(); };

      return split;
    };

    this.layoutRoot = build(this.model.snapshot.root);
    if (this.layoutRoot) { append(this, this.layoutRoot); }
    for (const entry of this.model.snapshot.floating) {
      const body = build(this.model.floatingNode(entry));

      if (body) { this.floats.push(append(this, new FloatingPanel(this.engine, entry, body, this))); }
    }
    this.preview.parent = null; append(this, this.preview); this.queueSort();
  }
  grabPanel (id: string, position: math.Vector2): void {
    this.dragCanceled = false;
    const floating = this.floats.find(frame => frame.contains(id)), group = this.model.groupFor(id);
    const source = floating ?? (group ? this.groups.get(group.id) : undefined);

    if (!source) { return; }
    const offset = source.makePositionLocal(position);

    if (!floating) { offset.y += floatingTitleHeight + 1; }
    this.panelGrab = { id, offset, width: source.width, height: source.height + (floating ? 0 : floatingTitleHeight + 2) };
  }
  releasePanel (): void { this.panelGrab = undefined; this.dragCanceled = false; }
  dragPanel (id: string, position: math.Vector2, floating: boolean): void {
    if (this.dragCanceled) { return; }
    const point = this.makePositionLocal(position);
    const panel = this.panels.get(id), documentTab = panel?.dockingRole === 'document';
    let target: DockGroupControl | undefined;

    if (!floating) {
      const layer = (control: Control): number => {
        while (control.parent && control.parent !== this) { control = control.parent; }

        return this.getChildIndex(control);
      };

      target = [...this.groups.values()].sort((a, b) => layer(b) - layer(a)).find(group => {
        const p = group.makePositionLocal(position);

        if (group.hasOnlyPanel(id) || !panel || !group.canDock(panel)) { return false; }
        if (documentTab && p.y >= group.headerHeight) { return false; }

        return p.x >= 0 && p.y >= 0 && p.x < group.width && p.y < group.height;
      });
    }
    let edge: DockEdge = 'center';
    const grab = this.panelGrab?.id === id ? this.panelGrab : undefined;
    const floatingBounds: DockBounds = { x: point.x - (grab?.offset.x ?? 80), y: point.y - (grab?.offset.y ?? 12), width: Math.min(grab?.width ?? 600, this.width), height: Math.min(grab?.height ?? 400, this.height) };
    let bounds = floatingBounds;

    this.preview.target = undefined;

    if (target) {
      const p = target.makePositionLocal(position);
      const origin = this.makePositionLocal(screenPosition(target));

      bounds = { x: origin.x, y: origin.y, width: target.width, height: target.height };
      if (!documentTab) { this.preview.target = { ...bounds }; }
      const dx = p.x - target.width / 2, dy = p.y - target.height / 2;

      if (p.y < target.headerHeight || Math.abs(dx) < 16 && Math.abs(dy) < 16) { edge = 'center'; } else if (Math.abs(dx + 36) < 16 && Math.abs(dy) < 16 || p.x < 18 && Math.abs(dy) < 24) { edge = 'left'; bounds.width /= 2; } else if (Math.abs(dx - 36) < 16 && Math.abs(dy) < 16 || p.x > target.width - 18 && Math.abs(dy) < 24) { edge = 'right'; bounds.width /= 2; bounds.x += bounds.width; } else if (Math.abs(dy + 36) < 16 && Math.abs(dx) < 16 || p.y < 18 && Math.abs(dx) < 24) { edge = 'top'; bounds.height /= 2; } else if (Math.abs(dy - 36) < 16 && Math.abs(dx) < 16 || p.y > target.height - 18 && Math.abs(dx) < 24) { edge = 'bottom'; bounds.height /= 2; bounds.y += bounds.height; } else { target = undefined; bounds = floatingBounds; }
    }
    this.drag = { id, target: target?.model.id, edge, bounds, before: target && edge === 'center' ? target.tabBefore(position, id) : undefined };
    this.preview.bounds = bounds; this.preview.floating = !target;
  }
  dropPanel (canceled: boolean): void {
    const drag = this.drag;

    this.drag = undefined; this.preview.bounds = this.preview.target = undefined;
    if (!drag || canceled) { return; }
    if (drag.target) { this.model.dock(drag.id, drag.target, drag.edge, drag.before); } else { this.model.float(drag.id, drag.bounds); }
    this.activatePanel(drag.id); this.groups.get(this.model.groupFor(drag.id)!.id)?.focusTab(drag.id);
  }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape' && this.drag) { this.dragCanceled = true; this.dropPanel(true); event.accept(); }
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(); }
  override onDestroy (): void { this.tabContext.dispose(); super.onDestroy(); }
  protected override sortChildren (): void {
    if (this.layoutRoot) { place(this.layoutRoot, 0, 0, this.width, this.height); }
    place(this.preview, 0, 0, this.width, this.height);
    for (const floating of this.floats) {
      const b = floating.bounds;

      b.width = Math.min(this.width, b.width); b.height = Math.min(this.height, b.height);
      b.x = Math.max(40 - b.width, Math.min(this.width - 40, b.x)); b.y = Math.max(0, Math.min(this.height - floatingTitleHeight, b.y));
      floating.applyFrameBounds();
    }
  }
}
