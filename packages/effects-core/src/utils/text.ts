/**
 * 判断是否为可解析的字体
 * - 首字母不能为数字或 `.`
 * - 不能包含特殊字符，`_-` 是被允许的
 * @param fontFamily - 字体名称
 * @returns
 */
export function isValidFontFamily (fontFamily: string): boolean {
  // iOS 11/12 不支持自定义字体开头为数字的名称，特殊字符也有风险
  return /^[^\d.][\w-]*$/.test(fontFamily);
}
