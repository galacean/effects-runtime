/**
 * 判断是否为可解析的字体
 * @param fontFamily - 字体名称
 * @returns - 是否为可解析的字体
 */
export function isFontFamily (fontFamily: string): boolean {
  // FontFamily仅支持字母、数字、-、_,其他字符会导致加载错误或设置错误
  return /[^a-zA-Z0-9-_]/.test(fontFamily);
}
