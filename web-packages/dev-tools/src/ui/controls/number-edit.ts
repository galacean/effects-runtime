import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion, InputEventKey } from '@galacean/effects';
import type { LineEdit } from '@galacean/effects-plugin-gui';
import { Button, Container, HorizontalAlignment, FocusMode } from '@galacean/effects-plugin-gui';
import { editorColors } from '../theme/control-theme';
import { append, place } from './layout';
import { EditorTextField } from './text-field';

function inputScale (event: { shiftPressed: boolean, ctrlPressed: boolean, metaPressed: boolean, altPressed: boolean }): number {
  if (event.shiftPressed) { return event.altPressed ? 100 : 10; }
  if (event.ctrlPressed || event.metaPressed) { return event.altPressed ? .01 : .1; }

  return 1;
}

class NumberDragButton extends Button {
  dragging = false;
  private startX = 0;
  private previousX = 0;
  private startValue = 0;
  private moved = false;

  constructor (engine: Engine, private readonly field: NumberEdit) {
    super(engine);
    this.themeTypeVariation = 'EditorNumericField';
    this.textAlignment = HorizontalAlignment.Left;
    this.clipText = true;
    this.defaultCursorShape = 'ew-resize';
  }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    if (event.doubleClick) {
      this.field.startTextEdit(); event.accept();

      return;
    }
    super.onMouseDown(event);
    this.moved = false; this.dragging = true; this.previousX = this.startX = event.globalPosition.x; this.startValue = this.field.value;
    this.field.beginEdit?.();
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    super.onMouseMove(event);
    if (!this.dragging) { return; }
    const delta = event.globalPosition.x - this.startX;

    this.moved ||= Math.abs(delta) > 3;
    if (!this.moved) { return; }
    const movement = event.globalPosition.x - this.previousX;

    this.previousX = event.globalPosition.x;
    this.field.changeValue(this.field.value + movement * this.field.step * inputScale(event));
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    super.onMouseUp(event);
    if (event.buttonIndex !== MouseButton.Left || !this.dragging) { return; }
    this.dragging = false;
    if (event.canceled) { this.field.changeValue(this.startValue); }
    this.field.endEdit?.(event.canceled);
    if (!event.canceled && !this.moved) { this.field.startTextEdit(); }
    event.accept();
  }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape' && this.dragging) {
      this.dragging = false; this.field.changeValue(this.startValue); this.field.endEdit?.(true); event.accept();
    } else if (event.keycode === 'Enter' || event.keycode === ' ') { this.field.startTextEdit(); event.accept(); } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.keycode)) {
      this.field.beginEdit?.();
      this.field.changeValue(this.field.value + (event.keycode === 'ArrowLeft' || event.keycode === 'ArrowDown' ? -1 : 1) * this.field.step);
      this.field.endEdit?.(); event.accept();
    } else { super.onKeyDown(event); }
  }
}

class NumberLineEdit extends EditorTextField {
  constructor (engine: Engine, private readonly field: NumberEdit) { super(engine); }
  override onLostFocus (): void { super.onLostFocus(); this.field.finishTextEdit(); }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape') { this.field.finishTextEdit(true); this.field.dragButton.grabFocus(); event.accept(); } else { super.onKeyDown(event); }
  }
}

/** A native value control with one edit transaction per pointer gesture or text edit. */
export class NumberEdit extends Container {
  readonly dragButton: Button;
  readonly lineEdit: LineEdit;
  step = .03;
  minimum = -Infinity;
  maximum = Infinity;
  precision = 3;
  suffix = '';
  axis?: number;
  beginEdit?: () => void;
  changed?: (value: number) => void;
  endEdit?: (canceled?: boolean) => void;
  private currentValue = 0;
  private editing = false;
  private beforeEdit = 0;

  constructor (engine: Engine, value = 0) {
    super(engine);
    this.dragButton = append(this, new NumberDragButton(engine, this));
    this.lineEdit = append(this, new NumberLineEdit(engine, this));
    this.lineEdit.visible = false; this.lineEdit.themeTypeVariation = 'EditorNumericInput';
    this.lineEdit.on('textSubmitted', () => { this.finishTextEdit(); this.dragButton.grabFocus(); });
    this.value = value;
  }
  get value (): number { return this.currentValue; }
  set value (value: number) {
    if (!Number.isFinite(value)) { return; }
    this.currentValue = value;
    this.dragButton.text = value.toFixed(this.precision) + this.suffix;
    if (!this.editing) { this.lineEdit.text = String(value); }
  }
  get isEditing (): boolean { return this.editing || (this.dragButton as NumberDragButton).dragging; }
  changeValue (value: number): void {
    const next = Math.max(this.minimum, Math.min(this.maximum, value));

    if (!Number.isFinite(next) || next === this.value) { return; }
    this.value = next; this.changed?.(next);
  }
  startTextEdit (): void {
    if (this.editing) { return; }
    this.beforeEdit = this.value; this.editing = true; this.beginEdit?.();
    this.lineEdit.text = String(this.value); this.lineEdit.visible = true;
    this.dragButton.visible = false; this.lineEdit.grabFocus(); this.lineEdit.selectAll();
  }
  finishTextEdit (cancel = false): void {
    if (!this.editing) { return; }
    this.editing = false;
    if (!cancel && this.lineEdit.text.trim()) { this.changeValue(Number(this.lineEdit.text)); }
    if (cancel) { this.changeValue(this.beforeEdit); }
    this.dragButton.visible = true; this.lineEdit.visible = false;
    this.lineEdit.text = String(this.value); this.endEdit?.(cancel);
  }
  override onMouseWheel (event: InputEventMouseButton): void {
    if ((this.dragButton as NumberDragButton).dragging || (!this.dragButton.hasFocus() && !this.lineEdit.hasFocus())) { return; }
    if (event.buttonIndex !== MouseButton.WheelUp && event.buttonIndex !== MouseButton.WheelDown) { return; }
    if (this.editing) { this.finishTextEdit(); this.dragButton.grabFocus(); }
    this.beginEdit?.();
    this.changeValue(this.value + (event.buttonIndex === MouseButton.WheelUp ? 1 : -1) * this.step * inputScale(event));
    this.endEdit?.(); event.accept();
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(24, 22); }
  protected override sortChildren (): void {
    place(this.dragButton, 0, 0, this.width, this.height);
    place(this.lineEdit, 0, 0, this.width, this.height);
  }
  protected override drawChildren (): void {
    super.drawChildren();
    if (this.axis !== undefined) { this.fillRect(2, 4, 2, Math.max(0, this.height - 8), editorColors.axes[this.axis]); }
  }
}
