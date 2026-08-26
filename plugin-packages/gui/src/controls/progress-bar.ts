import {
  MouseFilter,
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine, FontStyle, FontWeight } from '@galacean/effects';
import { Range } from '../scroll/range';
import { cloneColor, GUIStyle } from '../style';
import { ProgressFillMode } from './enums';
import type { ProgressBarData } from '../data';

@effectsClass('ProgressBar')
export class ProgressBar extends Range {
  private _showPercentage = true;
  private _fillMode = ProgressFillMode.BeginToEnd;
  private _fontFamily: string;
  private _fontSize: number;
  private _fontWeight: FontWeight;
  private _fontStyle: FontStyle;

  backgroundColor: math.Color;
  fillColor: math.Color;
  textColor: math.Color;

  constructor (engine: Engine) {
    super(engine);
    const style = GUIStyle.current;

    this.step = 0.01;
    this.mouseFilter = MouseFilter.Ignore;
    this._fontFamily = style.fontFamily;
    this._fontSize = style.fontSize;
    this._fontWeight = style.fontWeight;
    this._fontStyle = style.fontStyle;
    this.backgroundColor = cloneColor(style.trackColor);
    this.fillColor = cloneColor(style.fillColor);
    this.textColor = cloneColor(style.textColor);
  }

  get showPercentage (): boolean {
    return this._showPercentage;
  }

  set showPercentage (value: boolean) {
    if (this._showPercentage !== value) {
      this._showPercentage = value;
      this.updateMinimumSize();
      this.updateDesiredSize();
    }
  }

  get fillMode (): ProgressFillMode {
    return this._fillMode;
  }

  set fillMode (value: ProgressFillMode) {
    this._fillMode = value;
  }

  get fontFamily (): string {
    return this._fontFamily;
  }

  set fontFamily (value: string) {
    if (this._fontFamily !== value) {
      this._fontFamily = value;
      this.updateTextSize();
    }
  }

  get fontSize (): number {
    return this._fontSize;
  }

  set fontSize (value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError('ProgressBar fontSize must be a positive finite number.');
    }
    if (this._fontSize !== value) {
      this._fontSize = value;
      this.updateTextSize();
    }
  }

  get fontWeight (): FontWeight {
    return this._fontWeight;
  }

  set fontWeight (value: FontWeight) {
    if (this._fontWeight !== value) {
      this._fontWeight = value;
      this.updateTextSize();
    }
  }

  get fontStyle (): FontStyle {
    return this._fontStyle;
  }

  set fontStyle (value: FontStyle) {
    if (this._fontStyle !== value) {
      this._fontStyle = value;
      this.updateTextSize();
    }
  }

  override getMinimumSize (): math.Vector2 {
    if (!this.showPercentage) {
      return new math.Vector2(16, 8);
    }
    const text = this.measureText('100%', this.fontSize, this.fontFamily, this.fontWeight, this.fontStyle);

    return new math.Vector2(text.width + 12, text.lineHeight + 6);
  }

  override getDesiredSize (): math.Vector2 {
    const minimum = this.getMinimumSize();

    return new math.Vector2(Math.max(120, minimum.x), minimum.y);
  }

  override draw (): void {
    const ratio = this.getAsRatio();

    this.fillRect(0, 0, this.width, this.height, this.backgroundColor);
    switch (this.fillMode) {
      case ProgressFillMode.BeginToEnd:
        this.fillRect(0, 0, this.width * ratio, this.height, this.fillColor);

        break;
      case ProgressFillMode.EndToBegin:
        this.fillRect(this.width * (1 - ratio), 0, this.width * ratio, this.height, this.fillColor);

        break;
      case ProgressFillMode.TopToBottom:
        this.fillRect(0, 0, this.width, this.height * ratio, this.fillColor);

        break;
      case ProgressFillMode.BottomToTop:
        this.fillRect(0, this.height * (1 - ratio), this.width, this.height * ratio, this.fillColor);

        break;
    }

    if (this.showPercentage) {
      const text = `${Math.round(ratio * 100)}%`;
      const measurement = this.measureText(text, this.fontSize, this.fontFamily, this.fontWeight, this.fontStyle);

      this.drawText(
        (this.width - measurement.width) * 0.5,
        (this.height - measurement.lineHeight) * 0.5,
        text, this.fontSize, this.textColor, this.fontFamily, this.fontWeight, this.fontStyle,
      );
    }
  }

  private updateTextSize (): void {
    this.updateMinimumSize();
    this.updateDesiredSize();
  }

  override fromData (data: ProgressBarData): void {
    super.fromData(data);
    if (data.showPercentage !== undefined) {
      this.showPercentage = data.showPercentage;
    }
    if (data.fillMode !== undefined) {
      this.fillMode = data.fillMode;
    }
    if (data.fontFamily !== undefined) {
      this.fontFamily = data.fontFamily;
    }
    if (data.fontSize !== undefined) {
      this.fontSize = data.fontSize;
    }
    if (data.fontWeight !== undefined) {
      this.fontWeight = data.fontWeight;
    }
    if (data.fontStyle !== undefined) {
      this.fontStyle = data.fontStyle;
    }
    if (data.backgroundColor !== undefined) {
      this.backgroundColor.copyFrom(data.backgroundColor);
    }
    if (data.fillColor !== undefined) {
      this.fillColor.copyFrom(data.fillColor);
    }
    if (data.textColor !== undefined) {
      this.textColor.copyFrom(data.textColor);
    }
  }
}
