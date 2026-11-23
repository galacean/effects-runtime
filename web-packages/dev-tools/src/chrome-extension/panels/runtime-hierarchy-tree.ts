import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion, InputEventKey } from '@galacean/effects';
import { Container, Control, FocusMode, MouseFilter, ellipsizeText } from '@galacean/effects-plugin-gui';
import { VirtualList } from '../../ui/controls/virtual-list';
import { withDragPresentation } from '../../ui/controls/drag-feedback';
import { setTooltip } from '../../ui/controls/tooltip';
import { append, place } from '../../ui/controls/layout';
import { paintIcon } from '../../ui/icons/control-icons';
import type { EditorIcon } from '../../ui/icons/control-icons';
import { EDITOR_FONT, EDITOR_FONT_SIZE, editorColors as C } from '../../ui/theme/control-theme';

export interface RuntimeHierarchyNode {
  id: string, label: string, type: string, icon: EditorIcon, kind: 'level' | 'item',
  parent?: RuntimeHierarchyNode, children: RuntimeHierarchyNode[], active: boolean, visible: boolean,
  depth: number,
}
export interface RuntimeHierarchyOptions {
  showVisibility: boolean, showType: boolean, sort: 'hierarchy' | 'label' | 'type' | 'visibility', descending: boolean,
}
export interface RuntimeHierarchyActions {
  select(node: RuntimeHierarchyNode | undefined, event: InputEventMouseButton): void,
  toggle(node: RuntimeHierarchyNode, recursive: boolean): void,
  context(node: RuntimeHierarchyNode | undefined, position: math.Vector2): void,
  activate(node: RuntimeHierarchyNode): void,
  visibility(node: RuntimeHierarchyNode, begin: boolean): void,
  finishVisibility(): void,
  key(event: InputEventKey): void,
  sort(column: 'visibility' | 'label' | 'type'): void,
}

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
  node: RuntimeHierarchyNode;
  index = 0;
  private get hovered (): boolean { return this.tree.nodeAt(this.root?.getMousePosition() ?? new math.Vector2(-1, -1))?.id === this.node.id; }
  private deferred?: InputEventMouseButton;
  private visibilityGesture = false;

  constructor (engine: Engine, private readonly tree: RuntimeHierarchyTree) {
    super(engine); this.mouseFilter = MouseFilter.Stop; this.focusMode = FocusMode.Click;
    this.clipContents = true;
  }
  bind (node: RuntimeHierarchyNode, index: number): void { this.node = node; this.index = index; }
  private get indent (): number { return this.tree.labelLeft + 10 + this.node.depth * 12; }
  override draw (): void {
    const selected = this.tree.selected.has(this.node.id), parent = !!this.node.children.length;
    const background = selected ? this.tree.focused ? C.primary : C.selectedInactive :
      this.hovered ? C.panel : this.index % 2 ? C.background : C.recessed;
    const tint = selected ? C.foregroundHover : !this.node.active ? C.muted : C.foreground;

    this.fillRect(0, 0, this.width, this.height, background);
    if (this.tree.options.showVisibility && this.node.kind !== 'level' && (this.hovered || selected || !this.node.visible)) {
      paintIcon(this, this.node.visible ? 'view' : 'hidden', 4, (this.height - 16) / 2, 16, tint);
    }
    const indent = this.indent, expanded = this.tree.expanded.has(this.node.id);

    if (parent) {
      if (expanded) { this.fillTriangle(indent, 7, indent + 8, 7, indent + 4, 12, tint); } else { this.fillTriangle(indent + 2, 5, indent + 7, 10, indent + 2, 15, tint); }
    }
    paintIcon(this, this.node.icon, indent + 13, (this.height - 16) / 2, 16, tint);
    const textX = indent + 33;

    paintText(this, this.node.label, textX, 0, this.tree.labelRight - textX - 4, tint, this.tree.highlight);
    if (this.tree.options.showType) { paintText(this, this.node.type, this.tree.typeLeft + 6, 0, this.tree.typeRight - this.tree.typeLeft - 10, selected ? tint : C.muted); }
  }
  override onMouseDown (event: InputEventMouseButton): void {
    this.tree.grabFocus();
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
  override onDestroy (): void {
    if (this.visibilityGesture) { this.visibilityGesture = false; this.tree.actions.finishVisibility(); }
    super.onDestroy();
  }
}

class HierarchyHeader extends Control {
  private resizing = false;
  private pressedColumn?: 'visibility' | 'label' | 'type';
  private dragging = false;
  constructor (engine: Engine, private readonly tree: RuntimeHierarchyTree) {
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

export class RuntimeHierarchyTree extends Container {
  readonly list: VirtualList<RuntimeHierarchyNode>;
  private readonly header: Control;
  selected = new Set<string>();
  expanded = new Set<string>();
  columnRatio = .72;
  typeFirst = false;
  highlight = '';
  private rows: RuntimeHierarchyNode[] = [];

  constructor (engine: Engine, readonly options: RuntimeHierarchyOptions, readonly actions: RuntimeHierarchyActions) {
    super(engine); this.focusMode = FocusMode.All;
    this.header = append(this, new HierarchyHeader(engine, this));
    this.list = append(this, new VirtualList(engine, 20, node => node.id, () => new HierarchyRow(engine, this)));
    this.list.mouseFilter = MouseFilter.Pass;
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
  setRows (rows: RuntimeHierarchyNode[], selection: Set<string>, expanded: Set<string>): void {
    this.rows = rows; this.selected = selection; this.expanded = expanded; this.list.setRows(rows);
  }
  reveal (id: string): void { this.list.reveal(id); }
  nodeAt (position: math.Vector2): RuntimeHierarchyNode | undefined { return this.list.hasPoint(this.list.makePositionLocal(position)) ? this.rows[Math.floor(this.list.content.makePositionLocal(position).y / 20)] : undefined; }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(80, 60); }
  protected override sortChildren (): void { place(this.header, 0, 0, this.width, 26); place(this.list, 0, 26, this.width, this.height - 26); }
  override onKeyDown (event: InputEventKey): void { this.actions.key(event); }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.position.y < 26) { return; }
    this.grabFocus();
    if (event.buttonIndex === MouseButton.Right) { this.actions.context(undefined, event.globalPosition); } else if (event.buttonIndex === MouseButton.Left) { this.actions.select(undefined, event); }
    event.accept();
  }
}
