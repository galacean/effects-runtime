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
    const separation = this.text ? Math.max(0, this.getThemeConstant('markSeparation')) : 0;

    return {
      ...insets,
      left: insets.left + this.getMarkSize().width + separation,
    };
  }

  protected override drawDecoration (): void {
    const markSize = this.getThemeConstant('markSize');
    const iconSize = this.getMarkSize();
    const x = this.getNormalContentInsets().left;
    const yOffset = this.getThemeConstant('checkVOffset');
    const y = (this.height - iconSize.height) * 0.5 + yOffset;
    const radio = !!this.buttonGroup;
    const iconName = this.disabled || !this.enabledInHierarchy
      ? radio
        ? this.buttonPressed ? 'radioCheckedDisabled' : 'radioUncheckedDisabled'
        : this.buttonPressed ? 'checkedDisabled' : 'uncheckedDisabled'
      : radio
        ? this.buttonPressed ? 'radioChecked' : 'radioUnchecked'
        : this.buttonPressed ? 'checked' : 'unchecked';
    const icon = this.getThemeIcon(iconName);

    if (icon) {
      this.drawTexture(
        x, y, icon.width, icon.height, icon, undefined,
        this.getThemeColor(this.buttonPressed ? 'checkedColor' : 'uncheckedColor'),
      );

      return;
    }
    const fallbackY = (this.height - markSize) * 0.5 + yOffset;
    const centerX = x + markSize * 0.5;
    const centerY = fallbackY + markSize * 0.5;
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
      this.drawRect(x, fallbackY, markSize, markSize, outlineColor, 1);
      if (this.buttonPressed) {
        this.fillRect(x + 3, fallbackY + 3, markSize - 6, markSize - 6, markColor);
      }
    }
  }

  private getMarkSize (): { width: number, height: number } {
    let width = 0;
    let height = 0;

    for (const name of [
      'checked', 'unchecked', 'checkedDisabled', 'uncheckedDisabled',
      'radioChecked', 'radioUnchecked', 'radioCheckedDisabled', 'radioUncheckedDisabled',
    ]) {
      const icon = this.getThemeIcon(name);

      width = Math.max(width, icon?.width ?? 0);
      height = Math.max(height, icon?.height ?? 0);
    }
    if (width <= 0 && height <= 0) {
      const fallback = this.getThemeConstant('markSize');

      return { width: fallback, height: fallback };
    }

    return { width, height };
  }
}
