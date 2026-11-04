import { MouseButton } from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton, InputEventMouseMotion, math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Container, FocusMode, Label, MouseFilter, TextOverflow, VerticalAlignment } from '@galacean/effects-plugin-gui';
import { EditorIconButton, paintIcon, type EditorIcon } from '../icons/control-icons';
import { editorColors, editorMetrics } from '../theme/control-theme';
import { append, place } from './layout';
import { setTooltip } from './tooltip';

export class EditorWindowTitleBar extends Container {
  icon?: EditorIcon;
  readonly caption: Label;
  private readonly closeButton: EditorIconButton;
  private move?: { pointer: math.Vector2, position: math.Vector2, moved: boolean };

  constructor (engine: Engine, private readonly window: Control, close: () => void) {
    super(engine); this.focusMode = FocusMode.Click; this.mouseFilter = MouseFilter.Stop;
    this.setCustomMinimumSize(0, editorMetrics.windowTitleHeight);
    this.caption = append(this, new Label(engine)); this.caption.mouseFilter = MouseFilter.Ignore;
    this.caption.verticalAlignment = VerticalAlignment.Center; this.caption.textOverflow = TextOverflow.Ellipsis;
    this.closeButton = append(this, new EditorIconButton(engine, 'close'));
    this.closeButton.themeTypeVariation = 'EditorWindowClose'; this.closeButton.iconSize = 12;
    this.closeButton.on('pressed', close); setTooltip(this.closeButton, 'Close Window');
  }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, editorColors.title);
    if (this.icon) { paintIcon(this, this.icon, 8, (this.height - 16) / 2, 16); }
    this.fillRect(0, this.height - 1, this.width, 1, editorColors.outline);
  }
  protected override sortChildren (): void {
    const left = this.icon ? 29 : 8;

    place(this.caption, left, 0, Math.max(0, this.width - left - 46), this.height);
    place(this.closeButton, this.width - 42, 0, 42, this.height - 1);
  }
  protected activateWindow (): void {}
  protected moveWindow (x: number, y: number): void {
    const root = this.window.root;

    this.window.setPosition(Math.max(0, Math.min((root?.width ?? this.window.width) - this.window.width, x)),
      Math.max(0, Math.min((root?.height ?? this.window.height) - this.height, y)));
  }
  protected movedWindow (): void {}
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) { return; }
    this.activateWindow(); this.grabFocus();
    this.move = { pointer: event.globalPosition.clone(), position: this.window.position.clone(), moved: false }; event.accept();
  }
  override onMouseMove (event: InputEventMouseMotion): void {
    if (!this.move) { return; }
    const dx = event.globalPosition.x - this.move.pointer.x, dy = event.globalPosition.y - this.move.pointer.y;

    this.move.moved ||= Math.hypot(dx, dy) > 3;
    if (this.move.moved) { this.moveWindow(this.move.position.x + dx, this.move.position.y + dy); }
    event.accept();
  }
  override onMouseUp (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && this.move) { this.finishMove(event.canceled); event.accept(); }
  }
  override onKeyDown (event: InputEventKey): void {
    if (event.keycode === 'Escape' && this.move) { this.finishMove(true); event.accept(); }
  }
  private finishMove (canceled = false): void {
    const move = this.move;

    this.move = undefined;
    if (!move?.moved) { return; }
    if (canceled) { this.moveWindow(move.position.x, move.position.y); }
    this.movedWindow();
  }
}
