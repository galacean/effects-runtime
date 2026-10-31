import { math, InputEventKey } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { LineEdit } from '@galacean/effects-plugin-gui';
import { EditorIconButton, paintIcon } from '../icons/control-icons';
import { EDITOR_FONT_SIZE } from '../theme/control-theme';
import { append, place } from './layout';
import { EditorTextField } from './text-field';

export class EditorSearchField extends EditorTextField {
  private readonly clear: EditorIconButton;

  constructor (engine: Engine, placeholder = 'Search…') {
    super(engine); this.themeTypeVariation = 'EditorSearchField'; this.placeholderText = placeholder;
    this.setThemeFontSizeOverride('fontSize', EDITOR_FONT_SIZE);
    this.clear = append(this, new EditorIconButton(engine, 'searchClear')); this.clear.iconSize = 14;
    this.clear.on('pressed', () => {
      const key = new InputEventKey();

      key.keycode = key.physicalKeycode = 'Backspace'; key.pressed = true;
      this.selectAll(); this.onKeyDown(key); this.grabFocus();
    });
    this.on('sizeChanged', () => this.layoutClear());
    this.on('textChanged', () => this.layoutClear()); this.layoutClear();
  }
  protected override onTextValueChanged (): void { super.onTextValueChanged(); if (this.clear) { this.layoutClear(); } }
  private layoutClear (): void { this.clear.visible = !!this.text; place(this.clear, 1, 1, 22, Math.max(0, this.height - 2)); }
  override getMinimumSize (): math.Vector2 { return new math.Vector2(48, 24); }
  override draw (): void { super.draw(); if (!this.text) { paintIcon(this, 'search', 6, (this.height - 14) / 2, 14); } }
}
