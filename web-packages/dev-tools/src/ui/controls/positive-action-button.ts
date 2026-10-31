import type { Engine } from '@galacean/effects';
import { paintIcon } from '../icons/control-icons';
import { EDITOR_SMALL_FONT_SIZE, editorColors } from '../theme/control-theme';
import { EditorMenuButton } from './menu';
import type { MenuAction } from './menu';

export class EditorPositiveActionButton extends EditorMenuButton {
  constructor (engine: Engine, text: string, actions?: () => MenuAction[]) {
    super(engine, text, actions); this.iconName = 'plus'; this.iconSize = 14; this.themeTypeVariation = 'EditorPositiveButton';
    this.setThemeFontSizeOverride('fontSize', EDITOR_SMALL_FONT_SIZE);
  }
  protected override drawDecoration (): void {
    paintIcon(this, 'plus', this.getNormalContentInsets().left, (this.height - 14) / 2, 14, this.disabled || !this.enabledInHierarchy ? editorColors.disabled : editorColors.positive);
  }
}
