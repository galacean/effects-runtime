import { setTooltip } from '../controls/tooltip';
import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Container, FocusMode, Label, MouseFilter, TextOverflow, HorizontalAlignment, VerticalAlignment, ellipsizeText } from '@galacean/effects-plugin-gui';
import { append, place, screenPosition } from '../controls/layout';
import { VirtualList } from '../controls/virtual-list';
import { withDragPresentation } from '../controls/drag-feedback';
import { EditorInlineRename } from '../controls/inline-rename';
import { drawAssetIcon, type AssetIcon } from '../icons/asset-icons';
import { editorBox, editorColors as C, EDITOR_FONT, EDITOR_FONT_SIZE, EDITOR_COMPACT_FONT_SIZE, EDITOR_SMALL_FONT_SIZE, EDITOR_TINY_FONT_SIZE } from '../theme/control-theme';
import { TexturePresentation, type TexturePreview } from '../../features/assets/preview/texture-preview';
import type { SelectionModifiers } from '../list-view/list-selection';

export interface AssetViewRect { x: number, y: number, width: number, height: number }
export interface AssetViewItem {
  id: string, name: string, type: string, icon: AssetIcon, accent: math.Color,
  columns?: string[],
  tooltip?: string,
  preview?: (hovered: boolean) => { preview: TexturePreview, width: number, height: number } | undefined,
}
export interface AssetViewActions {
  selected(id: string): boolean,
  choose(id: string, modifiers: SelectionModifiers): void,
  open(id: string): void,
  context(id: string | undefined, position: math.Vector2): void,
  rename(id: string, name: string): void,
  drag(id: string): unknown,
  canDrop(id: string | undefined, data: unknown): boolean,
  drop(id: string | undefined, data: unknown, position: math.Vector2): void,
  key(event: InputEventKey): void,
  marquee?(ids: string[], additive: boolean): void,
}

export function checkerboard (control: Control, x: number, y: number, width: number, height: number, cell = 10): void {
  const colors = [new math.Color(.196, .196, .196, 1), new math.Color(.153, .153, .153, 1)];

  for (let row = 0; row < Math.ceil(height / cell); row++) {
    for (let column = 0; column < Math.ceil(width / cell); column++) {
      control.fillRect(x + column * cell, y + row * cell, Math.min(cell, width - column * cell), Math.min(cell, height - row * cell), colors[(row + column) % 2]);
    }
  }
}

class AssetNameLabel extends Label {
  private source = '';
  private maximumLines = 1;
  private layoutKey = '';
  constructor (engine: Engine) { super(engine); this.textOverflow = TextOverflow.Ellipsis; this.on('sizeChanged', () => this.refreshText()); }
  setName (text: string, lines: number): void { this.source = text; this.maximumLines = lines; this.refreshText(); }
  protected override onThemeChanged (affectsLayout: boolean): void { super.onThemeChanged(affectsLayout); if (affectsLayout && this.source !== undefined) { this.layoutKey = ''; this.refreshText(); } }
  private refreshText (): void {
    const font = this.getThemeFont('font'), size = this.getThemeFontSize('fontSize');
    const key = [this.source, this.maximumLines, this.width, font.family, font.weight, font.style, size].join('\0');

    if (key === this.layoutKey) { return; }
    this.layoutKey = key;
    const measure = (text: string) => this.measureText(text, size, font.family, font.weight, font.style);
    const lines: string[] = [];
    let remaining = this.source;

    for (let line = 0; line < this.maximumLines && remaining; line++) {
      if (line === this.maximumLines - 1) {
        lines.push(ellipsizeText(remaining, this.width, measure));

        break;
      }
      const prefix = ellipsizeText(remaining, this.width, measure, '');

      if (prefix.length === remaining.length) {
        lines.push(remaining);

        break;
      }
      if (!prefix) { break; }
      const space = prefix.lastIndexOf(' '), end = space > prefix.length / 2 ? space : prefix.length;

      lines.push(remaining.slice(0, end).trimEnd()); remaining = remaining.slice(end).trimStart();
    }
    this.text = lines.join('\n');
  }
}

export class AssetCell extends Container {
  private assetItem!: AssetViewItem;
  private readonly caption: AssetNameLabel;
  private readonly typeLabel: Label;
  private readonly presentation: TexturePresentation;
  private renameEdit?: EditorInlineRename;
  private hovered = false;
  private captionColor = C.foreground;
  private dropTarget = false;
  private deferred?: SelectionModifiers;
  private imageSize?: math.Vector2;
  private detailLabels: Label[] = [];
  get assetId (): string { return this.assetItem.id; }
  constructor (engine: Engine, readonly view: AssetView) {
    super(engine); this.focusMode = FocusMode.All;
    this.caption = append(this, new AssetNameLabel(engine));
    this.typeLabel = append(this, new Label(engine)); this.typeLabel.textOverflow = TextOverflow.Ellipsis; this.typeLabel.verticalAlignment = VerticalAlignment.Center;
    this.typeLabel.setThemeColorOverride('fontColor', C.muted);
    this.presentation = new TexturePresentation(engine);
  }
  bind (item: AssetViewItem): void {
    this.assetItem = item; setTooltip(this, item.tooltip ?? item.name + '\n' + item.type); this.caption.setName(item.name, this.view.mode === 'tiles' ? this.view.nameLines : 1); this.typeLabel.text = item.type;
    if (this.caption.getThemeFontSize('fontSize') !== this.view.nameFontSize) { this.caption.setThemeFontSizeOverride('fontSize', this.view.nameFontSize); }
    const typeSize = this.view.mode === 'tiles' ? EDITOR_TINY_FONT_SIZE : EDITOR_FONT_SIZE;

    if (this.typeLabel.getThemeFontSize('fontSize') !== typeSize) { this.typeLabel.setThemeFontSizeOverride('fontSize', typeSize); }
    this.caption.horizontalAlignment = this.view.mode === 'tiles' && item.icon === 'folder' ? HorizontalAlignment.Center : HorizontalAlignment.Left;
    this.caption.verticalAlignment = this.view.mode === 'tiles' || this.view.mode === 'list' && item.icon !== 'folder' ? VerticalAlignment.Top : VerticalAlignment.Center;
    while (this.detailLabels.length < (item.columns?.length ?? 0)) { this.detailLabels.push(append(this, new Label(this.engine))); }
    this.detailLabels.forEach((label, i) => { label.text = item.columns?.[i] ?? ''; label.textOverflow = TextOverflow.Ellipsis; label.verticalAlignment = VerticalAlignment.Center; label.visible = this.view.mode === 'columns'; });
    this.queueSort();
  }
  rename (): void {
    if (this.renameEdit) { return; }
    const edit = this.renameEdit = append(this, new EditorInlineRename(this.engine));

    edit.setThemeFontSizeOverride('fontSize', this.view.nameFontSize);
    edit.text = this.assetItem.name; edit.finish = cancel => this.finishRename(cancel);
    edit.on('textSubmitted', () => edit.finish?.(false));
    this.queueSort(); edit.grabFocus(); edit.selectAll();
  }
  takeRename (): EditorInlineRename | undefined {
    const edit = this.renameEdit;

    if (!edit) { return; }
    this.renameEdit = undefined; edit.finish = undefined; edit.parent = null;

    return edit;
  }
  restoreRename (edit: EditorInlineRename): void {
    this.renameEdit = append(this, edit); edit.finish = cancel => this.finishRename(cancel); this.queueSort(); edit.grabFocus();
  }
  private finishRename (cancel: boolean): void {
    const edit = this.renameEdit;

    if (!edit) { return; }
    this.renameEdit = undefined; edit.finish = undefined;
    const text = edit.text.trim();

    edit.dispose(); if (!cancel && text && text !== this.assetItem.name) { this.view.actions.rename(this.assetItem.id, text); }
    if (!this.isDisposed && this.visibleInHierarchy) { this.grabFocus(); }
  }
  protected override sortChildren (): void {
    const tile = this.view.mode === 'tiles', nameColumn = this.view.columnBounds(-1, this.width);
    const detailed = this.view.mode === 'list' && this.assetItem.icon !== 'folder';
    const y = tile ? this.width + 4 : detailed ? 5 : 4, x = tile ? 7 : this.height + 4 + (this.view.mode === 'columns' ? nameColumn.x : 0);
    const nameWidth = this.view.mode === 'columns' ? nameColumn.width - this.height - 8 : this.width - x - 7;

    place(this.caption, x, y, nameWidth, tile ? this.view.nameLines * this.view.textLineHeight : detailed ? this.view.textLineHeight : this.height - 8);
    this.typeLabel.visible = (tile || detailed) && this.assetItem.icon !== 'folder';
    if (tile) { place(this.typeLabel, 7, this.height - 19, this.width - 14, 18); } else if (detailed) {
      place(this.typeLabel, x, y + this.view.textLineHeight + 2, nameWidth, this.height - y - this.view.textLineHeight - 4);
    }
    this.detailLabels.forEach((label, i) => {
      const bounds = this.view.columnBounds(i, this.width);

      place(label, bounds.x + 4, 4, bounds.width - 8, this.height - 8);
    });
    if (this.renameEdit) { place(this.renameEdit, x, y, nameWidth, 24); }
  }
  override update (dt: number): void {
    if (!this.root?.guiIsDragging()) { this.dropTarget = false; }
    if (this.assetItem) {
      const captionColor = this.view.actions.selected(this.assetItem.id) || this.hovered ? C.foregroundHover : C.foreground;

      if (captionColor !== this.captionColor) { this.captionColor = captionColor; this.caption.setThemeColorOverride('fontColor', captionColor); }
      const image = this.assetItem.preview?.(this.hovered);

      this.imageSize = image ? new math.Vector2(image.width, image.height) : undefined;
      this.presentation.update(image?.preview, undefined, 256);
    }
    super.update(dt);
  }
  override draw (): void {
    if (!this.assetItem) { return; }
    const selected = this.view.actions.selected(this.assetItem.id), tile = this.view.mode === 'tiles';
    const folder = this.assetItem.icon === 'folder', active = selected && this.view.focused;
    const background = this.dropTarget ? C.selectedInactive : selected ? active ? this.hovered ? C.primaryHover : C.primary : C.selectedInactive : this.hovered ? C.hover : C.secondary;

    if (tile) {
      this.drawStyleBox(editorBox(folder ? selected || this.hovered ? C.secondary : C.clear : background, 0, 4), 0, 0, this.width, this.height);
      if (!folder) {
        const thumbnail = editorBox(C.recessed, 0, 4);

        thumbnail.setCornerRadii(4, 4, 0, 0); this.drawStyleBox(thumbnail, 2, 2, this.width - 4, this.width - 4);
      }
    } else { this.fillRect(0, 0, this.width, this.height, selected ? background : this.hovered ? C.secondary : C.recessed); }
    const inset = tile ? 2 : 4, w = tile ? this.width - 4 : this.height - 8, h = w;
    const x = inset + (this.view.mode === 'columns' ? this.view.columnBounds(-1, this.width).x : 0), y = inset;

    if (this.imageSize) {
      const scale = Math.min(w / this.imageSize.x, h / this.imageSize.y), iw = this.imageSize.x * scale, ih = this.imageSize.y * scale;
      const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;

      checkerboard(this, ix, iy, iw, ih, 8); this.presentation.draw(this, ix, iy, iw, ih);
    } else {
      const size = Math.min(w, h) * (tile ? folder ? .9 : .72 : 1);

      drawAssetIcon(this, this.assetItem.icon, x + (w - size) / 2, y + (h - size) / 2, size);
    }
    if (tile && !folder) { this.fillRect(2, this.width - 2, this.width - 4, 3, this.assetItem.accent); }
    if (selected || this.hovered || this.dropTarget) { this.drawStyleBox(editorBox(C.clear, 0, 4, selected ? this.hovered ? C.primaryHover : C.primary : C.hover), 0, 0, this.width, this.height); }

  }
  override onMouseEnter (): void { this.hovered = true; }
  override onMouseLeave (): void { this.hovered = this.dropTarget = false; }
  override onMouseDown (event: InputEventMouseButton): void {
    this.grabFocus();
    if (event.buttonIndex === MouseButton.Right) {
      if (!this.view.actions.selected(this.assetItem.id)) { this.view.actions.choose(this.assetItem.id, {}); }
      this.view.actions.context(this.assetItem.id, event.globalPosition);
    } else if (event.buttonIndex === MouseButton.Left) {
      const modifiers = { additive: event.ctrlPressed || event.metaPressed, range: event.shiftPressed };

      if (this.view.actions.selected(this.assetItem.id) && !modifiers.additive && !modifiers.range) { this.deferred = modifiers; } else { this.view.actions.choose(this.assetItem.id, modifiers); }
      if (event.doubleClick) { this.view.actions.open(this.assetItem.id); }
    }
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (this.deferred && !event.canceled && this.hasPoint(event.position)) { this.view.actions.choose(this.assetItem.id, this.deferred); }
    this.deferred = undefined; event.accept();
  }
  override onKeyDown (event: InputEventKey): void { this.view.actions.key(event); }
  protected override getDragData (): unknown {
    this.deferred = undefined;

    const data = this.view.actions.drag(this.assetItem.id), count = (data as { data?: { ids?: string[] } })?.data?.ids?.length ?? 1;

    return withDragPresentation(data, { label: this.assetItem.name, asset: this.assetItem, count });
  }
  protected override canDropData (_position: math.Vector2, data: unknown): boolean { return this.dropTarget = this.view.actions.canDrop(this.assetItem.id, data); }
  protected override dropData (position: math.Vector2, data: unknown): void { this.dropTarget = false; this.view.actions.drop(this.assetItem.id, data, screenPosition(this, this.getLocalMousePosition().x, this.getLocalMousePosition().y)); }
  override onDestroy (): void { this.presentation.dispose(); super.onDestroy(); }
}

class AssetRow extends Container {
  private cells: AssetCell[] = [];
  constructor (engine: Engine, readonly view: AssetView) { super(engine); this.mouseFilter = MouseFilter.Pass; }
  bind (items: AssetViewItem[]): void {
    while (this.cells.length > items.length) { this.cells.pop()!.dispose(); }
    while (this.cells.length < items.length) { this.cells.push(append(this, new AssetCell(this.engine, this.view))); }
    items.forEach((item, i) => this.cells[i].bind(item)); this.queueSort();
  }
  cell (index: number): AssetCell | undefined { return this.cells[index]; }
  get visibleCells (): readonly AssetCell[] { return this.cells; }
  protected override sortChildren (): void {
    const width = this.view.mode === 'tiles' ? this.view.tileSize + 16 : this.width;

    this.cells.forEach((cell, index) => place(cell, index * (width + 8), 0, width, this.view.rowHeight - (this.view.mode === 'tiles' ? 8 : 0)));
  }
}

export class AssetView extends VirtualList<AssetViewItem[]> {
  mode: 'tiles' | 'list' | 'columns' = 'tiles';
  tileSize = 96;
  columns = 1;
  private items: AssetViewItem[] = [];
  private lastLayout = '';
  override emptyText = 'No assets found';
  importHighlight?: AssetViewRect;
  selectionScope?: Control;
  private marqueeDrag?: { start: math.Vector2, end: math.Vector2, initial: string[] };
  columnLayout = [{ index: -1, fraction: .375 }, { index: 0, fraction: .125 }, { index: 1, fraction: .15 }, { index: 2, fraction: .125 }, { index: 3, fraction: .225 }];
  constructor (engine: Engine, readonly actions: AssetViewActions) {
    super(engine, 168, items => items.map(item => item.id).join(','), () => new AssetRow(engine, this));
    this.focusMode = FocusMode.All;
    this.on('sizeChanged', () => this.reflow());
  }
  get focused (): boolean {
    for (let current = this.root?.guiGetFocusOwner(); current; current = current.parent) { if (current === this || current === this.selectionScope) { return true; } }

    return false;
  }
  get nameLines (): number { return this.tileSize < 72 ? 1 : this.tileSize < 144 ? 2 : this.tileSize < 192 ? 3 : 4; }
  get nameFontSize (): number { return this.mode === 'tiles' ? this.tileSize < 50 ? EDITOR_TINY_FONT_SIZE : this.tileSize < 85 ? EDITOR_SMALL_FONT_SIZE : EDITOR_COMPACT_FONT_SIZE : this.mode === 'list' ? EDITOR_COMPACT_FONT_SIZE : EDITOR_FONT_SIZE; }
  get textLineHeight (): number {
    const font = this.getThemeFont('font');

    return this.measureText('M', this.nameFontSize, font.family, font.weight, font.style).lineHeight;
  }
  setItems (items: AssetViewItem[]): void { this.items = items; this.reflow(true); }
  configure (mode: typeof this.mode, size: number): void { this.mode = mode; this.tileSize = size; this.reflow(); }
  private reflow (force = false): void {
    const columns = this.mode === 'tiles' ? Math.max(1, Math.floor((this.width - 14 + 8) / (this.tileSize + 24))) : 1;
    const signature = [columns, this.mode, this.tileSize].join(':');

    if (!force && signature === this.lastLayout) { return; }
    this.lastLayout = signature; this.columns = columns; this.rowHeight = this.mode === 'tiles' ? Math.ceil(this.tileSize + 52 + this.nameLines * this.textLineHeight) : this.mode === 'list' ? 50 : 28;
    const rows: AssetViewItem[][] = [];

    for (let i = 0; i < this.items.length; i += columns) { rows.push(this.items.slice(i, i + columns)); }
    const focused = this.root?.guiGetFocusOwner();
    let cell: AssetCell | undefined;

    for (let control = focused; control && control !== this; control = control.parent) {
      if (control instanceof AssetCell && control.view === this) {
        cell = control;

        break;
      }
    }
    const nextRow = cell && rows.find(row => row.some(item => item.id === cell.assetId));
    const changedRow = cell && nextRow && nextRow.map(item => item.id).join(',') !== (cell.parent as AssetRow).visibleCells.map(cell => cell.assetId).join(',');
    const rename = changedRow ? cell!.takeRename() : undefined;

    this.setRows(rows);
    if (cell && (rename || focused?.isDisposed || !this.root?.guiGetFocusOwner())) {
      if (nextRow) {
        this.revealAsset(cell.assetId);
        if (rename) { this.cellForAsset(cell.assetId)?.restoreRename(rename); }
      } else { this.grabFocus(); }
    }
  }
  private cellForAsset (id: string): AssetCell | undefined {
    const index = this.items.findIndex(item => item.id === id), start = Math.floor(index / this.columns) * this.columns;
    const key = this.items.slice(start, start + this.columns).map(item => item.id).join(',');

    return index < 0 ? undefined : (this.row(key) as AssetRow | undefined)?.cell(index % this.columns);
  }
  revealAsset (id: string, rename = false, focus = true): void {
    const index = this.items.findIndex(item => item.id === id);

    if (index < 0) { return; }
    const start = Math.floor(index / this.columns) * this.columns, key = this.items.slice(start, start + this.columns).map(item => item.id).join(',');

    this.reveal(key);
    const cell = this.cellForAsset(id);

    if (rename) { cell?.rename(); } else if (focus) { cell?.grabFocus(); }
  }
  visibleItemRects (): { id: string, rect: AssetViewRect }[] {
    const origin = screenPosition(this);

    return this.visibleRows().flatMap(row => (row as AssetRow).visibleCells.flatMap(cell => {
      const position = screenPosition(cell), top = Math.max(origin.y, position.y), bottom = Math.min(origin.y + this.height, position.y + cell.height);

      return bottom > top ? [{ id: cell.assetId, rect: { x: position.x, y: top, width: cell.width, height: bottom - top } }] : [];
    }));
  }
  override onKeyDown (event: InputEventKey): void { this.actions.key(event); }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Right) { this.actions.context(undefined, event.globalPosition); event.accept(); } else if (event.buttonIndex === MouseButton.Left && this.actions.marquee) {
      this.grabFocus(); const point = new math.Vector2(event.position.x, event.position.y + this.vScroll);
      const initial = event.ctrlPressed || event.metaPressed || event.shiftPressed ? this.items.filter(item => this.actions.selected(item.id)).map(item => item.id) : [];

      this.marqueeDrag = { start: point, end: point.clone(), initial }; this.actions.marquee(initial, false); event.accept();
    } else { this.grabFocus(); super.onMouseDown(event); }
  }
  columnBounds (index: number, width = this.content.width): { x: number, width: number } {
    let x = 0; const total = this.columnLayout.reduce((sum, column) => sum + column.fraction, 0);

    for (const column of this.columnLayout) {
      const size = width * column.fraction / total;

      if (column.index === index) { return { x, width: size }; } x += size;
    }

    return { x: 0, width };
  }
  columnsChanged (): void { this.refresh(); }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.marqueeDrag) {
      super.onMouseMove(event);

      return;
    }
    const drag = this.marqueeDrag;

    drag.end.set(event.position.x, event.position.y + this.vScroll);
    const left = Math.min(drag.start.x, drag.end.x), right = Math.max(drag.start.x, drag.end.x), top = Math.min(drag.start.y, drag.end.y), bottom = Math.max(drag.start.y, drag.end.y);
    const ids = this.items.filter((_item, index) => {
      const x = this.mode === 'tiles' ? index % this.columns * (this.tileSize + 24) : 0, y = Math.floor(index / this.columns) * this.rowHeight; const width = this.mode === 'tiles' ? this.tileSize + 16 : this.width;

      return x < right && x + width > left && y < bottom && y + this.rowHeight - 8 > top;
    }).map(item => item.id);

    this.actions.marquee?.([...new Set([...drag.initial, ...ids])], false); event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (this.marqueeDrag) { if (event.canceled) { this.actions.marquee?.(this.marqueeDrag.initial, false); } this.marqueeDrag = undefined; event.accept(); } else { super.onMouseUp(event); }
  }
  protected override drawChildren (): void {
    super.drawChildren();
    if (this.importHighlight) {
      const origin = screenPosition(this), rect = this.importHighlight;

      this.drawRect(rect.x - origin.x, rect.y - origin.y, rect.width, rect.height, C.primary, 2);
    }
    const drag = this.marqueeDrag;

    if (drag) {
      const x = Math.min(drag.start.x, drag.end.x), y = Math.min(drag.start.y, drag.end.y) - this.vScroll, w = Math.abs(drag.start.x - drag.end.x), h = Math.abs(drag.start.y - drag.end.y);

      this.fillRect(x, y, w, h, new math.Color(0, .44, .88, .15)); this.drawRect(x, y, w, h, C.primary);
    }
  }
  protected override drawEmpty (): void {
    const size = this.measureText(this.emptyText, EDITOR_FONT_SIZE, EDITOR_FONT);

    this.drawText(Math.max(8, (this.width - size.width) / 2), Math.max(8, (this.height - size.lineHeight) / 2), this.emptyText, EDITOR_FONT_SIZE, C.muted, EDITOR_FONT);
  }
  protected override canDropData (_position: math.Vector2, data: unknown): boolean { return this.actions.canDrop(undefined, data); }
  protected override dropData (_position: math.Vector2, data: unknown): void { this.actions.drop(undefined, data, screenPosition(this, this.getLocalMousePosition().x, this.getLocalMousePosition().y)); }
}
