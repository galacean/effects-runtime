import {
  effectsClass,
  math,
} from '@galacean/effects';
import type { Engine, FontStyle, FontWeight, Texture } from '@galacean/effects';
import type { ButtonData } from '../data';
import { cloneColor, GUIStyle } from '../style';
import { BaseButton } from './base-button';
import { ButtonDrawMode, HorizontalAlignment, VerticalAlignment } from './enums';

export type ContentInsets = {
  left: number,
  top: number,
  right: number,
  bottom: number,
};

@effectsClass('Button')
export class Button extends BaseButton {
  private _text = '';
  private _icon: Texture | null = null;
  private _fontFamily: string;
  private _fontSize: number;
  private _fontWeight: FontWeight;
  private _fontStyle: FontStyle;

  flat = false;
  clipText = false;
  expandIcon = false;
  textAlignment = HorizontalAlignment.Center;
  iconAlignment = HorizontalAlignment.Left;
  iconVerticalAlignment = VerticalAlignment.Center;
  horizontalPadding = 8;
  verticalPadding = 5;
  iconSeparation = 6;
  borderWidth = 1;
  textColor: math.Color;
  disabledTextColor: math.Color;
  normalColor: math.Color;
  hoverColor: math.Color;
  pressedColor: math.Color;
  disabledColor: math.Color;
  borderColor: math.Color;

  constructor (engine: Engine, text = '') {
    super(engine);
    const style = GUIStyle.current;

    this._text = text;
    this._fontFamily = style.fontFamily;
    this._fontSize = style.fontSize;
    this._fontWeight = style.fontWeight;
    this._fontStyle = style.fontStyle;
    this.textColor = cloneColor(style.textColor);
    this.disabledTextColor = cloneColor(style.disabledTextColor);
    this.normalColor = cloneColor(style.normalColor);
    this.hoverColor = cloneColor(style.hoverColor);
    this.pressedColor = cloneColor(style.pressedColor);
    this.disabledColor = cloneColor(style.disabledColor);
    this.borderColor = cloneColor(style.borderColor);
  }

  get text (): string {
    return this._text;
  }

  set text (value: string) {
    if (this._text !== value) {
      this._text = value;
      this.updateMinimumSize();
      this.updateDesiredSize();
    }
  }

  get icon (): Texture | null {
    return this._icon;
  }

  set icon (value: Texture | null) {
    if (this._icon !== value) {
      this._icon = value;
      this.updateMinimumSize();
      this.updateDesiredSize();
    }
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
      throw new RangeError('Button fontSize must be a positive finite number.');
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
    return this.measureButton();
  }

  override getDesiredSize (): math.Vector2 {
    return this.measureButton();
  }

  override draw (): void {
    const mode = this.getDrawMode();
    const background = this.getBackgroundColor(mode);

    if (!this.flat || mode !== ButtonDrawMode.Normal) {
      this.fillRect(0, 0, this.width, this.height, background);
      if (this.borderWidth > 0) {
        this.drawRect(0, 0, this.width, this.height, this.borderColor, this.borderWidth);
      }
    }
    this.drawDecoration(mode);
    this.drawContent(this.getContentInsets());
  }

  protected getContentInsets (): ContentInsets {
    return {
      left: this.horizontalPadding,
      top: this.verticalPadding,
      right: this.horizontalPadding,
      bottom: this.verticalPadding,
    };
  }

  protected drawDecoration (mode: ButtonDrawMode): void {}

  private updateTextSize (): void {
    this.updateMinimumSize();
    this.updateDesiredSize();
  }

  private measureButton (): math.Vector2 {
    const text = this.measureText(this.text, this.fontSize, this.fontFamily, this.fontWeight, this.fontStyle);
    const iconWidth = this.icon?.width ?? 0;
    const iconHeight = this.icon?.height ?? 0;
    const separation = this.text && this.icon ? this.iconSeparation : 0;
    const insets = this.getContentInsets();

    return new math.Vector2(
      insets.left + iconWidth + separation + text.width + insets.right,
      insets.top + Math.max(iconHeight, text.lineHeight) + insets.bottom,
    );
  }

  private getBackgroundColor (mode: ButtonDrawMode): math.Color {
    switch (mode) {
      case ButtonDrawMode.Disabled:
        return this.disabledColor;
      case ButtonDrawMode.Hover:
        return this.hoverColor;
      case ButtonDrawMode.Pressed:
      case ButtonDrawMode.HoverPressed:
        return this.pressedColor;
      default:
        return this.normalColor;
    }
  }

  private drawContent (insets: ContentInsets): void {
    const left = insets.left;
    const top = insets.top;
    const width = Math.max(0, this.width - insets.left - insets.right);
    const height = Math.max(0, this.height - insets.top - insets.bottom);
    const iconSize = this.getIconSize(width, height);
    const hasText = this.text.length > 0;
    const separation = this.icon && hasText ? this.iconSeparation : 0;
    const reservedIconWidth = this.icon ? iconSize.x + separation : 0;
    const textWidth = Math.max(0, width - reservedIconWidth);
    const sourceText = this.clipText ? this.ellipsizeText(this.text, textWidth) : this.text;
    const text = this.measureText(sourceText, this.fontSize, this.fontFamily, this.fontWeight, this.fontStyle);
    let iconX = left;
    let textAreaX = left + reservedIconWidth;

    if (this.icon && this.iconAlignment === HorizontalAlignment.Right) {
      iconX = left + width - iconSize.x;
      textAreaX = left;
    } else if (this.icon && this.iconAlignment === HorizontalAlignment.Center) {
      const groupWidth = iconSize.x + separation + text.width;

      iconX = left + (width - groupWidth) * 0.5;
      textAreaX = iconX + reservedIconWidth;
    }

    const textX = this.getAlignedX(textAreaX, textWidth, text.width, this.textAlignment);
    const textY = top + (height - text.lineHeight) * 0.5;

    if (this.clipText) {
      this.engine.graphics.pushClipRect(left, top, width, height);
    }
    try {
      if (this.icon) {
        const iconY = this.getAlignedY(top, height, iconSize.y, this.iconVerticalAlignment);

        this.drawTexture(iconX, iconY, iconSize.x, iconSize.y, this.icon);
      }
      this.drawText(
        textX, textY, sourceText, this.fontSize,
        this.disabled || !this.enabledInHierarchy ? this.disabledTextColor : this.textColor,
        this.fontFamily, this.fontWeight, this.fontStyle,
      );
    } finally {
      if (this.clipText) {
        this.engine.graphics.popClipRect();
      }
    }
  }

  private getIconSize (width: number, height: number): math.Vector2 {
    const icon = this.icon;

    if (!icon) {
      return new math.Vector2();
    }
    if (!this.expandIcon || icon.width <= 0 || icon.height <= 0) {
      return new math.Vector2(icon.width, icon.height);
    }
    const scale = Math.min(width / icon.width, height / icon.height);

    return new math.Vector2(icon.width * scale, icon.height * scale);
  }

  private getAlignedX (start: number, width: number, contentWidth: number, alignment: HorizontalAlignment): number {
    if (alignment === HorizontalAlignment.Center || alignment === HorizontalAlignment.Fill) {
      return start + (width - contentWidth) * 0.5;
    }
    if (alignment === HorizontalAlignment.Right) {
      return start + width - contentWidth;
    }

    return start;
  }

  private getAlignedY (start: number, height: number, contentHeight: number, alignment: VerticalAlignment): number {
    if (alignment === VerticalAlignment.Center || alignment === VerticalAlignment.Fill) {
      return start + (height - contentHeight) * 0.5;
    }
    if (alignment === VerticalAlignment.Bottom) {
      return start + height - contentHeight;
    }

    return start;
  }

  private ellipsizeText (text: string, width: number): string {
    const measurement = this.measureText(text, this.fontSize, this.fontFamily, this.fontWeight, this.fontStyle);

    if (measurement.width <= width) {
      return text;
    }
    const ellipsis = '…';
    const ellipsisWidth = this.measureText(ellipsis, this.fontSize, this.fontFamily, this.fontWeight, this.fontStyle).width;
    const characters = Array.from(text);
    let used = ellipsisWidth;
    let count = 0;

    if (ellipsisWidth > width) {
      return '';
    }
    while (count < characters.length && used + (measurement.advances[count] ?? 0) <= width) {
      used += measurement.advances[count] ?? 0;
      count++;
    }

    return characters.slice(0, count).join('') + ellipsis;
  }

  override fromData (data: ButtonData): void {
    super.fromData(data);
    if (data.text !== undefined) {
      this.text = data.text;
    }
    if (data.icon !== undefined) {
      this.icon = data.icon ? this.engine.findObject<Texture>(data.icon) : null;
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
    if (data.flat !== undefined) {
      this.flat = data.flat;
    }
    if (data.clipText !== undefined) {
      this.clipText = data.clipText;
    }
    if (data.expandIcon !== undefined) {
      this.expandIcon = data.expandIcon;
    }
    if (data.textAlignment !== undefined) {
      this.textAlignment = data.textAlignment;
    }
    if (data.iconAlignment !== undefined) {
      this.iconAlignment = data.iconAlignment;
    }
    if (data.iconVerticalAlignment !== undefined) {
      this.iconVerticalAlignment = data.iconVerticalAlignment;
    }
    if (data.horizontalPadding !== undefined) {
      this.horizontalPadding = data.horizontalPadding;
    }
    if (data.verticalPadding !== undefined) {
      this.verticalPadding = data.verticalPadding;
    }
    if (data.iconSeparation !== undefined) {
      this.iconSeparation = data.iconSeparation;
    }
    if (data.borderWidth !== undefined) {
      this.borderWidth = data.borderWidth;
    }
    if (data.textColor !== undefined) {
      this.textColor.copyFrom(data.textColor);
    }
    if (data.disabledTextColor !== undefined) {
      this.disabledTextColor.copyFrom(data.disabledTextColor);
    }
    if (data.normalColor !== undefined) {
      this.normalColor.copyFrom(data.normalColor);
    }
    if (data.hoverColor !== undefined) {
      this.hoverColor.copyFrom(data.hoverColor);
    }
    if (data.pressedColor !== undefined) {
      this.pressedColor.copyFrom(data.pressedColor);
    }
    if (data.disabledColor !== undefined) {
      this.disabledColor.copyFrom(data.disabledColor);
    }
    if (data.borderColor !== undefined) {
      this.borderColor.copyFrom(data.borderColor);
    }
  }
}
