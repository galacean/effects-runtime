import { effectsClass, math } from '@galacean/effects';
import { Container } from '../core/control';

/** Adds four independent margins around every visible child. */
@effectsClass('MarginContainer')
export class MarginContainer extends Container {
  static override readonly themeType: string = 'MarginContainer';

  override getMinimumSize (): math.Vector2 {
    return this.measureChildren(false);
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureChildren(true);
  }

  protected override sortChildren (): void {
    const left = this.getThemeConstant('marginLeft');
    const top = this.getThemeConstant('marginTop');
    const right = this.getThemeConstant('marginRight');
    const bottom = this.getThemeConstant('marginBottom');
    const rect = {
      position: new math.Vector2(left, top),
      size: new math.Vector2(
        this.size.x - left - right,
        this.size.y - top - bottom,
      ),
    };

    for (const child of this.getLayoutChildren()) {
      this.fitChildInRect(child, rect);
    }
  }

  private measureChildren (useDesired: boolean): math.Vector2 {
    let width = 0;
    let height = 0;

    for (const child of this.getLayoutChildren()) {
      const size = useDesired ? child.getBoundDesiredSize() : child.getBoundMinimumSize();

      width = Math.max(width, size.x);
      height = Math.max(height, size.y);
    }

    const left = this.getThemeConstant('marginLeft');
    const top = this.getThemeConstant('marginTop');
    const right = this.getThemeConstant('marginRight');
    const bottom = this.getThemeConstant('marginBottom');

    return new math.Vector2(
      width + left + right,
      height + top + bottom,
    );
  }
}
