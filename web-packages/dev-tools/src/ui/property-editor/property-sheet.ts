import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import type { Control, Label, Button } from '@galacean/effects-plugin-gui';
import { Container, SizeFlags, TextOverflow, Theme, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { append, label, place } from '../controls/layout';
import { EditorVerticalScrollContainer } from '../controls/scroll-container';
import { EditorMenuButton } from '../controls/menu';
import { EditorSectionHeader } from '../controls/section-header';
import { EditorIconButton } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';
import { editorDetailBackground, editorColors as C, editorMetrics, EDITOR_SMALL_FONT_SIZE, getEditorFont, setEditorFont } from '../theme/control-theme';
import { setTooltip } from '../controls/tooltip';
import { PropertyField, PropertyGroup } from './property-group';

export { PropertyField, PropertyGroup } from './property-group';

export interface ValueBinding<T> { read(): T, write(value: T): void }
export interface PropertyEditContext {
  change(label: string, owner: Control, action: () => void): void,
  finish(owner: Control): void,
}
export interface NumberOptions { step?: number, min?: number, max?: number, precision?: number, suffix?: string }
export interface PropertyOptions {
  height?: number, tooltip?: string,
  enabled?: () => boolean, reset?: () => void, resetVisible?: () => boolean,
  captionAction?: { icon(): EditorIcon, hint: string, pressed(): void },
}
export function propertyBinding<T> (object: object, key: PropertyKey): ValueBinding<T> {
  return { read: () => Reflect.get(object, key) as T, write: value => { Reflect.set(object, key, value); } };
}

class PropertyRow extends Container {
  private readonly caption: Label;
  private readonly reset?: Button;
  private readonly captionAction?: EditorIconButton;
  private resizing = false;
  constructor (engine: Engine, readonly title: string, readonly valueControl: Control, readonly group: PropertyGroup, readonly options: PropertyOptions, private readonly refreshValue?: () => void) {
    super(engine);
    this.caption = append(this, label(engine, title));
    this.caption.verticalAlignment = VerticalAlignment.Center;
    setTooltip(this, () => this.getLocalMousePosition().x < this.divider ? options.tooltip || title : '');
    this.caption.textOverflow = TextOverflow.Ellipsis;
    append(this, valueControl);
    if (options.captionAction) {
      this.captionAction = append(this, new EditorIconButton(engine, options.captionAction.icon()));
      setTooltip(this.captionAction, options.captionAction.hint); this.captionAction.on('pressed', options.captionAction.pressed);
    }
    if (options.reset) {
      this.reset = append(this, new EditorIconButton(engine, 'reset'));
      this.reset.on('pressed', () => {
        group.sheet.edit.change(title, this, options.reset!); group.sheet.edit.finish(this); group.sheet.refresh();
      });
    }
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, Math.max(editorMetrics.propertyRowHeight, this.valueControl.getCombinedMinimumSize().y + 5)); }
  override getDesiredSize (): math.Vector2 { return this.getMinimumSize(); }
  private get divider (): number { return Math.max(Math.min(90, this.width * .45), Math.min(this.width * this.group.sheet.columnRatio, this.width - 100)); }
  protected override sortChildren (): void {
    const divider = this.divider;

    place(this.caption, 24 + this.group.depth * 10, 0, divider - 30 - this.group.depth * 10 - (this.captionAction ? 24 : 0), this.height - 1);
    place(this.valueControl, divider + 12, 2, this.width - divider - 42, this.height - 5);
    if (this.captionAction) { place(this.captionAction, divider - 24, 2, 22, 22); }
    if (this.reset) { place(this.reset, this.width - 26, 2, 22, 22); }
  }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, editorDetailBackground(this.group.depth, this.hasPoint(this.getLocalMousePosition())));
    this.fillRect(this.divider, 0, 1, this.height, C.recessed);
    this.fillRect(0, this.height - 1, this.width, 1, C.recessed);
  }
  refresh (): void {
    this.refreshValue?.();
    if (this.options.enabled) { this.valueControl.enabled = this.options.enabled(); }
    if (this.reset) { this.reset.visible = this.options.resetVisible?.() ?? true; }
    if (this.captionAction) { this.captionAction.iconName = this.options.captionAction!.icon(); }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && Math.abs(event.position.x - this.divider) < 5) { this.resizing = true; event.accept(); }
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    this.defaultCursorShape = this.resizing || Math.abs(event.position.x - this.divider) < 5 ? 'ew-resize' : 'default';
    if (this.resizing) { this.group.sheet.setColumnRatio(event.position.x / Math.max(1, this.width)); event.accept(); }
  }
  override onMouseUp (event: InputEventMouseButton): void { this.resizing = false; event.accept(); }
}

type PropertyNode = PropertyGroup | PropertyField;
interface DisplayRow { node: PropertyNode, top: number, height: number }

class PropertyBody extends Container {
  constructor (engine: Engine, private readonly sheet: PropertySheet) { super(engine); this.horizontalSizeFlags = SizeFlags.ExpandFill; }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, this.sheet.contentHeight); }
  override getDesiredSize (): math.Vector2 { return this.getMinimumSize(); }
}

/** The tree owns data nodes; only the viewport and a small overscan own GUI controls. */
export class PropertySheet extends EditorVerticalScrollContainer {
  readonly body: Container;
  readonly expansion = new Map<string, boolean>();
  private readonly groups: PropertyGroup[] = [];
  private readonly mounted = new Map<PropertyNode, Control>();
  private readonly controlNodes = new Map<Control, PropertyNode>();
  private readonly wanted = new Set<PropertyNode>();
  private readonly rows: DisplayRow[] = [];
  private readonly rowIndices = new Map<PropertyNode, number>();
  private rowsDirty = false;
  private viewportDirty = true;
  private lastScroll = -1;
  private lastWidth = -1;
  private lastHeight = -1;
  private lastFocus: Control | null = null;
  private syncing = false;
  private totalHeight = 0;
  columnRatio = .38;
  query = '';

  constructor (engine: Engine, readonly edit: PropertyEditContext) {
    super(engine);
    this.followFocus = true;
    this.theme = new Theme(); this.theme.setFontSize('Control', 'fontSize', EDITOR_SMALL_FONT_SIZE);
    this.theme.setFont('Control', 'font', { family: getEditorFont(engine, EDITOR_SMALL_FONT_SIZE), weight: 'normal', style: 'normal' });
    this.theme.setFont('EditorCategory', 'font', { family: getEditorFont(engine, EDITOR_SMALL_FONT_SIZE, 'bold'), weight: 'bold', style: 'normal' });
    this.body = append(this, new PropertyBody(engine, this));
  }
  get hasContent (): boolean { return this.groups.length > 0; }
  get contentHeight (): number {
    this.buildRows();

    return this.totalHeight;
  }
  clear (): void {
    for (const [node, control] of this.mounted) { this.releaseRow(node, control); }
    this.groups.length = 0; this.rows.length = 0; this.rowIndices.clear(); this.wanted.clear(); this.lastFocus = null;
    this.invalidateRows();
  }
  section (id: string, title: string, defaultOpen = true, icon?: EditorIcon): PropertyGroup {
    const section = new PropertyGroup(this, id, title, 0, defaultOpen, icon);

    this.groups.push(section); this.invalidateRows();

    return section;
  }
  filter (query: string): void {
    if (query !== this.query) { this.vScroll = 0; }
    this.query = query; this.invalidateRows();
  }
  refresh (): void {
    if (!this.visibleInHierarchy) { return; }
    this.syncRows();
    for (const control of this.mounted.values()) { if (control instanceof PropertyRow) { control.refresh(); } }
  }
  expandAll (open: boolean): void { this.groups.forEach(group => group.expandAll(open)); }
  setColumnRatio (ratio: number): void {
    this.columnRatio = Math.max(.2, Math.min(.6, ratio));
    for (const control of this.mounted.values()) { if (control instanceof PropertyRow) { control.queueSort(); } }
  }
  invalidateRows (): void {
    if (this.rowsDirty) { return; }
    this.rowsDirty = true; this.viewportDirty = true; this.queueSort(); this.body?.updateMinimumSize();
  }
  releaseGroup (group: PropertyGroup): void {
    for (const [node, control] of this.mounted) {
      let parent: PropertyGroup | undefined = node instanceof PropertyGroup ? node : node.group;

      while (parent && parent !== group) { parent = parent.parent; }
      if (parent) { this.releaseRow(node, control); }
    }
  }
  private buildRows (): void {
    if (!this.rowsDirty) { return; }
    this.rowsDirty = false; this.rows.length = 0; this.rowIndices.clear();
    let top = 0;
    const add = (node: PropertyNode, height: number): void => {
      this.rowIndices.set(node, this.rows.length); this.rows.push({ node, top, height }); top += height;
    };
    const visit = (group: PropertyGroup): void => {
      if (!group.visible) { return; }
      add(group, group.depth ? editorMetrics.nestedCategoryHeight : editorMetrics.categoryHeight);
      if (!group.expanded) { return; }
      for (const node of group.entries) {
        if (node instanceof PropertyGroup) { visit(node); } else if (node.visible) { add(node, node.height); }
      }
    };

    for (const group of this.groups) { group.applyFilter(this.query); visit(group); }
    if (this.totalHeight !== top) { this.totalHeight = top; this.body.updateMinimumSize(); }
  }
  private createRow (node: PropertyNode): Control {
    if (node instanceof PropertyField) {
      const widget = node.create();
      const control = new PropertyRow(this.engine, node.title, widget.control, node.group, node.options, widget.refresh);

      control.refresh();

      return control;
    }
    const heading = new EditorSectionHeader(this.engine, node.title, node.depth, node.icon);

    if (node.depth) { setEditorFont(heading, EDITOR_SMALL_FONT_SIZE, 'normal'); }
    heading.expanded = node.expanded;
    heading.on('pressed', () => node.expanded = !node.expanded);
    if (node.actions) {
      const menu = append(heading, new EditorMenuButton(this.engine, ''));

      menu.iconName = 'actions'; menu.actions = () => node.actions?.(menu) ?? [];
      heading.trailingWidth = 26; menu.setCustomMinimumSize(22, 22); setTooltip(menu, node.title + ' actions');
      heading.on('sizeChanged', () => place(menu, heading.width - 26, 1, 22, 22));
    }

    return heading;
  }
  private releaseRow (node: PropertyNode, control: Control): void {
    let focus = this.root?.guiGetFocusOwner();

    while (focus && focus !== control) { focus = focus.parent; }
    if (focus) { this.root?.releaseControlFocus(); }
    if (control instanceof PropertyRow) { this.edit.finish(control.valueControl); this.edit.finish(control); }
    this.mounted.delete(node); this.controlNodes.delete(control); control.dispose();
  }
  private syncRows (): void {
    if (this.syncing || this.isDisposed) { return; }
    const focused = this.root?.guiGetFocusOwner() ?? null;

    if (!this.rowsDirty && !this.viewportDirty && this.lastScroll === this.vScroll && this.lastWidth === this.body.width && this.lastHeight === this.height && this.lastFocus === focused) { return; }
    this.syncing = true;
    try {
      this.viewportDirty = false;
      this.buildRows();
      this.lastScroll = this.vScroll; this.lastWidth = this.body.width; this.lastHeight = this.height; this.lastFocus = focused;
      const start = Math.max(0, this.vScroll - editorMetrics.propertyRowHeight * 2);
      const end = this.vScroll + this.height + editorMetrics.propertyRowHeight * 2;
      let low = 0, high = this.rows.length;

      while (low < high) {
        const mid = (low + high) >>> 1, row = this.rows[mid];

        if (row.top + row.height <= start) { low = mid + 1; } else { high = mid; }
      }
      const wanted = this.wanted;

      wanted.clear();

      for (let index = low; index < this.rows.length && this.rows[index].top < end; index++) { wanted.add(this.rows[index].node); }
      // Keep an active editor alive while scrolling so a numeric drag or text edit can finish normally.
      let focus: Control | null = focused;

      while (focus && focus.parent !== this.body) { focus = focus.parent; }
      for (const [node, control] of this.mounted) {
        if (!wanted.has(node) && !(control === focus && this.rowIndices.has(node))) { this.releaseRow(node, control); }
      }
      for (const node of wanted) {
        let control = this.mounted.get(node);

        if (!control) {
          control = append(this.body, this.createRow(node)); this.mounted.set(node, control); this.controlNodes.set(control, node);
          control.on('minimumSizeChanged', () => { this.viewportDirty = true; this.queueSort(); });
        }
        const row = this.rows[this.rowIndices.get(node)!];

        if (control instanceof EditorSectionHeader) { control.expanded = (node as PropertyGroup).expanded; }
        if (node instanceof PropertyField) {
          const height = control.getCombinedMinimumSize().y;

          if (node.height !== height) { node.height = height; this.invalidateRows(); }
        }
        place(control, 0, row.top, this.body.width, row.height);
      }
      this.body.children.sort((a, b) => this.rowIndices.get(this.controlNodes.get(a)!)! - this.rowIndices.get(this.controlNodes.get(b)!)!);
    } finally { this.syncing = false; }
  }
  protected override sortChildren (): void { this.buildRows(); super.sortChildren(); this.syncRows(); }
  override update (delta: number): void {
    if (!this.visibleInHierarchy) { return; }
    this.refresh(); super.update(delta);
  }
  override dispose (): void {
    if (this.isDisposed) { return; }
    this.clear(); super.dispose();
  }
}
