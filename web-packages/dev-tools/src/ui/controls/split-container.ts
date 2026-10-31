import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventMouseButton, InputEventMouseMotion } from '@galacean/effects';
import { Container, Control, MouseFilter } from '@galacean/effects-plugin-gui';
import { editorColors, editorMetrics } from '../theme/control-theme';
import { append, place } from './layout';

class SplitHandle extends Control {
  private dragging = false;
  private hovered = false;

  constructor (engine: Engine, private readonly split: EditorSplitContainer) {
    super(engine);
    this.mouseFilter = MouseFilter.Stop;
    this.defaultCursorShape = split.vertical ? 'ns-resize' : 'ew-resize';
  }

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, this.dragging || this.hovered ? editorColors.primary : editorColors.recessed);
  }
  override onMouseEnter (): void { this.hovered = true; }
  override onMouseLeave (): void { this.hovered = false; }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) { this.dragging = true; event.accept(); }
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.dragging) { return; }
    const p = this.split.getLocalMousePosition();
    const length = this.split.vertical ? this.split.height : this.split.width;

    this.split.ratio = (this.split.vertical ? p.y : p.x) / Math.max(1, length);
    this.split.changed?.(this.split.ratio);
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) { this.dragging = false; event.accept(); }
  }
}

/** A persistent editor split. Its children are laid out only when their bounds change. */
export class EditorSplitContainer extends Container {
  readonly handle: Control;
  changed?: (ratio: number) => void;
  private splitRatio = .5;

  constructor (engine: Engine, readonly first: Control, readonly second: Control, readonly vertical = false, ratio = .5) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
    append(this, first); append(this, second);
    this.handle = append(this, new SplitHandle(engine, this));
    this.ratio = ratio;
  }

  get ratio (): number { return this.splitRatio; }
  set ratio (value: number) {
    const next = Math.max(.05, Math.min(.95, value));

    if (this.splitRatio !== next) { this.splitRatio = next; this.queueSort(); }
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(); }
  protected override sortChildren (): void {
    this.handle.visible = this.first.visible && this.second.visible;
    if (!this.first.visible || !this.second.visible) {
      place(this.first.visible ? this.first : this.second, 0, 0, this.width, this.height);

      return;
    }
    const length = Math.max(0, (this.vertical ? this.height : this.width) - editorMetrics.splitter);
    const min = Math.min(80, length / 3), split = Math.round(Math.max(min, Math.min(length - min, length * this.ratio)));

    if (this.vertical) {
      place(this.first, 0, 0, this.width, split);
      place(this.handle, 0, split, this.width, editorMetrics.splitter);
      place(this.second, 0, split + editorMetrics.splitter, this.width, length - split);
    } else {
      place(this.first, 0, 0, split, this.height);
      place(this.handle, split, 0, editorMetrics.splitter, this.height);
      place(this.second, split + editorMetrics.splitter, 0, length - split, this.height);
    }
  }
}
