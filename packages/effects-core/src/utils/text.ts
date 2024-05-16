export function getFontFamily (fontFamily: string): string {
  // fix: IOS 11 以下不支持数字开头的字体 且不支持点号
  if (/^[0-9]/.test(fontFamily)) {
    fontFamily = `_${fontFamily}`;
  }
  // fix: 非英文/数字/下划线/横杠的字符替换
  fontFamily = fontFamily.replace(/[^a-zA-Z0-9]/g, '_');

  return fontFamily;
}
