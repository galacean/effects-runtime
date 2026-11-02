import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Container, SizeFlags, MouseFilter } from '@galacean/effects-plugin-gui';
import { append, place } from './layout';
import { EditorVerticalScrollContainer } from './scroll-container';
import { EDITOR_FONT, EDITOR_FONT_SIZE, editorColors } from '../theme/control-theme';

export interface ListRow<T> extends Control { bind(value: T, index: number): void }

class ListContent<T> extends Container {
  constructor (engine: Engine, private readonly list: VirtualList<T>) { super(engine); this.mouseFilter = MouseFilter.Pass; }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, this.list.length * this.list.rowHeight); }
  override getDesiredSize (): math.Vector2 { return this.getMinimumSize(); }
  protected override sortChildren (): void { this.list.layoutRows(); }
}

/** Creates row Controls for the visible range and keeps them until they leave that range. */
export class VirtualList<T> extends EditorVerticalScrollContainer {
  emptyText = '';
  readonly content: Container;
  private values: T[] = [];
  private readonly mounted = new Map<string, { control: ListRow<T>, index: number }>();

  constructor (engine: Engine, public rowHeight: number, private readonly key: (value: T) => string,
    private readonly createRow: () => ListRow<T>) {
    super(engine);
    this.content = append(this, new ListContent(engine, this));
    this.content.horizontalSizeFlags = SizeFlags.ExpandFill;
    this.getVScrollBar().on('valueChanged', () => this.layoutRows());
    this.on('sizeChanged', () => this.layoutRows());
  }
  get length (): number { return this.values.length; }
  setRows (values: readonly T[]): void {
    this.values = [...values];
    this.content.updateMinimumSize(); this.content.updateDesiredSize(); this.queueSort(); this.layoutRows();
  }
  refresh (): void { this.layoutRows(); }
  override draw (): void {
    super.draw();
    if (!this.values.length && this.emptyText) { this.drawEmpty(); }
  }
  protected drawEmpty (): void { this.drawText(8, 8, this.emptyText, EDITOR_FONT_SIZE, editorColors.muted, EDITOR_FONT); }
  reveal (id: string): void {
    const index = this.values.findIndex(value => this.key(value) === id);

    if (index < 0) { return; }
    const y = index * this.rowHeight;

    if (y < this.vScroll) { this.vScroll = y; } else if (y + this.rowHeight > this.vScroll + this.height) { this.vScroll = y + this.rowHeight - this.height; }
    this.layoutRows();
  }
  row (id: string): ListRow<T> | undefined { return this.mounted.get(id)?.control; }
  protected visibleRows (): ListRow<T>[] { return [...this.mounted.values()].map(row => row.control); }
  layoutRows (): void {
    if (this.isDisposed) { return; }
    const start = Math.max(0, Math.floor(this.vScroll / this.rowHeight) - 1);
    const end = Math.min(this.values.length, Math.ceil((this.vScroll + this.height) / this.rowHeight) + 1);
    const keep = new Set<string>();

    for (let index = start; index < end; index++) {
      const value = this.values[index], id = this.key(value);

      keep.add(id);
      let row = this.mounted.get(id);

      if (!row) { row = { control: append(this.content, this.createRow()), index }; this.mounted.set(id, row); }
      row.index = index; row.control.bind(value, index);
      place(row.control, 0, index * this.rowHeight, this.content.width, this.rowHeight);
    }
    for (const [id, row] of this.mounted) {
      if (keep.has(id)) { continue; }
      row.control.dispose(); this.mounted.delete(id);
    }
  }
}
