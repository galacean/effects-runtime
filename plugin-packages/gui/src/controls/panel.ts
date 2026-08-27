import { Control, MouseFilter, effectsClass } from '@galacean/effects';
import type { Engine, math } from '@galacean/effects';
import type { PanelData } from '../data';
import { cloneColor, GUIStyle } from '../style';

@effectsClass('Panel')
export class Panel extends Control {
  backgroundColor: math.Color;
  borderColor: math.Color;
  borderWidth = 1;

  constructor (engine: Engine) {
    super(engine);
    const style = GUIStyle.current;

    this.backgroundColor = cloneColor(style.panelColor);
    this.borderColor = cloneColor(style.borderColor);
    this.mouseFilter = MouseFilter.Stop;
  }

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, this.backgroundColor);
    if (this.borderWidth > 0) {
      this.drawRect(0, 0, this.width, this.height, this.borderColor, this.borderWidth);
    }
  }

  override fromData (data: PanelData): void {
    super.fromData(data);
    if (data.backgroundColor !== undefined) {
      this.backgroundColor.copyFrom(data.backgroundColor);
    }
    if (data.borderColor !== undefined) {
      this.borderColor.copyFrom(data.borderColor);
    }
    if (data.borderWidth !== undefined) {
      this.borderWidth = data.borderWidth;
    }
  }
}
