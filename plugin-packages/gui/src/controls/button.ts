import { effectsClass, math } from '@galacean/effects';
import type { Engine, Texture } from '@galacean/effects';
import type { ButtonData } from '../data';
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
  static override readonly themeType: string = 'Button';
  private _text = '';
  private _icon: Texture | null | undefined;

  flat = false;
  clipText = false;
  expandIcon = false;
  textAlignment = HorizontalAlignment.Center;
  iconAlignment = HorizontalAlignment.Left;
  iconVerticalAlignment = VerticalAlignment.Center;

  constructor (engine: Engine, text = '') {
    super(engine);

    this._text = text;
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
    return this._icon === undefined ? this.getThemeIcon('icon') : this._icon;
  }

  set icon (value: Texture | null) {
    if (this._icon !== value) {
      this._icon = value;
      this.updateMinimumSize();
      this.updateDesiredSize();
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
    const styleBox = this.getThemeStyleBox(this.getStyleBoxName(mode));

    if (!this.flat) {
      this.drawStyleBox(styleBox, 0, 0, this.width, this.height);
    }
    if (this.hasFocus(true)) {
      this.drawStyleBox(this.getThemeStyleBox('focus'), 0, 0, this.width, this.height);
    }
    this.drawDecoration(mode);
    this.drawContent(mode, this.getContentInsets());
  }

  protected getContentInsets (): ContentInsets {
    return this.getBaseContentInsets();
  }

  protected getNormalContentInsets (): ContentInsets {
    return this.getThemeStyleBox('normal').getContentMargins();
  }

  protected drawDecoration (mode: ButtonDrawMode): void {}

  private measureButton (): math.Vector2 {
    const font = this.getThemeFont('font');
    const text = this.measureText(
      this.text, this.getThemeFontSize('fontSize'), font.family, font.weight, font.style,
    );
    const hasText = this.text.length > 0;
    const iconWidth = this.expandIcon ? 0 : this.icon?.width ?? 0;
    const iconHeight = this.expandIcon ? 0 : this.icon?.height ?? 0;
    const textWidth = this.clipText ? 0 : text.width;
    const textHeight = hasText ? text.lineHeight : 0;
    const separation = hasText && iconWidth > 0 && this.iconAlignment !== HorizontalAlignment.Center
      ? Math.max(0, this.getThemeConstant('iconSeparation'))
      : 0;
    const insets = this.getContentInsets();
    const contentWidth = this.iconAlignment === HorizontalAlignment.Center
      ? Math.max(iconWidth, textWidth)
      : iconWidth + separation + textWidth;
    const contentHeight = this.iconVerticalAlignment === VerticalAlignment.Center
      ? Math.max(iconHeight, textHeight)
      : iconHeight + textHeight;

    return new math.Vector2(
      insets.left + contentWidth + insets.right,
      insets.top + contentHeight + insets.bottom,
    );
  }

  private getStyleBoxName (mode: ButtonDrawMode): string {
    switch (mode) {
      case ButtonDrawMode.Disabled: return 'disabled';
      case ButtonDrawMode.HoverPressed: return 'hoverPressed';
      case ButtonDrawMode.Pressed: return 'pressed';
      case ButtonDrawMode.Hover: return 'hover';
      default: return 'normal';
    }
  }

  private drawContent (mode: ButtonDrawMode, insets: ContentInsets): void {
    const left = insets.left;
    const top = insets.top;
    const width = Math.max(0, this.width - insets.left - insets.right);
    const height = Math.max(0, this.height - insets.top - insets.bottom);
    const hasText = this.text.length > 0;
    const separation = this.icon && hasText && this.iconAlignment !== HorizontalAlignment.Center
      ? Math.max(0, this.getThemeConstant('iconSeparation'))
      : 0;
    const font = this.getThemeFont('font');
    const fontSize = this.getThemeFontSize('fontSize');
    const naturalText = this.measureText(this.text, fontSize, font.family, font.weight, font.style);
    const iconWidth = !this.clipText && hasText && this.iconAlignment !== HorizontalAlignment.Center
      ? Math.max(0, width - naturalText.width - separation)
      : width;
    const iconHeight = hasText && this.iconVerticalAlignment !== VerticalAlignment.Center
      ? Math.max(0, height - naturalText.lineHeight)
      : height;
    const iconSize = this.getIconSize(iconWidth, iconHeight);
    const reservedIconWidth = this.icon && this.iconAlignment !== HorizontalAlignment.Center
      ? iconSize.x + separation
      : 0;
    const textWidth = Math.max(0, width - reservedIconWidth);
    const sourceText = this.clipText ? this.ellipsizeText(this.text, textWidth) : this.text;
    const text = this.measureText(sourceText, fontSize, font.family, font.weight, font.style);
    let iconX = left;
    let textAreaX = left + reservedIconWidth;

    if (this.icon && this.iconAlignment === HorizontalAlignment.Right) {
      iconX = left + width - iconSize.x;
      textAreaX = left;
    } else if (this.icon && this.iconAlignment === HorizontalAlignment.Center) {
      iconX = left + (width - iconSize.x) * 0.5;
      textAreaX = left;
    }

    const textX = this.getAlignedX(textAreaX, textWidth, text.width, this.textAlignment);
    const textAreaY = this.icon && this.iconVerticalAlignment === VerticalAlignment.Top
      ? top + iconSize.y
      : top;
    const textHeight = Math.max(0, height - (this.icon && this.iconVerticalAlignment !== VerticalAlignment.Center
      ? iconSize.y
      : 0));
    const textY = textAreaY + (textHeight - text.lineHeight) * 0.5;

    if (this.clipText) {
      this.engine.graphics.pushClipRect(left, top, width, height);
    }
    try {
      if (this.icon) {
        const iconY = this.getAlignedY(top, height, iconSize.y, this.iconVerticalAlignment);

        this.drawTexture(iconX, iconY, iconSize.x, iconSize.y, this.icon, undefined, this.getIconTint(mode));
      }
      this.drawText(
        textX, textY, sourceText, fontSize,
        this.getFontColor(mode),
        font.family, font.weight, font.style,
      );
    } finally {
      if (this.clipText) {
        this.engine.graphics.popClipRect();
      }
    }
  }

  private getFontColor (mode: ButtonDrawMode): math.Color {
    switch (mode) {
      case ButtonDrawMode.Disabled: return this.getThemeColor('fontDisabledColor');
      case ButtonDrawMode.HoverPressed: return this.getThemeColor('fontHoverPressedColor');
      case ButtonDrawMode.Pressed: return this.getThemeColor('fontPressedColor');
      case ButtonDrawMode.Hover: return this.getThemeColor('fontHoverColor');
      default: return this.hasFocus(true)
        ? this.getThemeColor('fontFocusColor')
        : this.getThemeColor('fontColor');
    }
  }

  private getIconTint (mode: ButtonDrawMode): math.Color {
    switch (mode) {
      case ButtonDrawMode.Disabled: return this.getThemeColor('iconDisabledTint');
      case ButtonDrawMode.HoverPressed: return this.getThemeColor('iconHoverPressedTint');
      case ButtonDrawMode.Pressed: return this.getThemeColor('iconPressedTint');
      case ButtonDrawMode.Hover: return this.getThemeColor('iconHoverTint');
      default: return this.hasFocus(true)
        ? this.getThemeColor('iconFocusTint')
        : this.getThemeColor('iconTint');
    }
  }

  protected getBaseContentInsets (): ContentInsets {
    if (!this.getThemeConstant('alignToLargestStyleBox')) {
      return this.getThemeStyleBox(this.getStyleBoxName(this.getDrawMode())).getContentMargins();
    }
    const result: ContentInsets = { left: 0, top: 0, right: 0, bottom: 0 };

    for (const name of ['normal', 'hover', 'pressed', 'hoverPressed', 'disabled']) {
      const margin = this.getThemeStyleBox(name).getContentMargins();

      result.left = Math.max(result.left, margin.left);
      result.top = Math.max(result.top, margin.top);
      result.right = Math.max(result.right, margin.right);
      result.bottom = Math.max(result.bottom, margin.bottom);
    }

    return result;
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
    const font = this.getThemeFont('font');
    const fontSize = this.getThemeFontSize('fontSize');
    const measurement = this.measureText(text, fontSize, font.family, font.weight, font.style);

    if (measurement.width <= width) {
      return text;
    }
    const ellipsis = '…';
    const ellipsisWidth = this.measureText(ellipsis, fontSize, font.family, font.weight, font.style).width;
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
  }
}
