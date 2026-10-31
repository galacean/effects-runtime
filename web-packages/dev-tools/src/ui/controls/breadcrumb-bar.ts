import { math, MouseButton } from '@galacean/effects';
import type { Engine, InputEventKey, InputEventMouseButton } from '@galacean/effects';
import { Button, Container, FocusMode } from '@galacean/effects-plugin-gui';
import { append, place } from './layout';
import { EditorMenuButton } from './menu';
import type { MenuAction } from './menu';
import { EditorTextField } from './text-field';

export interface EditorBreadcrumb {
  id: string,
  label: string,
  select: () => void,
  children?: () => MenuAction[],
}

export class EditorBreadcrumbBar extends Container {
  rootActions: () => MenuAction[] = () => [];
  readPath?: () => string;
  navigatePath?: (path: string) => void;
  private readonly rootButton: EditorMenuButton;
  private readonly overflow: EditorMenuButton;
  private readonly edit: EditorTextField;
  private entries: EditorBreadcrumb[] = [];
  private parts: { entry: EditorBreadcrumb, button: Button, delimiter: EditorMenuButton }[] = [];
  private editing = false;
  private signature = '';
  private hiddenCount = 0;

  constructor (engine: Engine) {
    super(engine); this.focusMode = FocusMode.All; this.clipContents = true;
    this.rootButton = append(this, new EditorMenuButton(engine, '', () => this.rootActions())); this.rootButton.iconName = 'folder';
    this.overflow = append(this, new EditorMenuButton(engine, '', () => this.entries.slice(0, this.hiddenCount).map(entry => ({ label: entry.label, icon: 'folder', action: entry.select }))));
    this.overflow.iconName = 'more'; this.overflow.visible = false;
    this.edit = append(this, new EditorTextField(engine)); this.edit.visible = false;
    this.edit.on('textSubmitted', text => { this.finishEdit(); this.grabFocus(); this.navigatePath?.(text.trim()); });
  }
  setPath (entries: EditorBreadcrumb[]): void {
    this.entries = entries;
    const signature = entries.map(entry => entry.id + '\0' + entry.label).join('\n');

    if (signature !== this.signature) {
      this.signature = signature;
      for (const part of this.parts) { part.button.dispose(); part.delimiter.dispose(); }
      this.parts = entries.map(entry => {
        const button = append(this, new Button(this.engine, entry.label));
        const delimiter = append(this, new EditorMenuButton(this.engine, '', () => entry.children?.() ?? []));

        button.themeTypeVariation = 'EditorToolbarButton'; button.clipText = true; button.on('pressed', entry.select);
        delimiter.iconName = 'chevronRight'; delimiter.iconSize = 12;

        return { entry, button, delimiter };
      });
    }
    this.queueSort();
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(72, 24); }
  protected override sortChildren (): void {
    this.rootButton.visible = !this.editing; this.edit.visible = this.editing;
    place(this.edit, 0, 0, this.width, this.height);
    if (this.editing) {
      this.overflow.visible = false; this.parts.forEach(part => { part.button.visible = part.delimiter.visible = false; });

      return;
    }
    const widths = this.parts.map((part, index) => this.partWidth(part) + (index < this.parts.length - 1 || part.entry.children?.().length ? 16 : 0));
    let total = widths.reduce((sum, width) => sum + width, 0), first = 0;

    while (first < this.parts.length - 1 && total > this.width - 70) { total -= widths[first++]; }
    this.hiddenCount = first; this.overflow.visible = first > 0;
    place(this.rootButton, 0, 0, 24, this.height); place(this.overflow, 24, 0, 24, this.height);
    let x = first ? 48 : 24;

    this.parts.forEach((part, index) => {
      part.button.visible = index >= first;
      part.delimiter.visible = index >= first && (index < this.parts.length - 1 || !!part.entry.children?.().length);
      if (index < first) { return; }
      const arrow = part.delimiter.visible ? 16 : 0, width = Math.min(this.partWidth(part), Math.max(0, this.width - x - arrow - 12));

      place(part.button, x, 0, width, this.height); x += width;
      place(part.delimiter, x, 0, arrow, this.height); x += arrow;
    });
  }
  private partWidth (part: { entry: EditorBreadcrumb, button: Button }): number {
    const font = part.button.getThemeFont('font');

    return part.button.measureText(part.entry.label, part.button.getThemeFontSize('fontSize'), font.family, font.weight, font.style).width + 8;
  }
  editPath (): void {
    if (!this.readPath || !this.navigatePath) { return; }
    this.editing = true; this.edit.text = this.readPath(); this.queueSort(); this.edit.visible = true; this.edit.grabFocus(); this.edit.selectAll();
  }
  private finishEdit (): void { this.editing = false; this.edit.visible = false; this.queueSort(); }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left) { this.editPath(); event.accept(); }
  }
  override onKeyDown (event: InputEventKey): void {
    if (this.editing && event.keycode === 'Escape') { this.finishEdit(); this.grabFocus(); event.accept(); } else if (event.keycode === 'F4') { this.editPath(); event.accept(); }
  }
  override update (delta: number): void {
    if (this.editing && !this.edit.hasFocus()) { this.finishEdit(); }
    super.update(delta);
  }
}
