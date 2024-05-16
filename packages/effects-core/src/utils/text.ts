export function getFontFamily (fontFamily: string): string {
  // fix: IOS 11 以下不支持数字开头的字体 且不支持点号
  if (/^[0-9]/.test(fontFamily)) {
    fontFamily = `_${fontFamily}`;
  }
  // fix: 有些字体名字中带有分号，会导致无法正确设置字体
  fontFamily = fontFamily.replace(/[.;]/g, '_');

  return fontFamily;
}
