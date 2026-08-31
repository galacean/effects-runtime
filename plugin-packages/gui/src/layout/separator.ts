import { effectsClass, math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Control } from '../core/control';
import { MouseFilter } from '../core/enums';

abstract class Separator extends Control {
  constructor (engine: Engine, private readonly vertical: boolean) {
    super(engine);
    this.mouseFilter = MouseFilter.Ignore;
  }

  override getMinimumSize (): math.Vector2 {
    const minimum = this.getThemeStyleBox('separator').getMinimumSize();
    const thickness = Math.max(0, this.getThemeConstant('separation'));

    return this.vertical
      ? new math.Vector2(Math.max(minimum.x, thickness), minimum.y)
      : new math.Vector2(minimum.x, Math.max(minimum.y, thickness));
  }

  override getDesiredSize (): math.Vector2 {
    return this.getMinimumSize();
  }

  override draw (): void {
    const minimum = this.getMinimumSize();
    const width = this.vertical ? minimum.x : this.width;
    const height = this.vertical ? this.height : minimum.y;

    this.drawStyleBox(
      this.getThemeStyleBox('separator'),
      (this.width - width) * 0.5,
      (this.height - height) * 0.5,
      width,
      height,
    );
  }
}

@effectsClass('HSeparator')
export class HSeparator extends Separator {
  static override readonly themeType: string = 'HSeparator';

  constructor (engine: Engine) {
    super(engine, false);
  }
}

@effectsClass('VSeparator')
export class VSeparator extends Separator {
  static override readonly themeType: string = 'VSeparator';

  constructor (engine: Engine) {
    super(engine, true);
  }
}
