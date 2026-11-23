import { MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion, math } from '@galacean/effects';
import { Button, Container, Control, HorizontalAlignment } from '@galacean/effects-plugin-gui';
import { withDragPresentation } from '../controls/drag-feedback';
import { append, place } from '../controls/layout';
import { editorColors } from '../theme/control-theme';
import type { AssetView } from './asset-view';

export interface AssetColumn { label: string, sort?: string }
class ColumnButton extends Button {
  constructor (engine: Engine, readonly header: AssetColumns, readonly index: number, definition: AssetColumn) {
    super(engine, definition.label); this.themeTypeVariation = 'EditorColumnHeader'; this.textAlignment = HorizontalAlignment.Left; this.clipText = true;
    this.on('pressed', () => { if (definition.sort) { header.sort(definition.sort); } });
  }
  protected override drawDecoration (): void { this.fillRect(this.width - 1, 0, 1, this.height, editorColors.recessed); }
  protected override getDragData (): unknown { return withDragPresentation({ header: this.header, index: this.index }, { label: this.text, icon: 'columns' }); }
  protected override canDropData (_position: math.Vector2, data: unknown): boolean { return (data as { header?: unknown })?.header === this.header; }
  protected override dropData (_position: math.Vector2, data: unknown): void {
    const index = (data as { index: number }).index, layout = this.header.view.columnLayout, source = layout.findIndex(column => column.index === index), target = layout.findIndex(column => column.index === this.index);

    if (source < 0 || target < 0) { return; }
    layout.splice(target, 0, layout.splice(source, 1)[0]); this.header.columnsChanged();
  }
}
class ColumnResize extends Control {
  private start?: { x: number, fraction: number };
  constructor (engine: Engine, private readonly header: AssetColumns, private readonly index: number) { super(engine); this.defaultCursorShape = 'ew-resize'; }
  override onMouseDown (event: InputEventMouseButton): void {
    const column = this.header.view.columnLayout.find(column => column.index === this.index);

    if (event.buttonIndex === MouseButton.Left && column) { this.start = { x: event.globalPosition.x, fraction: column.fraction }; event.accept(); }
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.start) { return; }
    const layout = this.header.view.columnLayout, column = layout.find(column => column.index === this.index)!;

    column.fraction = Math.max(.06, this.start.fraction + (event.globalPosition.x - this.start.x) / Math.max(1, this.header.width)); this.header.columnsChanged(); event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void { this.start = undefined; event.accept(); }
}

export class AssetColumns extends Container {
  private readonly controls: { index: number, button: Button, handle: Control }[] = [];
  constructor (engine: Engine, readonly view: AssetView, definitions: AssetColumn[], readonly sort: (key: string) => void) {
    super(engine); this.setCustomMinimumSize(0, 26);
    definitions.forEach((definition, ordinal) => {
      const index = ordinal - 1;

      this.controls.push({ index, button: append(this, new ColumnButton(engine, this, index, definition)), handle: append(this, new ColumnResize(engine, this, index)) });
    });
  }
  columnsChanged (): void { this.queueSort(); this.view.columnsChanged(); }
  protected override sortChildren (): void {
    for (const { index, button, handle } of this.controls) {
      const bounds = this.view.columnBounds(index, this.view.content.width || this.width);

      place(button, bounds.x, 0, bounds.width, this.height); place(handle, bounds.x + bounds.width - 3, 0, 6, this.height);
    }
  }
}
