import { Container, effectsClass, math } from '@galacean/effects';
import type { AspectRatioContainerData } from '../data';
import { AspectRatioStretchMode, LayoutAlignment } from './enums';
import { assertEnumValue, assertFinite } from './utils';

/** Fits every visible child into the same rectangle with a fixed width/height ratio. */
@effectsClass('AspectRatioContainer')
export class AspectRatioContainer extends Container {
  static override readonly themeType: string = 'AspectRatioContainer';
  private _ratio = 1;
  private _stretchMode = AspectRatioStretchMode.Fit;
  private _horizontalAlignment = LayoutAlignment.Center;
  private _verticalAlignment = LayoutAlignment.Center;

  get ratio (): number {
    return this._ratio;
  }

  set ratio (value: number) {
    assertFinite('AspectRatioContainer ratio', value);
    if (value <= 0) {
      throw new RangeError('AspectRatioContainer ratio must be greater than zero.');
    }
    if (this._ratio !== value) {
      this._ratio = value;
      this.queueSort();
    }
  }

  get stretchMode (): AspectRatioStretchMode {
    return this._stretchMode;
  }

  set stretchMode (value: AspectRatioStretchMode) {
    assertEnumValue('AspectRatioContainer stretchMode', value, AspectRatioStretchMode.Cover);
    if (this._stretchMode !== value) {
      this._stretchMode = value;
      this.queueSort();
    }
  }

  get horizontalAlignment (): LayoutAlignment {
    return this._horizontalAlignment;
  }

  set horizontalAlignment (value: LayoutAlignment) {
    assertEnumValue('AspectRatioContainer horizontalAlignment', value, LayoutAlignment.End);
    if (this._horizontalAlignment !== value) {
      this._horizontalAlignment = value;
      this.queueSort();
    }
  }

  get verticalAlignment (): LayoutAlignment {
    return this._verticalAlignment;
  }

  set verticalAlignment (value: LayoutAlignment) {
    assertEnumValue('AspectRatioContainer verticalAlignment', value, LayoutAlignment.End);
    if (this._verticalAlignment !== value) {
      this._verticalAlignment = value;
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
      const childMinimum = child.getBoundMinimumSize();
      const baseWidth = this.ratio;
      const baseHeight = 1;
      let scale: number;

      switch (this.stretchMode) {
        case AspectRatioStretchMode.WidthControlsHeight:
          scale = this.size.x / baseWidth;

          break;
        case AspectRatioStretchMode.HeightControlsWidth:
          scale = this.size.y / baseHeight;

          break;
        case AspectRatioStretchMode.Cover:
          scale = Math.max(this.size.x / baseWidth, this.size.y / baseHeight);

          break;
        default:
          scale = Math.min(this.size.x / baseWidth, this.size.y / baseHeight);

          break;
      }
      const childSize = new math.Vector2(
        Math.max(childMinimum.x, baseWidth * scale),
        Math.max(childMinimum.y, baseHeight * scale),
      );
      const position = new math.Vector2(
        this.getAlignedOffset(this.horizontalAlignment, this.size.x - childSize.x),
        this.getAlignedOffset(this.verticalAlignment, this.size.y - childSize.y),
      );

      this.fitChildInRect(child, { position, size: childSize });
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

    return new math.Vector2(width, height);
  }

  private getAlignedOffset (alignment: LayoutAlignment, remaining: number): number {
    if (alignment === LayoutAlignment.Center) {
      return remaining / 2;
    }
    if (alignment === LayoutAlignment.End) {
      return remaining;
    }

    return 0;
  }

  override fromData (data: AspectRatioContainerData): void {
    super.fromData(data);
    if (data.ratio !== undefined) {
      this.ratio = data.ratio;
    }
    if (data.stretchMode !== undefined) {
      this.stretchMode = data.stretchMode;
    }
    if (data.horizontalAlignment !== undefined) {
      this.horizontalAlignment = data.horizontalAlignment;
    }
    if (data.verticalAlignment !== undefined) {
      this.verticalAlignment = data.verticalAlignment;
    }
  }
}
