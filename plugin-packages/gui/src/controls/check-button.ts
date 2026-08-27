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

    return {
      ...insets,
      right: insets.right + this.getThemeConstant('switchWidth') + this.getThemeConstant('switchSeparation'),
    };
  }

  protected override drawDecoration (): void {
    const switchWidth = this.getThemeConstant('switchWidth');
    const switchHeight = this.getThemeConstant('switchHeight');
    const x = this.width - this.getBaseContentInsets().right - switchWidth;
    const y = (this.height - switchHeight) * 0.5;
    const radius = switchHeight * 0.5;
    const iconName = this.disabled || !this.enabledInHierarchy
      ? this.buttonPressed ? 'checkedDisabled' : 'uncheckedDisabled'
      : this.buttonPressed ? 'checked' : 'unchecked';
    const icon = this.getThemeIcon(iconName);

    if (icon) {
      this.drawTexture(x, y, switchWidth, switchHeight, icon);

      return;
    }
    const activeColor = this.disabled || !this.enabledInHierarchy
      ? this.getThemeColor('switchDisabledColor')
      : this.getThemeColor('switchColor');
    const trackColor = this.buttonPressed ? activeColor : this.getThemeColor('switchOffColor');
    const knobX = this.buttonPressed ? x + switchWidth - radius : x + radius;

    this.fillRect(x + radius, y, switchWidth - switchHeight, switchHeight, trackColor);
    this.fillCircle(x + radius, y + radius, radius, trackColor);
    this.fillCircle(x + switchWidth - radius, y + radius, radius, trackColor);
    this.fillCircle(knobX, y + radius, radius - 2, this.getThemeColor('switchKnobColor'));
  }
}
