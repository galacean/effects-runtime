import { Container, math } from '@galacean/effects';

/** Centers children at their bound minimum size. */
export class CenterContainer extends Container {
  private _useTopLeft = false;

  get useTopLeft (): boolean {
    return this._useTopLeft;
  }

  set useTopLeft (value: boolean) {
    if (this._useTopLeft !== value) {
      this._useTopLeft = value;
      this.updateMinimumSize();
      this.updateDesiredSize();
      this.queueSort();
    }
  }

  override getMinimumSize (): math.Vector2 {
    return this.measureChildren(false);
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureChildren(true);
  }

  protected override sortChildren (): void {
    for (const child of this.getLayoutChildren()) {
      const childSize = child.getBoundMinimumSize();
      const position = this.useTopLeft
        ? new math.Vector2(Math.floor(-childSize.x / 2), Math.floor(-childSize.y / 2))
        : new math.Vector2(
          Math.floor((this.size.x - childSize.x) / 2),
          Math.floor((this.size.y - childSize.y) / 2),
        );

      this.fitChildInRect(child, { position, size: childSize });
    }
  }

  private measureChildren (useDesired: boolean): math.Vector2 {
    if (this.useTopLeft) {
      return new math.Vector2();
    }
    let width = 0;
    let height = 0;

    for (const child of this.getLayoutChildren()) {
      const size = useDesired ? child.getBoundDesiredSize() : child.getBoundMinimumSize();

      width = Math.max(width, size.x);
      height = Math.max(height, size.y);
    }

    return new math.Vector2(width, height);
  }
}
