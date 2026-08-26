import { effectsClass } from '@galacean/effects';
import type { Engine, math } from '@galacean/effects';
import type { CheckBoxData } from '../data';
import { cloneColor, GUIStyle } from '../style';
import { Button } from './button';
import type { ContentInsets } from './button';
import { HorizontalAlignment } from './enums';

const MARK_SIZE = 14;
const MARK_GAP = 6;

@effectsClass('CheckBox')
export class CheckBox extends Button {
  markColor: math.Color;

  constructor (engine: Engine, text = '') {
    super(engine, text);
    this.toggleMode = true;
    this.textAlignment = HorizontalAlignment.Left;
    this.markColor = cloneColor(GUIStyle.current.accentColor);
  }

  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();

    return { ...insets, left: insets.left + MARK_SIZE + MARK_GAP };
  }

  protected override drawDecoration (): void {
    const x = this.horizontalPadding;
    const y = (this.height - MARK_SIZE) * 0.5;
    const centerX = x + MARK_SIZE * 0.5;
    const centerY = y + MARK_SIZE * 0.5;

    if (this.buttonGroup) {
      this.drawCircle(centerX, centerY, MARK_SIZE * 0.5, this.borderColor, 1);
      if (this.buttonPressed) {
        this.fillCircle(centerX, centerY, MARK_SIZE * 0.27, this.markColor);
      }
    } else {
      this.drawRect(x, y, MARK_SIZE, MARK_SIZE, this.borderColor, 1);
      if (this.buttonPressed) {
        this.fillRect(x + 3, y + 3, MARK_SIZE - 6, MARK_SIZE - 6, this.markColor);
      }
    }
  }

  override fromData (data: CheckBoxData): void {
    super.fromData(data);
    if (data.markColor !== undefined) {
      this.markColor.copyFrom(data.markColor);
    }
  }
}
