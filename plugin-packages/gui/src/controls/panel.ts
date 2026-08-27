import { Control, MouseFilter, effectsClass } from '@galacean/effects';
import type { Engine, math } from '@galacean/effects';

@effectsClass('Panel')
export class Panel extends Control {
  static override readonly themeType: string = 'Panel';

  constructor (engine: Engine) {
    super(engine);
    this.mouseFilter = MouseFilter.Stop;
  }

  override draw (): void {
    this.drawStyleBox(this.getThemeStyleBox('panel'), 0, 0, this.width, this.height);
  }

  override getMinimumSize (): math.Vector2 {
    return this.getThemeStyleBox('panel').getMinimumSize();
  }

  override getDesiredSize (): math.Vector2 {
    return this.getMinimumSize();
  }
}
