import { effectsClass } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Button } from './button';
import type { ContentInsets } from './button';
import { HorizontalAlignment } from './enums';

@effectsClass('CheckButton')
export class CheckButton extends Button {
  static override readonly themeType: string = 'CheckButton';

  constructor (engine: Engine, text = '') {
    super(engine, text);
    this.toggleMode = true;
    this.textAlignment = HorizontalAlignment.Left;
  }

  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();
    const separation = this.text ? Math.max(0, this.getThemeConstant('switchSeparation')) : 0;

    return {
      ...insets,
      right: insets.right + this.getSwitchSize().width + separation,
    };
  }

  protected override drawDecoration (): void {
    const switchWidth = this.getThemeConstant('switchWidth');
    const switchHeight = this.getThemeConstant('switchHeight');
    const switchSize = this.getSwitchSize();
    const x = this.width - this.getNormalContentInsets().right - switchSize.width;
    const yOffset = this.getThemeConstant('checkVOffset');
    const y = (this.height - switchSize.height) * 0.5 + yOffset;
    const radius = switchHeight * 0.5;
    const iconName = this.disabled || !this.enabledInHierarchy
      ? this.buttonPressed ? 'checkedDisabled' : 'uncheckedDisabled'
      : this.buttonPressed ? 'checked' : 'unchecked';
    const icon = this.getThemeIcon(iconName);

    if (icon) {
      this.drawTexture(
        x, y, icon.width, icon.height, icon, undefined,
        this.getThemeColor(this.buttonPressed ? 'buttonCheckedColor' : 'buttonUncheckedColor'),
      );

      return;
    }
    const fallbackX = this.width - this.getNormalContentInsets().right - switchWidth;
    const fallbackY = (this.height - switchHeight) * 0.5 + yOffset;
    const activeColor = this.disabled || !this.enabledInHierarchy
      ? this.getThemeColor('switchDisabledColor')
      : this.getThemeColor('switchColor');
    const trackColor = this.buttonPressed ? activeColor : this.getThemeColor('switchOffColor');
    const knobX = this.buttonPressed ? fallbackX + switchWidth - radius : fallbackX + radius;

    this.fillRect(fallbackX + radius, fallbackY, switchWidth - switchHeight, switchHeight, trackColor);
    this.fillCircle(fallbackX + radius, fallbackY + radius, radius, trackColor);
    this.fillCircle(fallbackX + switchWidth - radius, fallbackY + radius, radius, trackColor);
    this.fillCircle(knobX, fallbackY + radius, radius - 2, this.getThemeColor('switchKnobColor'));
  }

  private getSwitchSize (): { width: number, height: number } {
    let width = 0;
    let height = 0;

    const names = this.disabled || !this.enabledInHierarchy
      ? ['checkedDisabled', 'uncheckedDisabled']
      : ['checked', 'unchecked'];

    for (const name of names) {
      const icon = this.getThemeIcon(name);

      width = Math.max(width, icon?.width ?? 0);
      height = Math.max(height, icon?.height ?? 0);
    }
    if (width <= 0 && height <= 0) {
      return {
        width: this.getThemeConstant('switchWidth'),
        height: this.getThemeConstant('switchHeight'),
      };
    }

    return { width, height };
  }
}
