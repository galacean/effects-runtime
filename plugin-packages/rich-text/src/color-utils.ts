import type { spec } from '@galacean/effects';

export class ColorUtils {
  /**
   * 将颜色名称转换为 RGBA
   * @param colorName - 颜色名称
   * @returns RGBA 颜色字符串
   */
  static colorNameToRGBA (colorName: string): string {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (context) {
      context.fillStyle = colorName;

      return context.fillStyle;
    }
    throw new Error('can not get 2d context!');
  }

  /**
   * 将 16 进制颜色转换为 RGBA
   * @param hex - 16 进制颜色
   * @param alpha - 透明度
   * @returns - RGBA 颜色
   */
  static hexToRGBA (hex: string, alpha: number = 1): spec.vec4 {
    hex = hex.replace(/^#/, '');

    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }

    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return [r, g, b, alpha];
  }

  /**
   * 将颜色字符串转换为 RGBA
   * @param color - 颜色字符串
   * @param alpha - 透明度
   * @returns - RGBA 颜色
   */
  static toRGBA (color: string, alpha: number = 1): spec.vec4 {
    if (color.startsWith('#')) {
      return this.hexToRGBA(color, alpha);
    } else {
      return this.hexToRGBA(this.colorNameToRGBA(color));
    }
  }
}
