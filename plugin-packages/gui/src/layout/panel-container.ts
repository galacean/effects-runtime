import { effectsClass, math } from '@galacean/effects';
import { Container } from '../core/control';

@effectsClass('PanelContainer')
export class PanelContainer extends Container {
  static override readonly themeType: string = 'PanelContainer';

  override getMinimumSize (): math.Vector2 {
    return this.measureChildren(false);
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureChildren(true);
  }

  override draw (): void {
    this.drawStyleBox(this.getThemeStyleBox('panel'), 0, 0, this.width, this.height);
  }

  protected override sortChildren (): void {
    const margins = this.getThemeStyleBox('panel').getContentMargins();
    const rect = {
      position: new math.Vector2(margins.left, margins.top),
      size: new math.Vector2(
        Math.max(0, this.width - margins.left - margins.right),
        Math.max(0, this.height - margins.top - margins.bottom),
      ),
    };

    for (const child of this.getLayoutChildren()) {
      this.fitChildInRect(child, rect);
    }
  }

  private measureChildren (desired: boolean): math.Vector2 {
    let width = 0;
    let height = 0;

    for (const child of this.getLayoutChildren()) {
      const size = desired ? child.getBoundDesiredSize() : child.getBoundMinimumSize();

      width = Math.max(width, size.x);
      height = Math.max(height, size.y);
    }
    const margins = this.getThemeStyleBox('panel').getContentMargins();

    return new math.Vector2(
      width + margins.left + margins.right,
      height + margins.top + margins.bottom,
    );
  }
}
