import { Control, MouseFilter, effectsClass, math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import type { ColorRectData } from '../data';

@effectsClass('ColorRect')
export class ColorRect extends Control {
  color = new math.Color(1, 1, 1, 1);

  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
  }

  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, this.color);
  }

  override fromData (data: ColorRectData): void {
    super.fromData(data);
    if (data.color !== undefined) {
      this.color.copyFrom(data.color);
    }
  }
}
