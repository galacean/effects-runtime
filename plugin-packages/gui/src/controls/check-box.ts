import { effectsClass } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Button } from './button';
import type { ContentInsets } from './button';
import { HorizontalAlignment } from './enums';

@effectsClass('CheckBox')
export class CheckBox extends Button {
  static override readonly themeType: string = 'CheckBox';

  constructor (engine: Engine, text = '') {
    super(engine, text);
    this.toggleMode = true;
    this.textAlignment = HorizontalAlignment.Left;
  }

  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();

    return {
      ...insets,
      left: insets.left + this.getThemeConstant('markSize') + this.getThemeConstant('markSeparation'),
    };
  }

  protected override drawDecoration (): void {
    const markSize = this.getThemeConstant('markSize');
    const x = this.getBaseContentInsets().left;
    const y = (this.height - markSize) * 0.5;
    const centerX = x + markSize * 0.5;
    const centerY = y + markSize * 0.5;
    const iconName = this.disabled || !this.enabledInHierarchy
      ? this.buttonPressed ? 'checkedDisabled' : 'uncheckedDisabled'
      : this.buttonPressed ? 'checked' : 'unchecked';
    const icon = this.getThemeIcon(iconName);

    if (icon) {
      this.drawTexture(x, y, markSize, markSize, icon);

      return;
    }
    const markColor = this.disabled || !this.enabledInHierarchy
      ? this.getThemeColor('markDisabledColor')
      : this.getThemeColor('markColor');
    const outlineColor = this.getThemeColor('markOutlineColor');

    if (this.buttonGroup) {
      this.drawCircle(centerX, centerY, markSize * 0.5, outlineColor, 1);
      if (this.buttonPressed) {
        this.fillCircle(centerX, centerY, markSize * 0.27, markColor);
      }
    } else {
      this.drawRect(x, y, markSize, markSize, outlineColor, 1);
      if (this.buttonPressed) {
        this.fillRect(x + 3, y + 3, markSize - 6, markSize - 6, markColor);
      }
    }
  }
}
