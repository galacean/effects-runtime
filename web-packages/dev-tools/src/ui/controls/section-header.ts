import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Button, ButtonDrawMode, HorizontalAlignment, VBoxContainer } from '@galacean/effects-plugin-gui';
import type { ContentInsets } from '@galacean/effects-plugin-gui';
import { paintIcon } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';
import { editorBox, editorDetailBackground, editorMetrics, editorColors } from '../theme/control-theme';
import { append } from './layout';

export class EditorSectionHeader extends Button {
  expanded = true;
  rowHeight?: number;
  trailingWidth = 0;
  constructor (engine: Engine, title: string, private readonly depth = 0, private readonly iconName?: EditorIcon) {
    super(engine, title); this.themeTypeVariation = 'EditorCategory'; this.textAlignment = HorizontalAlignment.Left; this.clipText = true;
    if (depth) {
      for (const state of ['normal', 'pressed']) { this.setThemeStyleBoxOverride(state, editorBox(editorDetailBackground(depth), 6)); }
      this.setThemeStyleBoxOverride('hover', editorBox(editorDetailBackground(depth, true), 6));
    }
  }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(0, this.rowHeight ?? (this.depth ? editorMetrics.nestedCategoryHeight : editorMetrics.categoryHeight)); }
  protected override getContentInsets (): ContentInsets { return { left: this.indent + 20 + (this.iconName ? 22 : 0), top: 0, right: 8 + this.trailingWidth, bottom: 0 }; }
  private get indent (): number { return this.depth ? 12 + (this.depth - 1) * 10 : 4; }
  protected override drawDecoration (mode: ButtonDrawMode): void {
    const tint = mode === ButtonDrawMode.Disabled ? editorColors.disabled : mode === ButtonDrawMode.Hover || mode === ButtonDrawMode.HoverPressed ? editorColors.foregroundHover : editorColors.foreground;

    paintIcon(this, this.expanded ? 'caretDown' : 'caretRight', this.indent, (this.height - 16) / 2, 16, tint);
    if (this.iconName) { paintIcon(this, this.iconName, this.indent + 20, (this.height - 16) / 2, 16, tint); }
    this.fillRect(0, this.height - 1, this.width, 1, editorColors.recessed);
  }
}

export class EditorCollapsiblePanel extends VBoxContainer {
  readonly heading: EditorSectionHeader;
  readonly body: VBoxContainer;
  constructor (engine: Engine, title: string, initiallyOpen = true, depth = 0, icon?: EditorIcon) {
    super(engine); this.setThemeConstantOverride('separation', 0);
    this.heading = append(this, new EditorSectionHeader(engine, title, depth, icon));
    this.body = append(this, new VBoxContainer(engine)); this.body.setThemeConstantOverride('separation', 0);
    this.expanded = initiallyOpen;
    this.heading.on('pressed', () => this.expanded = !this.expanded);
  }
  get expanded (): boolean { return this.heading.expanded; }
  set expanded (value: boolean) { this.heading.expanded = value; this.body.visible = value; }
}
