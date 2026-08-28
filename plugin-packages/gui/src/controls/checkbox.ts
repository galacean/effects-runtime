import { effectsClass } from '@galacean/effects';
import type { Engine, math } from '@galacean/effects';
import { Button } from './button';
import type { ContentInsets } from './button';
import { HorizontalAlignment } from './enums';

const CHECK_ICON_GRID_SIZE = 16;

@effectsClass('Checkbox')
export class Checkbox extends Button {
  static override readonly themeType: string = 'Checkbox';

  constructor (engine: Engine, text = '') {
    super(engine, text);
    this.toggleMode = true;
    this.textAlignment = HorizontalAlignment.Left;
  }

  protected override getContentInsets (): ContentInsets {
    const insets = super.getContentInsets();
    const separation = this.text ? Math.max(0, this.getThemeConstant('markSeparation')) : 0;

    return {
      ...insets,
      left: insets.left + this.getMarkSize().width + separation,
    };
  }

  protected override drawDecoration (): void {
    const markSize = this.getThemeConstant('markSize');
    const iconSize = this.getMarkSize();
    const x = this.getNormalContentInsets().left;
    const yOffset = this.getThemeConstant('checkVOffset');
    const y = Math.floor((this.height - iconSize.height) * 0.5) + yOffset;
    const radio = !!this.buttonGroup;
    const iconName = this.disabled || !this.enabledInHierarchy
      ? radio
        ? this.buttonPressed ? 'radioCheckedDisabled' : 'radioUncheckedDisabled'
        : this.buttonPressed ? 'checkedDisabled' : 'uncheckedDisabled'
      : radio
        ? this.buttonPressed ? 'radioChecked' : 'radioUnchecked'
        : this.buttonPressed ? 'checked' : 'unchecked';
    const icon = this.getThemeIcon(iconName);

    if (icon) {
      this.drawTexture(
        x, y, icon.width, icon.height, icon, undefined,
        this.getThemeColor(this.buttonPressed ? 'checkedColor' : 'uncheckedColor'),
      );

      return;
    }
    const fallbackY = Math.floor((this.height - markSize) * 0.5) + yOffset;
    const centerX = x + markSize * 0.5;
    const centerY = fallbackY + markSize * 0.5;
    const disabled = this.disabled || !this.enabledInHierarchy;
    const markColor = disabled
      ? this.getThemeColor('markDisabledColor')
      : this.getThemeColor('markColor');
    const uncheckedColor = disabled
      ? this.getThemeColor('markUncheckedDisabledColor')
      : this.getThemeColor('markUncheckedColor');
    const checkedColor = disabled
      ? this.getThemeColor('checkedDisabledColor')
      : this.getThemeColor('checkedColor');
    const scale = markSize / CHECK_ICON_GRID_SIZE;

    if (this.buttonGroup) {
      if (this.buttonPressed) {
        this.fillCircle(centerX, centerY, 7 * scale, markColor);
        this.fillCircle(centerX, centerY, 4 * scale, checkedColor);
      } else {
        this.fillCircle(centerX, centerY, 7 * scale, uncheckedColor);
      }
    } else {
      this.fillRoundedMark(x + scale, fallbackY + scale, 14 * scale, 2.33 * scale, this.buttonPressed
        ? markColor
        : uncheckedColor);
      if (this.buttonPressed) {
        this.fillCheckMark(x, fallbackY, scale, checkedColor);
      }
    }
  }

  private fillRoundedMark (x: number, y: number, size: number, radius: number, color: math.Color): void {
    const points: Array<[number, number]> = [];
    const segments = 4;
    const corners: Array<[number, number, number]> = [
      [x + radius, y + radius, Math.PI],
      [x + size - radius, y + radius, Math.PI * 1.5],
      [x + size - radius, y + size - radius, 0],
      [x + radius, y + size - radius, Math.PI * 0.5],
    ];

    for (const [centerX, centerY, start] of corners) {
      for (let index = 0; index <= segments; index++) {
        const angle = start + index / segments * Math.PI * 0.5;

        points.push([centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius]);
      }
    }
    const centerX = x + size * 0.5;
    const centerY = y + size * 0.5;

    for (let index = 0; index < points.length; index++) {
      const current = points[index];
      const next = points[(index + 1) % points.length];

      this.fillTriangle(centerX, centerY, current[0], current[1], next[0], next[1], color);
    }
  }

  private fillCheckMark (x: number, y: number, scale: number, color: math.Color): void {
    const point = (px: number, py: number): [number, number] => [x + px * scale, y + py * scale];
    const top = point(11.5, 3.734);
    const inner = point(5.89, 9.346);
    const leftInner = point(4.185, 7.665);
    const left = point(2.685, 9.164);
    const bottom = point(5.889, 12.344);
    const right = point(13, 5.235);

    this.fillTriangle(leftInner[0], leftInner[1], left[0], left[1], bottom[0], bottom[1], color);
    this.fillTriangle(leftInner[0], leftInner[1], bottom[0], bottom[1], inner[0], inner[1], color);
    this.fillTriangle(top[0], top[1], inner[0], inner[1], bottom[0], bottom[1], color);
    this.fillTriangle(top[0], top[1], bottom[0], bottom[1], right[0], right[1], color);
  }

  private getMarkSize (): { width: number, height: number } {
    let width = 0;
    let height = 0;

    for (const name of [
      'checked', 'unchecked', 'checkedDisabled', 'uncheckedDisabled',
      'radioChecked', 'radioUnchecked', 'radioCheckedDisabled', 'radioUncheckedDisabled',
    ]) {
      const icon = this.getThemeIcon(name);

      width = Math.max(width, icon?.width ?? 0);
      height = Math.max(height, icon?.height ?? 0);
    }
    if (width <= 0 && height <= 0) {
      const fallback = this.getThemeConstant('markSize');

      return { width: fallback, height: fallback };
    }

    return { width, height };
  }
}
