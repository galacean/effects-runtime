import {
  MouseFilter,
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine } from '@galacean/effects';
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
      return new math.Vector2(Math.max(16, styleMinimum.x), Math.max(8, styleMinimum.y));
    }
    const font = this.getThemeFont('font');
    const text = this.measureText(
      '100%', this.getThemeFontSize('fontSize'), font.family, font.weight, font.style,
    );

    return new math.Vector2(Math.max(text.width + 12, styleMinimum.x), Math.max(text.lineHeight + 6, styleMinimum.y));
  }

  override getDesiredSize (): math.Vector2 {
    const minimum = this.getMinimumSize();

    return new math.Vector2(Math.max(120, minimum.x), minimum.y);
  }

  override draw (): void {
    const ratio = this.getAsRatio();

    this.drawStyleBox(this.getThemeStyleBox('background'), 0, 0, this.width, this.height);
    switch (this.fillMode) {
      case ProgressFillMode.BeginToEnd:
        this.drawStyleBox(this.getThemeStyleBox('fill'), 0, 0, this.width * ratio, this.height);

        break;
      case ProgressFillMode.EndToBegin:
        this.drawStyleBox(this.getThemeStyleBox('fill'), this.width * (1 - ratio), 0, this.width * ratio, this.height);

        break;
      case ProgressFillMode.TopToBottom:
        this.drawStyleBox(this.getThemeStyleBox('fill'), 0, 0, this.width, this.height * ratio);

        break;
      case ProgressFillMode.BottomToTop:
        this.drawStyleBox(this.getThemeStyleBox('fill'), 0, this.height * (1 - ratio), this.width, this.height * ratio);

        break;
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
