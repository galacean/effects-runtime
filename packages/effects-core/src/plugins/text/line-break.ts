/**
 * 文本换行机会判定：UAX #14 风格的"换行机会"模型。
 *
 * - CJK 表意字 / 假名 / 韩文音节：任意两个字之间都是合法断点（字符级）
 * - 空格 / 制表符 / NBSP：可断，且断行时被吞掉（不留在行尾 / 行首）
 * - 西文字母 / 数字：词内不可断；整体超宽时由调用方退化到字符级断（overflow-wrap）
 *
 * 不含 kinsoku 禁则（句号 / 逗号不进行首等留作后续）。
 */

/** 换行机会类型（断点字符之后）：决定断点字符归属及断行时是否吞掉 */
export type BreakAfter = 'swallow' | 'keep' | false;

/**
 * 是否为可换行断点字符（空格 / 制表符 / NBSP）。
 * 断在此字符之前，且断行时该字符被吞掉（不进旧行也不进新行）。
 * @param ch - 当前字符
 */
export function isBreakChar (ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === ' ';
}

/**
 * 是否为 CJK 类字符（中文表意字 / 假名 / 韩文音节）。可在其与相邻字符之间换行。
 * 用码点判定以支持 CJK 扩展 B 等代理对字符（不能用 /u 正则，browserslist 为 iOS 9）。
 * @param ch - 当前字符（须为完整码点，调用方应使用 Array.from 遍历）
 */
export function isCJKLike (ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;

  return (
    (cp >= 0x3400 && cp <= 0x4DBF) ||    // CJK 统一表意扩展 A
    (cp >= 0x4E00 && cp <= 0x9FFF) ||    // CJK 统一表意
    (cp >= 0xF900 && cp <= 0xFAFF) ||    // CJK 兼容表意
    (cp >= 0x20000 && cp <= 0x2FA1F) ||  // CJK 扩展 B~F + 兼容增补（代理对）
    (cp >= 0x3040 && cp <= 0x309F) ||    // 平假名
    (cp >= 0x30A0 && cp <= 0x30FF) ||    // 片假名
    (cp >= 0x31F0 && cp <= 0x31FF) ||    // 片假名语音扩展
    (cp >= 0xAC00 && cp <= 0xD7AF)       // 韩文音节
  );
}

/**
 * 计算 prev（已推入的字符）之后是否为换行机会。只看 prev，不看后续字符。
 * @param prev - 前一字符（已推入旧行）
 * @returns 'swallow'=prev 是空格类，断行时吞掉 prev；'keep'=prev 是 CJK，prev 留本行末、下行从其后起；false=不可断
 */
export function breakOpportunityAfter (prev: string): BreakAfter {
  // prev 是空格类 → 断在 prev 处，断行时吞掉 prev（不进旧行也不进新行）
  if (isBreakChar(prev)) {
    return 'swallow';
  }

  // prev 是 CJK → prev 留本行末，下行从 prev 之后起（字符级断点，不吞）
  if (isCJKLike(prev)) {
    return 'keep';
  }

  return false;
}
