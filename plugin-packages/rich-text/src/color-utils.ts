import type { spec } from '@galacean/effects';

/**
 * 将颜色名称转换为 RGBA
 * @param colorName - 颜色名称
 * @returns RGBA 颜色字符串
 */
export function colorNameToRGBA (colorName: string): string {
  if (typeof colorName !== 'string' || !colorName) {
    throw new Error('Invalid color name provided');
  }
  if (typeof document === 'undefined') {
    throw new Error('This method requires a browser environment');
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (context) {
    try {
      context.fillStyle = colorName;
      const result = context.fillStyle;

      return result;
    } finally {
      // Clean up DOM element
      canvas.remove?.();
    }
  }

  throw new Error('Failed to get 2D context for color conversion!');
}

/**
 * 将 16 进制颜色转换为 RGBA
 * @param hex - 16 进制颜色
 * @param alpha - 透明度
 * @returns - RGBA 颜色
 */
export function hexToRGBA (hex: string, alpha: number = 1): spec.vec4 {
  hex = hex.replace(/^#/, '');

  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').map(char => char + char).join('');
  }

  // Handle alpha channel in hex
  if (hex.length === 8) {
    const a = parseInt(hex.slice(6, 8), 16) / 255;

    hex = hex.slice(0, 6);
    alpha = a;
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
export function toRGBA (color: string, alpha: number = 1): spec.vec4 {
  if (typeof color !== 'string' || !color) {
    throw new Error('Invalid color string');
  }
  if (color.startsWith('#')) {
    return hexToRGBA(color, alpha);
  } else {
    return hexToRGBA(colorNameToRGBA(color));
  }
}
