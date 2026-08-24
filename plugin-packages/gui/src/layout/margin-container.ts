import { Container, math } from '@galacean/effects';
import { assertFinite } from './utils';

/** Adds four independent margins around every visible child. */
export class MarginContainer extends Container {
  private _marginLeft = 0;
  private _marginTop = 0;
  private _marginRight = 0;
  private _marginBottom = 0;

  get marginLeft (): number { return this._marginLeft; }
  set marginLeft (value: number) { this.setMargins(value, this.marginTop, this.marginRight, this.marginBottom); }

  get marginTop (): number { return this._marginTop; }
  set marginTop (value: number) { this.setMargins(this.marginLeft, value, this.marginRight, this.marginBottom); }

  get marginRight (): number { return this._marginRight; }
  set marginRight (value: number) { this.setMargins(this.marginLeft, this.marginTop, value, this.marginBottom); }

  get marginBottom (): number { return this._marginBottom; }
  set marginBottom (value: number) { this.setMargins(this.marginLeft, this.marginTop, this.marginRight, value); }

  setMargins (left: number, top: number, right: number, bottom: number): void {
    assertFinite('MarginContainer left margin', left);
    assertFinite('MarginContainer top margin', top);
    assertFinite('MarginContainer right margin', right);
    assertFinite('MarginContainer bottom margin', bottom);
    if (left === this._marginLeft && top === this._marginTop
      && right === this._marginRight && bottom === this._marginBottom) {
      return;
    }
    this._marginLeft = left;
    this._marginTop = top;
    this._marginRight = right;
    this._marginBottom = bottom;
    this.updateMinimumSize();
    this.updateDesiredSize();
    this.queueSort();
  }

  override getMinimumSize (): math.Vector2 {
    return this.measureChildren(false);
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureChildren(true);
  }

  protected override sortChildren (): void {
    const rect = {
      position: new math.Vector2(this.marginLeft, this.marginTop),
      size: new math.Vector2(
        this.size.x - this.marginLeft - this.marginRight,
        this.size.y - this.marginTop - this.marginBottom,
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

    return new math.Vector2(
      width + this.marginLeft + this.marginRight,
      height + this.marginTop + this.marginBottom,
    );
  }
}
