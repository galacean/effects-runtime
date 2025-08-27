import * as spec from '@galacean/effects-specification';
import type { TextStyle } from '../text-style';

export const DEFAULT_FONTS = [
  'serif',
  'sans-serif',
  'monospace',
  'courier',
];

/**
 * 工具函数：生成字体描述
 * @param args - 参数：可接受 (size, style) 或 (style)
 * @returns 字体描述字符串
 */
export function getFontDesc (...args: [number, TextStyle] | [TextStyle]): string {
  let size: number;
  let style: TextStyle;

  if (args.length === 2) {
    [size, style] = args;
  } else {
    style = args[0];
    size = style.fontSize * style.fontScale;
  }

  const { fontFamily, textWeight, fontStyle } = style;
  let fontDesc = `${size}px `;

  if (!DEFAULT_FONTS.includes(fontFamily)) {
    fontDesc += `"${fontFamily}"`;
  } else {
    fontDesc += fontFamily;
  }
  if (textWeight !== spec.TextWeight.normal) {
    fontDesc = `${textWeight} ${fontDesc}`;
  }

  if (fontStyle !== spec.FontStyle.normal) {
    fontDesc = `${fontStyle} ${fontDesc}`;
  }

  return fontDesc;
}