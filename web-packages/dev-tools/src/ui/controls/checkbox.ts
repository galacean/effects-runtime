import { Checkbox } from '@galacean/effects-plugin-gui';
import { editorBox, editorColors } from '../theme/control-theme';
import { paintIcon } from '../icons/control-icons';

export class EditorCheckbox extends Checkbox {
  protected override drawDecoration (): void {
    if (this.buttonGroup) {
      super.drawDecoration();

      return;
    }
    const disabled = this.disabled || !this.enabledInHierarchy, pressed = this.isPressing(), hovered = this.isHovered();
    const x = this.getNormalContentInsets().left, size = this.getThemeConstant('markSize'), y = Math.floor((this.height - size) / 2);
    const box = editorBox(editorColors.input, 0, 3, disabled ? editorColors.recessed : hovered || pressed ? editorColors.hover : editorColors.outline);
    const mark = disabled ? editorColors.disabled : pressed ? editorColors.primaryPress : hovered ? editorColors.primaryHover : editorColors.primary;

    this.drawStyleBox(box, x, y, size, size);
    if (this.buttonPressed) { paintIcon(this, 'check', x + 1, y + 1, size - 2, mark); }
  }
}
