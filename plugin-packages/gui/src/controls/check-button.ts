import { effectsClass } from '@galacean/effects';
import type { Engine, math } from '@galacean/effects';
import type { CheckButtonData } from '../data';
import { cloneColor, GUIStyle } from '../style';
import { Button } from './button';
import type { ContentInsets } from './button';
import { HorizontalAlignment } from './enums';

const SWITCH_WIDTH = 26;
const SWITCH_HEIGHT = 14;
const SWITCH_GAP = 6;

@effectsClass('CheckButton')
export class CheckButton extends Button {
  switchColor: math.Color;

  constructor (engine: Engine, text = '') {
    super(engine, text);
    this.toggleMode = true;
    this.textAlignment = HorizontalAlignment.Left;
    this.switchColor = cloneColor(GUIStyle.current.accentColor);
  }

  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();

    return { ...insets, right: insets.right + SWITCH_WIDTH + SWITCH_GAP };
  }

  protected override drawDecoration (): void {
    const x = this.width - this.horizontalPadding - SWITCH_WIDTH;
    const y = (this.height - SWITCH_HEIGHT) * 0.5;
    const radius = SWITCH_HEIGHT * 0.5;
    const trackColor = this.buttonPressed ? this.switchColor : this.borderColor;
    const knobX = this.buttonPressed ? x + SWITCH_WIDTH - radius : x + radius;

    this.fillRect(x + radius, y, SWITCH_WIDTH - SWITCH_HEIGHT, SWITCH_HEIGHT, trackColor);
    this.fillCircle(x + radius, y + radius, radius, trackColor);
    this.fillCircle(x + SWITCH_WIDTH - radius, y + radius, radius, trackColor);
    this.fillCircle(knobX, y + radius, radius - 2, this.textColor);
  }

  override fromData (data: CheckButtonData): void {
    super.fromData(data);
    if (data.switchColor !== undefined) {
      this.switchColor.copyFrom(data.switchColor);
    }
  }
}
