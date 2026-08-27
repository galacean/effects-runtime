import {
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { MouseFilter } from '../core/enums';
import { Range } from '../scroll/range';
import { ProgressFillMode } from './enums';
import type { ProgressBarData } from '../data';

@effectsClass('ProgressBar')
export class ProgressBar extends Range {
  static override readonly themeType: string = 'ProgressBar';
  private _showPercentage = true;
  private _fillMode = ProgressFillMode.BeginToEnd;

  constructor (engine: Engine) {
    super(engine);

    this.step = 0.01;
    this.mouseFilter = MouseFilter.Ignore;
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

  override getMinimumSize (): math.Vector2 {
    const background = this.getThemeStyleBox('background').getMinimumSize();
    const fill = this.getThemeStyleBox('fill').getMinimumSize();
    const styleMinimum = new math.Vector2(Math.max(background.x, fill.x), Math.max(background.y, fill.y));

    if (!this.showPercentage) {
      return new math.Vector2(Math.max(1, styleMinimum.x), Math.max(1, styleMinimum.y));
    }
    const font = this.getThemeFont('font');
    const text = this.measureText(
      '100%', this.getThemeFontSize('fontSize'), font.family, font.weight, font.style,
    );

    return new math.Vector2(styleMinimum.x, Math.max(background.y + text.lineHeight, styleMinimum.y));
  }

  override getDesiredSize (): math.Vector2 {
    const minimum = this.getMinimumSize();

    return new math.Vector2(Math.max(120, minimum.x), minimum.y);
  }

  override draw (): void {
    const ratio = this.getAsRatio();
    const fillStyle = this.getThemeStyleBox('fill');
    const fillMinimum = fillStyle.getMinimumSize();

    this.drawStyleBox(this.getThemeStyleBox('background'), 0, 0, this.width, this.height);
    switch (this.fillMode) {
      case ProgressFillMode.BeginToEnd: {
        const progress = Math.round(ratio * (this.width - fillMinimum.x));

        if (progress > 0) {
          this.drawStyleBox(fillStyle, 0, 0, progress + fillMinimum.x, this.height);
        }

        break;
      }
      case ProgressFillMode.EndToBegin: {
        const progress = Math.round(ratio * (this.width - fillMinimum.x));

        if (progress > 0) {
          const remaining = Math.round((1 - ratio) * (this.width - fillMinimum.x));

          this.drawStyleBox(fillStyle, remaining, 0, progress + fillMinimum.x, this.height);
        }

        break;
      }
      case ProgressFillMode.TopToBottom: {
        const progress = Math.round(ratio * (this.height - fillMinimum.y));

        if (progress > 0) {
          this.drawStyleBox(fillStyle, 0, 0, this.width, progress + fillMinimum.y);
        }

        break;
      }
      case ProgressFillMode.BottomToTop: {
        const progress = Math.round(ratio * (this.height - fillMinimum.y));

        if (progress > 0) {
          const remaining = Math.round((1 - ratio) * (this.height - fillMinimum.y));

          this.drawStyleBox(fillStyle, 0, remaining, this.width, progress + fillMinimum.y);
        }

        break;
      }
    }

    if (this.showPercentage) {
      const text = `${Math.round(ratio * 100)}%`;
      const font = this.getThemeFont('font');
      const fontSize = this.getThemeFontSize('fontSize');
      const measurement = this.measureText(text, fontSize, font.family, font.weight, font.style);

      this.drawText(
        (this.width - measurement.width) * 0.5,
        (this.height - measurement.lineHeight) * 0.5,
        text, fontSize, this.getThemeColor('fontColor'), font.family, font.weight, font.style,
      );
    }
  }

  override fromData (data: ProgressBarData): void {
    super.fromData(data);
    if (data.showPercentage !== undefined) {
      this.showPercentage = data.showPercentage;
    }
    if (data.fillMode !== undefined) {
      this.fillMode = data.fillMode;
    }
  }

}
