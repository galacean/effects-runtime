import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion, InputEventKey } from '@galacean/effects';
import { Container, Control, FocusMode, MouseFilter, ellipsizeText } from '@galacean/effects-plugin-gui';
import { VirtualList } from '../../ui/controls/virtual-list';
import { withDragPresentation } from '../../ui/controls/drag-feedback';
import { setTooltip } from '../../ui/controls/tooltip';
import { EditorInlineRename } from '../../ui/controls/inline-rename';
import { append, place } from '../../ui/controls/layout';
import { paintIcon } from '../../ui/icons/control-icons';
import { EDITOR_FONT, EDITOR_FONT_SIZE, editorColors as C } from '../../ui/theme/control-theme';
import type { HierarchyNode, HierarchyOptions } from './hierarchy-model';

export interface HierarchyTreeActions {
  select(node: HierarchyNode | undefined, event: InputEventMouseButton): void,
  toggle(node: HierarchyNode, recursive: boolean): void,
  context(node: HierarchyNode | undefined, position: math.Vector2): void,
  activate(node: HierarchyNode): void,
  rename(node: HierarchyNode, name: string): void,
  visibility(node: HierarchyNode, begin: boolean): void,
  finishVisibility(): void,
  dragData(node: HierarchyNode): unknown,
  canDrop(node: HierarchyNode | undefined, data: unknown, zone: DropZone): boolean,
  drop(node: HierarchyNode | undefined, data: unknown, zone: DropZone): void,
  key(event: InputEventKey): void,
  sort(column: 'visibility' | 'label' | 'type'): void,
}
export type DropZone = 'before' | 'inside' | 'after';

function paintText (control: Control, text: string, x: number, y: number, width: number, color = C.foreground, highlight = ''): void {
  const measure = (value: string) => control.measureText(value, EDITOR_FONT_SIZE, EDITOR_FONT);
  const display = ellipsizeText(text, Math.max(0, width), measure);
  const metrics = measure(display);
  const height = control.height - y;
  const term = highlight.trim().match(/^(?:name:|label:)?(?:"([^"]+)"|([^\s+\-:]+))$/i);
  const match = (term?.[1] ?? term?.[2] ?? '').toLocaleLowerCase(), start = match ? display.toLocaleLowerCase().indexOf(match) : -1;

  if (start >= 0) {
    const left = x + measure(display.slice(0, start)).width, right = left + measure(display.slice(start, start + match.length)).width;

    control.fillRect(left, y, right - left, height, new math.Color(144 / 255, 108 / 255, 30 / 255, 160 / 255));
  }

  control.drawText(x, y + (height - metrics.lineHeight) / 2, display, EDITOR_FONT_SIZE, color, EDITOR_FONT);
}

class HierarchyRow extends Control {
  node: HierarchyNode;
  index = 0;
  private get hovered (): boolean { return this.tree.nodeAt(this.root?.getMousePosition() ?? new math.Vector2(-1, -1))?.id === this.node.id; }
  private deferred?: InputEventMouseButton;
  private visibilityGesture = false;
  private dropZone?: DropZone;
  private renameField?: EditorInlineRename;

  constructor (engine: Engine, private readonly tree: HierarchyTree) {
    super(engine); this.mouseFilter = MouseFilter.Stop; this.focusMode = FocusMode.Click;
    this.clipContents = true;
  }
  bind (node: HierarchyNode, index: number): void { this.node = node; this.index = index; }
  private get indent (): number { return this.tree.labelLeft + 10 + this.node.depth * 12; }
  override draw (): void {
    if (!this.root?.guiIsDragging()) { this.dropZone = undefined; }
    const selected = this.tree.selected.has(this.node.id), parent = !!this.node.children.length;
    const background = selected ? this.tree.focused ? C.primary : C.selectedInactive :
      this.hovered ? C.panel : this.node.highlighted ? C.selectedParent : this.index % 2 ? C.background : C.recessed;
    const tint = selected ? C.foregroundHover : this.node.item && !this.node.item.isActive ? C.muted : C.foreground;

    this.fillRect(0, 0, this.width, this.height, background);
    if (this.tree.options.showVisibility && this.node.kind !== 'level' && (this.hovered || selected || !this.node.visible)) {
      paintIcon(this, this.node.visible ? 'view' : 'hidden', 4, (this.height - 16) / 2, 16, tint);
    }
    const indent = this.indent, expanded = this.tree.expanded.has(this.node.id);

    if (parent) {
      if (expanded) { this.fillTriangle(indent, 7, indent + 8, 7, indent + 4, 12, tint); } else { this.fillTriangle(indent + 2, 5, indent + 7, 10, indent + 2, 15, tint); }
    }
    paintIcon(this, this.node.kind === 'folder' ? expanded ? 'folderOpen' : 'folder' : this.node.icon, indent + 13, (this.height - 16) / 2, 16, tint);
    const textX = indent + 33;

    if (!this.renameField) { paintText(this, this.node.label, textX, 0, this.tree.labelRight - textX - 4, tint, this.tree.highlight); }
    if (this.tree.options.showType) { paintText(this, this.node.type, this.tree.typeLeft + 6, 0, this.tree.typeRight - this.tree.typeLeft - 10, selected ? tint : C.muted); }
    if (this.dropZone === 'inside') { this.drawRect(1, 0, this.width - 2, this.height, C.primary, 2); } else if (this.dropZone) { this.fillRect(0, this.dropZone === 'before' ? 0 : this.height - 2, this.width, 2, C.primary); }
  }
  override onMouseLeave (): void { this.dropZone = undefined; }
  override onMouseDown (event: InputEventMouseButton): void {
    this.grabFocus();
    if (event.buttonIndex === MouseButton.Right) {
      this.tree.actions.context(this.node, event.globalPosition); event.accept();

      return;
    }
    if (event.buttonIndex !== MouseButton.Left) { return; }
    const x = event.position.x;

    if (x < this.tree.gutter && this.node.kind !== 'level') {
      this.visibilityGesture = true; this.tree.actions.visibility(this.node, true);
    } else if (x >= this.indent - 3 && x < this.indent + 12 && this.node.children.length) {
      this.tree.actions.toggle(this.node, event.shiftPressed);
    } else {
      if (this.tree.selected.has(this.node.id) && !event.ctrlPressed && !event.metaPressed && !event.shiftPressed) { this.deferred = event; } else { this.tree.actions.select(this.node, event); }
      if (event.doubleClick) { this.tree.actions.activate(this.node); }
    }
    event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.visibilityGesture) { return; }
    const point = this.tree.makePositionLocal(event.globalPosition), node = point.x >= 0 && point.x < this.tree.gutter ? this.tree.nodeAt(event.globalPosition) : undefined;

    if (node && node.kind !== 'level') { this.tree.actions.visibility(node, false); }
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (this.visibilityGesture) { this.visibilityGesture = false; this.tree.actions.finishVisibility(); }
    if (this.deferred && !event.canceled && this.hasPoint(event.position)) { this.tree.actions.select(this.node, this.deferred); }
    this.deferred = undefined; event.accept();
  }
  protected override getDragData (): unknown {
    this.deferred = undefined;

    const data = this.visibilityGesture ? null : this.tree.actions.dragData(this.node);

    return withDragPresentation(data, { label: this.node.label, icon: this.node.icon, count: (data as { ids?: string[] })?.ids?.length ?? 1 });
  }
  private zone (position: math.Vector2): DropZone {
    return this.node.kind !== 'item' || !this.node.editable ? 'inside' : position.y < 5 ? 'before' : position.y > 15 ? 'after' : 'inside';
  }
  protected override canDropData (position: math.Vector2, data: unknown): boolean {
    const zone = this.zone(position), valid = this.tree.actions.canDrop(this.node, data, zone);

    this.dropZone = valid ? zone : undefined;
    if (valid && zone === 'inside') { this.tree.expandAfterHover(this.node); }

    return valid;
  }
  protected override dropData (position: math.Vector2, data: unknown): void {
    this.tree.actions.drop(this.node, data, this.zone(position)); this.dropZone = undefined;
  }
  startRename (): void {
    if (this.renameField) { return; }
    const field = this.renameField = append(this, new EditorInlineRename(this.engine));
    const x = this.indent + 30;

    field.text = this.node.label; place(field, x, 0, Math.max(20, this.tree.labelRight - x), this.height);
    field.finish = cancel => {
      if (this.renameField !== field) { return; }
      this.renameField = undefined; field.finish = undefined;
      if (!cancel && field.text.trim()) { this.tree.actions.rename(this.node, field.text.trim()); }
      field.dispose(); if (!this.isDisposed && this.visibleInHierarchy) { this.grabFocus(); }
    };
    field.on('textSubmitted', () => field.finish?.(false)); field.grabFocus(); field.selectAll();
  }
  override onDestroy (): void {
    if (this.visibilityGesture) { this.visibilityGesture = false; this.tree.actions.finishVisibility(); }
    super.onDestroy();
  }
}

class HierarchyHeader extends Control {
  private resizing = false;
  private pressedColumn?: 'visibility' | 'label' | 'type';
  private dragging = false;
  constructor (engine: Engine, private readonly tree: HierarchyTree) {
    super(engine); this.mouseFilter = MouseFilter.Stop;
    setTooltip(this, () => {
      const column = this.columnAt(this.getLocalMousePosition().x);

      return 'Sort by ' + (column === 'visibility' ? 'visibility' : column === 'type' ? 'type' : 'item label') + '\n' + (tree.options.sort !== column ? 'Click for ascending order' : tree.options.descending ? 'Click to restore hierarchy order' : 'Click for descending order');
    });
  }
  private columnAt (x: number): 'visibility' | 'label' | 'type' {
    return x < this.tree.gutter ? 'visibility' : this.tree.options.showType && x >= this.tree.typeLeft && x < this.tree.typeRight ? 'type' : 'label';
  }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, C.header);
    const point = this.getLocalMousePosition();

    if (this.hasPoint(point)) {
      const column = this.columnAt(point.x), left = column === 'visibility' ? 0 : column === 'type' ? this.tree.typeLeft : this.tree.labelLeft;
      const right = column === 'visibility' ? this.tree.gutter : column === 'type' ? this.tree.typeRight : this.tree.labelRight;

      this.fillRect(left, 0, right - left, this.height, C.dropdown);
    }
    if (this.tree.options.showVisibility) { paintIcon(this, 'view', 4, (this.height - 16) / 2, 16, this.tree.options.sort === 'visibility' ? C.foregroundHover : C.foreground); }
    paintText(this, 'Item Label', this.tree.labelLeft + 4, 0, this.tree.labelRight - this.tree.labelLeft - (this.tree.options.sort === 'label' ? 24 : 8));
    if (this.tree.options.showType) {
      this.fillRect(this.tree.divider, 0, 1, this.height, C.recessed);
      paintText(this, 'Type', this.tree.typeLeft + 6, 0, this.tree.typeRight - this.tree.typeLeft - (this.tree.options.sort === 'type' ? 26 : 10));
    }
    if (this.tree.options.sort !== 'hierarchy' && this.tree.options.sort !== 'visibility') {
      const right = this.tree.options.sort === 'type' ? this.tree.typeRight : this.tree.labelRight;

      paintIcon(this, this.tree.options.descending ? 'sortDescending' : 'sortAscending', right - 16, (this.height - 12) / 2, 12);
    }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    this.resizing = this.tree.options.showType && Math.abs(event.position.x - this.tree.divider) < 5;
    this.pressedColumn = this.resizing ? undefined : this.columnAt(event.position.x); this.dragging = false; event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.resizing) {
      const ratio = (event.position.x - this.tree.gutter) / Math.max(1, this.tree.list.content.width - this.tree.gutter);

      this.tree.columnRatio = Math.max(.3, Math.min(.9, this.tree.typeFirst ? 1 - ratio : ratio)); this.tree.list.refresh(); event.accept();
    }
  }
  override getCursorShape (position: math.Vector2): ReturnType<Control['getCursorShape']> {
    return this.tree.options.showType && (this.resizing || Math.abs(position.x - this.tree.divider) < 5) ? 'ew-resize' : super.getCursorShape(position);
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (!event.canceled && !this.dragging && this.pressedColumn) { this.tree.actions.sort(this.pressedColumn); }
    this.resizing = this.dragging = false; this.pressedColumn = undefined; event.accept();
    this.root?.updateMouseCursorState();
  }
  protected override getDragData (): unknown {
    if (this.resizing || !this.tree.options.showType || !this.pressedColumn || this.pressedColumn === 'visibility') { return; }
    this.dragging = true;

    return withDragPresentation({ tree: this.tree, column: this.pressedColumn }, { label: this.pressedColumn === 'type' ? 'Type' : 'Item Label', icon: 'columns' });
  }
  protected override canDropData (position: math.Vector2, data: unknown): boolean {
    const drag = data as { tree?: unknown, column?: string }, target = this.columnAt(position.x);

    return drag?.tree === this.tree && target !== 'visibility' && target !== drag.column;
  }
  protected override dropData (position: math.Vector2, data: unknown): void {
    if (!this.canDropData(position, data)) { return; }
    this.tree.typeFirst = !this.tree.typeFirst; this.tree.list.refresh();
  }
}

export class HierarchyTree extends Container {
  readonly list: VirtualList<HierarchyNode>;
  private readonly header: Control;
  selected = new Set<string>();
  expanded = new Set<string>();
  columnRatio = .72;
  typeFirst = false;
  highlight = '';
  private rows: HierarchyNode[] = [];
  private hoverTimer?: number;
  private hoverTarget?: string;

  constructor (engine: Engine, readonly options: HierarchyOptions, readonly actions: HierarchyTreeActions) {
    super(engine); this.focusMode = FocusMode.All;
    this.header = append(this, new HierarchyHeader(engine, this));
    this.list = append(this, new VirtualList(engine, 20, node => node.id, () => new HierarchyRow(engine, this)));
  }
  get gutter (): number { return this.options.showVisibility ? 24 : 0; }
  get labelLeft (): number { return this.options.showType && this.typeFirst ? this.gutter + (this.list.content.width - this.gutter) * (1 - this.columnRatio) : this.gutter; }
  get labelRight (): number { return this.options.showType && !this.typeFirst ? this.gutter + (this.list.content.width - this.gutter) * this.columnRatio : this.list.content.width; }
  get typeLeft (): number { return this.typeFirst ? this.gutter : this.labelRight; }
  get typeRight (): number { return this.typeFirst ? this.labelLeft : this.list.content.width; }
  get divider (): number { return this.typeFirst ? this.labelLeft : this.labelRight; }
  get focused (): boolean {
    for (let c = this.root?.guiGetFocusOwner(); c; c = c.parent) { if (c === this) { return true; } }

    return false;
  }
  setRows (rows: HierarchyNode[], selection: Set<string>, expanded: Set<string>): void {
    this.rows = rows; this.selected = selection; this.expanded = expanded; this.list.setRows(rows);
  }
  reveal (id: string): void { this.list.reveal(id); }
  rename (id: string): void { this.reveal(id); (this.list.row(id) as HierarchyRow | undefined)?.startRename(); }
  nodeAt (position: math.Vector2): HierarchyNode | undefined { return this.list.hasPoint(this.list.makePositionLocal(position)) ? this.rows[Math.floor(this.list.content.makePositionLocal(position).y / 20)] : undefined; }
  expandAfterHover (node: HierarchyNode): void {
    if (this.expanded.has(node.id) || !node.children.length || this.hoverTarget === node.id) { return; }
    window.clearTimeout(this.hoverTimer); this.hoverTarget = node.id;
    this.hoverTimer = window.setTimeout(() => {
      if (this.root?.guiIsDragging() && this.nodeAt(this.root.getMousePosition())?.id === node.id && !this.expanded.has(node.id)) { this.actions.toggle(node, false); }
      this.hoverTarget = undefined;
    }, 600);
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(80, 60); }
  protected override sortChildren (): void { place(this.header, 0, 0, this.width, 26); place(this.list, 0, 26, this.width, this.height - 26); }
  override onKeyDown (event: InputEventKey): void { this.actions.key(event); }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.position.y < 26) { return; }
    this.grabFocus();
    if (event.buttonIndex === MouseButton.Right) { this.actions.context(undefined, event.globalPosition); } else if (event.buttonIndex === MouseButton.Left) { this.actions.select(undefined, event); }
    event.accept();
  }
  protected override canDropData (position: math.Vector2, data: unknown): boolean { return this.actions.canDrop(undefined, data, 'inside'); }
  protected override dropData (position: math.Vector2, data: unknown): void { this.actions.drop(undefined, data, 'inside'); }
  override onDestroy (): void { window.clearTimeout(this.hoverTimer); }
}
