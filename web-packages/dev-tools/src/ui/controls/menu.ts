import { math } from '@galacean/effects';
import type { Engine, InputEventKey } from '@galacean/effects';
import type { ContentInsets } from '@galacean/effects-plugin-gui';
import { Button, ButtonActionMode, ButtonDrawMode, Control, HBoxContainer, VBoxContainer, HorizontalAlignment } from '@galacean/effects-plugin-gui';
import { EDITOR_FONT, EDITOR_FONT_SIZE, EDITOR_SMALL_FONT_SIZE, EDITOR_TINY_FONT_SIZE, editorColors } from '../theme/control-theme';
import { append, disposeChildren, screenPosition } from './layout';
import { EditorPopupPanel } from './popup-panel';
import { paintIcon, type EditorIcon } from '../icons/control-icons';

export interface MenuAction {
  label: string,
  shortcut?: string,
  enabled?: boolean,
  checked?: boolean,
  action?: () => void,
  children?: MenuAction[] | (() => MenuAction[]),
  separator?: boolean,
  heading?: boolean,
  icon?: EditorIcon,
}

type MenuAppearance = { iconColumn: boolean, checkColumn: boolean, selectionList: boolean, rowFontSize: number };

export class EditorMenuActionButton extends Button {
  constructor (engine: Engine, readonly entry: MenuAction, private readonly appearance: MenuAppearance = { iconColumn: !!entry.icon, checkColumn: entry.checked !== undefined, selectionList: false, rowFontSize: EDITOR_FONT_SIZE }) {
    super(engine, entry.label);
    this.themeTypeVariation = appearance.selectionList ? 'EditorChoiceRow' : 'EditorMenuButton';
    this.textAlignment = HorizontalAlignment.Left;
    this.clipText = true;
    this.setThemeFontSizeOverride('fontSize', appearance.rowFontSize);
    this.disabled = entry.enabled === false;
    this.on('pressed', () => this.activateEntry());
  }
  activateEntry (): void {
    if (this.disabled) { return; }
    this.entry.action?.();
  }
  protected override getContentInsets (): ContentInsets {
    if (this.appearance.selectionList) { return { left: 8, top: 3, right: 8, bottom: 3 }; }
    const shortcut = this.entry.shortcut ? this.measureText(this.entry.shortcut, EDITOR_SMALL_FONT_SIZE, EDITOR_FONT).width + 41 : 0;

    return { left: 14 + (this.appearance.iconColumn ? 24 : 0) + (this.appearance.checkColumn ? 24 : 0), top: 3, right: this.entry.shortcut ? 12 + shortcut : 26, bottom: 3 };
  }
  override getMinimumSize (): math.Vector2 {
    const text = this.measureText(this.entry.label, this.appearance.rowFontSize, EDITOR_FONT), insets = this.getContentInsets();

    return new math.Vector2(Math.max(this.appearance.selectionList ? 100 : 180, text.width + insets.left + insets.right), Math.max(14, text.lineHeight) + 6);
  }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    const c = this.disabled || mode === ButtonDrawMode.Disabled ? editorColors.disabled : mode !== ButtonDrawMode.Normal || this.hasFocus() ? editorColors.foregroundHover : editorColors.foreground;

    if (this.entry.checked && this.appearance.checkColumn) { paintIcon(this, 'check', 15, (this.height - 14) / 2, 14, c); }
    if (this.entry.icon) { paintIcon(this, this.entry.icon, 15 + (this.appearance.checkColumn ? 24 : 0), (this.height - 14) / 2, 14, c); }
    if (this.entry.children) { paintIcon(this, 'caretRight', this.width - 20, (this.height - 14) / 2, 14, c); }
    if (this.entry.shortcut) {
      const metrics = this.measureText(this.entry.shortcut, EDITOR_SMALL_FONT_SIZE, EDITOR_FONT);

      this.drawText(this.width - 12 - metrics.width, (this.height - metrics.lineHeight) / 2, this.entry.shortcut, EDITOR_SMALL_FONT_SIZE, c, EDITOR_FONT);
    }
  }
}

class MenuRow extends EditorMenuActionButton {
  constructor (engine: Engine, entry: MenuAction, private readonly menu: EditorMenu, appearance: MenuAppearance) { super(engine, entry, appearance); }
  override activateEntry (): void {
    if (this.disabled) { return; }
    if (this.entry.children) { this.menu.openSubmenu(this, true); } else { this.menu.closeBranch(); this.entry.action?.(); }
  }
  override onMouseEnter (): void {
    super.onMouseEnter();
    this.menu.requestSubmenu(!this.disabled && this.entry.children ? this : undefined);
  }
  override onMouseLeave (): void { super.onMouseLeave(); this.menu.cancelPendingSubmenu(); }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'ArrowRight' && this.entry.children) { this.menu.openSubmenu(this, true); event.accept(); } else { super.onKeyDown(event); }
  }
}

class MenuSeparator extends Control {
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, 13); }
  override draw (): void { this.drawLine(12, 6, this.width - 12, 6, new math.Color(1, 1, 1, .25)); }
}

export class MenuHeading extends Control {
  constructor (engine: Engine, private readonly title: string) { super(engine); }
  private get textLayout () { return this.measureText(this.title.toLocaleUpperCase(), EDITOR_TINY_FONT_SIZE, EDITOR_FONT, 'bold'); }
  override getMinimumSize (): math.Vector2 {
    const layout = this.textLayout, count = layout.lines[0].characters.length;

    return new math.Vector2(layout.width + Math.max(0, count - 1) * EDITOR_TINY_FONT_SIZE * .25 + 50, layout.lineHeight + 12);
  }
  override draw (): void {
    const layout = this.textLayout, line = layout.lines[0], spacing = EDITOR_TINY_FONT_SIZE * .25;
    const tint = new math.Color(1, 1, 1, .25), y = (this.height - layout.lineHeight) / 2;

    line.characters.forEach((character, index) => this.drawText(12 + line.positions[index] + index * spacing, y, character, EDITOR_TINY_FONT_SIZE, tint, EDITOR_FONT, 'bold'));
    const start = 12 + layout.width + Math.max(0, line.characters.length - 1) * spacing + 14;

    if (this.width > start + 12) { this.fillRect(start, Math.floor(this.height / 2), this.width - start - 12, 1, tint); }
  }
}

/** Menus own real buttons; actions run from the pressed signal. */
export class EditorMenu extends EditorPopupPanel {
  readonly content: VBoxContainer;
  selectionList = false;
  rowFontSize = EDITOR_FONT_SIZE;
  private rows: MenuRow[] = [];
  private submenu?: EditorMenu;
  private submenuSource?: MenuRow;
  private parentMenu?: EditorMenu;
  private source?: EditorMenuButton;
  private pendingSubmenu?: number;
  private submenuOpenedAt = 0;
  private previousMouse = new math.Vector2();

  constructor (engine: Engine) {
    super(engine); this.themeTypeVariation = 'EditorMenu';
    this.content = append(this, new VBoxContainer(engine));
    this.content.setThemeConstantOverride('separation', 0);
    this.onPopup('popupClosed', () => this.closeSubmenu());
  }
  setActions (actions: MenuAction[]): void {
    this.closeSubmenu(); disposeChildren(this.content); this.rows = [];
    this.themeTypeVariation = this.selectionList ? 'EditorChoiceMenu' : 'EditorMenu';
    const sections: MenuAction[][] = [[]];

    for (const action of actions) { if (action.heading || action.separator) { sections.push([]); } else { sections[sections.length - 1].push(action); } }
    const appearances = new Map<MenuAction, MenuAppearance>();

    for (const section of sections) {
      const appearance = { iconColumn: !this.selectionList && section.some(action => !!action.icon), checkColumn: !this.selectionList && section.some(action => action.checked !== undefined), selectionList: this.selectionList, rowFontSize: this.rowFontSize };

      for (const action of section) { appearances.set(action, appearance); }
    }
    for (const action of actions) {
      if (action.heading) { append(this.content, new MenuHeading(this.engine, action.label)); } else if (action.separator) { append(this.content, new MenuSeparator(this.engine)); } else { this.rows.push(append(this.content, new MenuRow(this.engine, action, this, appearances.get(action)!))); }
    }
    this.setSize(0, 0);
  }
  show (source: Control, position?: math.Vector2): void {
    this.source = source instanceof EditorMenuButton ? source : undefined;
    this.previousMouse.copyFrom(source.root?.getMousePosition() ?? new math.Vector2());
    const target = position ?? screenPosition(source, 0, source.height);

    this.popup(target, source);
    if (!position && this.y < target.y) { this.setPosition(this.x, Math.max(0, screenPosition(source).y - this.height)); }
  }
  override update (delta: number): void {
    if (!this.visible) { return; }
    const point = this.root?.getMousePosition();

    if (point && (point.x !== this.previousMouse.x || point.y !== this.previousMouse.y) && this.source?.menuBar && !this.parentMenu) {
      const next = this.source.menuSiblings().find(button => button !== this.source && button.hasPoint(button.makePositionLocal(point)));

      if (next) {
        next.showMenu();

        return;
      }
    }
    if (point) { this.previousMouse.copyFrom(point); }
    super.update(delta);
  }
  cancelPendingSubmenu (): void { window.clearTimeout(this.pendingSubmenu); this.pendingSubmenu = undefined; }
  requestSubmenu (source?: MenuRow): void {
    this.cancelPendingSubmenu();
    const mouse = this.root?.getMousePosition(), submenu = this.submenu;
    const childOrigin = submenu && screenPosition(submenu);
    const dx = mouse ? mouse.x - this.previousMouse.x : 0;
    const edge = childOrigin && submenu && (childOrigin.x >= this.previousMouse.x ? childOrigin.x : childOrigin.x + submenu.width);
    const intersection = mouse && edge !== undefined && dx ? this.previousMouse.y + (mouse.y - this.previousMouse.y) * (edge - this.previousMouse.x) / dx : NaN;
    const movingToward = childOrigin && submenu && edge !== undefined && dx * (edge - this.previousMouse.x) > 0 && intersection >= childOrigin.y && intersection <= childOrigin.y + submenu.height;
    const delay = submenu?.visible && performance.now() - this.submenuOpenedAt > 500 && movingToward ? 500 : 0;

    if (!delay) {
      if (source) { this.openSubmenu(source); } else { this.closeSubmenu(); }

      return;
    }
    this.pendingSubmenu = window.setTimeout(() => {
      if (this.visible && !source?.isDisposed) { if (source) { this.openSubmenu(source); } else { this.closeSubmenu(); } }
    }, delay);
  }
  closeSubmenu (): void {
    this.cancelPendingSubmenu(); this.submenuSource?.setPressedNoSignal(false);
    this.submenu?.hidePopup(); this.submenu?.dispose(); this.submenu = undefined; this.submenuSource = undefined;
  }
  openSubmenu (source: MenuRow, keyboard = false): void {
    this.cancelPendingSubmenu();
    if (source.disabled) { return; }
    if (this.submenuSource === source && this.submenu?.visible) {
      if (keyboard) { this.submenu?.rows.find(row => !row.disabled)?.grabFocus(); }

      return;
    }
    this.closeSubmenu(); this.submenuSource = source; source.setPressedNoSignal(true);
    const entries = source.entry.children;

    if (!entries) { return; }
    const submenu = this.submenu = new EditorMenu(this.engine);

    submenu.parentMenu = this;
    submenu.setActions(typeof entries === 'function' ? entries() : entries);
    const position = screenPosition(source, source.width, 0);

    submenu.show(source, position);
    if (submenu.x < position.x) { submenu.setPosition(Math.max(0, screenPosition(source).x - submenu.width), submenu.y); }
    this.submenuOpenedAt = performance.now();
    if (keyboard) { submenu.rows.find(row => !row.disabled)?.grabFocus(); }
  }
  closeBranch (): void {
    if (this.parentMenu) { this.parentMenu.closeBranch(); } else { this.hidePopup(); }
  }
  focusBoundary (last = false): void {
    const active = this.rows.filter(row => !row.disabled);

    (this.selectionList ? active.find(row => row.entry.checked) : undefined)?.grabFocus();
    if (!this.selectionList || !active.some(row => row.entry.checked)) { (last ? active.at(-1) : active[0])?.grabFocus(); }
  }
  override onKeyDown (event: InputEventKey): void {
    const active = this.rows.filter(row => !row.disabled);

    if (event.keycode === 'ArrowDown' || event.keycode === 'ArrowUp') {
      const index = active.findIndex(row => row.hasFocus());
      const direction = event.keycode === 'ArrowUp' ? -1 : 1;

      active[index < 0 ? direction > 0 ? 0 : active.length - 1 : (index + direction + active.length) % active.length]?.grabFocus(); event.accept();
    } else if (event.keycode === 'ArrowLeft' && this.parentMenu) { this.hidePopup(); event.accept(); } else if ((event.keycode === 'ArrowLeft' || event.keycode === 'ArrowRight') && this.source?.menuBar && !this.parentMenu) {
      const buttons = this.source.menuSiblings(), index = buttons.indexOf(this.source), direction = event.keycode === 'ArrowLeft' ? -1 : 1;
      const next = buttons[(index + direction + buttons.length) % buttons.length];

      if (next) { next.showMenu(true); } event.accept();
    } else { super.onKeyDown(event); }
  }
  override onDestroy (): void { this.closeSubmenu(); super.onDestroy(); }
}

export class EditorMenuButton extends Button {
  readonly menu: EditorMenu;
  actions: () => MenuAction[] = () => [];
  iconName?: EditorIcon;
  iconSize = 16;
  showArrow = false;
  openMenu?: () => void;
  private isMenuBar = false;

  constructor (engine: Engine, text: string, actions?: () => MenuAction[]) {
    super(engine, text);
    if (actions) { this.actions = actions; }
    this.themeTypeVariation = 'EditorToolbarButton';
    this.menu = new EditorMenu(engine);
    this.on('pressed', () => this.showMenu());
    this.menu.onPopup('popupOpened', () => this.setPressedNoSignal(true));
    this.menu.onPopup('popupClosed', () => this.setPressedNoSignal(false));
  }
  get menuBar (): boolean { return this.isMenuBar; }
  set menuBar (value: boolean) { this.isMenuBar = value; this.actionMode = value ? ButtonActionMode.Press : ButtonActionMode.Release; if (value) { this.themeTypeVariation = 'EditorMenuBarButton'; } }
  menuSiblings (): EditorMenuButton[] {
    return this.parent?.children.filter((control): control is EditorMenuButton => control instanceof EditorMenuButton && control.menuBar && !control.disabled && control.visibleInHierarchy) ?? [];
  }
  showMenu (keyboard = false): void {
    if (this.disabled) { return; }
    if (this.menuBar) { this.menuSiblings().forEach(button => { if (button !== this) { button.menu.hidePopup(); } }); }
    if (this.openMenu) { this.openMenu(); } else {
      this.menu.selectionList = this.themeTypeVariation === 'EditorComboButton';
      this.menu.rowFontSize = this.menu.selectionList ? this.getThemeFontSize('fontSize') : EDITOR_FONT_SIZE;
      this.menu.setCustomMinimumSize(this.menu.selectionList ? this.width : 0, 0);
      this.menu.setActions(this.actions()); this.menu.show(this); if (keyboard) { this.menu.focusBoundary(); }
    }
  }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'ArrowDown' || event.keycode === 'ArrowUp') { this.showMenu(true); if (event.keycode === 'ArrowUp') { this.menu.focusBoundary(true); } event.accept(); } else { super.onKeyDown(event); }
  }
  override getDrawMode (): ButtonDrawMode {
    if (this.disabled || !this.enabledInHierarchy) { return ButtonDrawMode.Disabled; }
    if (this.menuBar) {
      if (this.menu.visible) { return ButtonDrawMode.Pressed; }
      const hovered = this.isHovered() && this.hasPoint(this.getLocalMousePosition());

      return hovered ? ButtonDrawMode.Hover : ButtonDrawMode.Normal;
    }
    if (this.isPressing()) { return ButtonDrawMode.Pressed; }

    return this.buttonPressed ? this.isHovered() ? ButtonDrawMode.HoverPressed : ButtonDrawMode.Pressed : this.isHovered() ? ButtonDrawMode.Hover : ButtonDrawMode.Normal;
  }
  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();

    return { ...insets, left: insets.left + (this.iconName ? this.iconSize + (this.text ? 4 : 0) : 0), right: insets.right + (this.showArrow ? 14 : 0) };
  }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    const highlighted = mode === ButtonDrawMode.Hover || mode === ButtonDrawMode.Pressed || mode === ButtonDrawMode.HoverPressed;
    const tint = this.disabled || mode === ButtonDrawMode.Disabled ? editorColors.disabled : highlighted ? editorColors.foregroundHover : editorColors.foreground;
    const insets = super.getContentInsets(), contentHeight = this.height - insets.top - insets.bottom;

    if (this.iconName) { paintIcon(this, this.iconName, insets.left, insets.top + (contentHeight - this.iconSize) / 2, this.iconSize, tint); }
    if (this.showArrow) { paintIcon(this, 'chevronDown', this.width - insets.right - 12, insets.top + (contentHeight - 12) / 2, 12, tint); }
  }
  override onDestroy (): void { this.menu.dispose(); super.onDestroy(); }
}

export class EditorMenuBar extends HBoxContainer {
  constructor (engine: Engine) {
    super(engine); this.setThemeConstantOverride('separation', 0);
    engine.canvas.addEventListener('mousedown', this.switchMenu, true);
  }
  private readonly switchMenu = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.visibleInHierarchy || !this.enabledInHierarchy) { return; }
    const buttons = this.children.filter((control): control is EditorMenuButton => control instanceof EditorMenuButton && control.menuBar && !control.disabled && control.visibleInHierarchy);
    const opened = buttons.find(button => button.menu.visible);

    if (!opened) { return; }
    const bounds = this.engine.canvas.getBoundingClientRect();
    const point = new math.Vector2(event.clientX - bounds.left, event.clientY - bounds.top);
    const next = buttons.find(button => button.hasPoint(button.makePositionLocal(point)));

    if (next) {
      // The open popup owns pointer input outside its bounds, including the menu bar.
      if (next !== opened) { next.showMenu(); }
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  override onDestroy (): void {
    this.engine.canvas.removeEventListener('mousedown', this.switchMenu, true); super.onDestroy();
  }
}
