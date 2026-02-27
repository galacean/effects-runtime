import type {
  RichLine, RichOverflowStrategy, OverflowResult,
  HorizontalAlignResult, VerticalAlignResult,
} from '../rich-text-interfaces';

/**
 * 扩展画布溢出策略（visible / display 模式共用）
 *
 * 根据对齐后的内容位置检测溢出，对称扩展画布以容纳所有内容。
 * 不依赖对齐模式（textAlign / textVerticalAlign）的枚举值，
 * 仅使用对齐策略输出的位置和行的度量数据。
 *
 * 对称扩展的原因：元素定位以中心点为锚点，
 * 单侧扩展会导致视觉偏移。使用 max(溢出左, 溢出右) 作为双侧扩展量
 * 可以保持中心点稳定并兼容所有对齐模式。
 */
export class RichExpandingOverflowStrategy implements RichOverflowStrategy {
  resolveCanvas (
    lines: RichLine[],
    frameWidth: number,
    frameHeight: number,
    horizontalResult: HorizontalAlignResult,
    verticalResult: VerticalAlignResult,
  ): OverflowResult {
    if (lines.length === 0) {
      return {
        canvasWidth: Math.max(1, frameWidth),
        canvasHeight: Math.max(1, frameHeight),
        renderOffsetX: 0,
        renderOffsetY: 0,
      };
    }

    // ── 垂直溢出检测 ──
    // 遍历每行基线，结合 ascent/descent 找出实际渲染范围
    let contentTop = Infinity;
    let contentBottom = -Infinity;
    let currentY = verticalResult.baselineY;

    for (let i = 0; i < lines.length; i++) {
      const asc = lines[i].lineAscent ?? 0;
      const desc = lines[i].lineDescent ?? 0;
      // 当 lineHeight >= textHeight 时，margin 为正，需要把行高边距纳入内容范围；
      // 当 lineHeight < textHeight 时，margin 为负，此时字形超出行高框，
      // 必须用原始字形边界（margin=0），否则负 margin 会把边界向内收缩，
      // 导致检测不到溢出，最终首行顶部/末行底部被裁切。
      const textHeight = asc + desc;
      const margin = Math.max(0, (lines[i].lineHeight - textHeight) / 2);

      contentTop = Math.min(contentTop, currentY - asc - margin);
      contentBottom = Math.max(contentBottom, currentY + desc + margin);

      if (i < lines.length - 1) {
        currentY += lines[i + 1].lineHeight;
      }
    }

    const overflowTop = Math.max(0, -contentTop);
    const overflowBottom = Math.max(0, contentBottom - frameHeight);

    // 对称扩展（保持中心点稳定）
    const expandV = Math.max(overflowTop, overflowBottom);

    // ── 水平溢出检测 ──
    let contentLeft = Infinity;
    let contentRight = -Infinity;

    for (let i = 0; i < lines.length; i++) {
      const xOff = horizontalResult.lineOffsets[i] ?? 0;
      const w = lines[i].width ?? 0;

      contentLeft = Math.min(contentLeft, xOff);
      contentRight = Math.max(contentRight, xOff + w);
    }

    if (!isFinite(contentLeft)) { contentLeft = 0; }
    if (!isFinite(contentRight)) { contentRight = 0; }

    const overflowLeft = Math.max(0, -contentLeft);
    const overflowRight = Math.max(0, contentRight - frameWidth);

    // 对称扩展
    const expandH = Math.max(overflowLeft, overflowRight);

    // ── 最终画布尺寸 ──
    const canvasWidth = Math.ceil(frameWidth + expandH * 2);
    const canvasHeight = Math.ceil(frameHeight + expandV * 2);

    return {
      canvasWidth: Math.max(1, canvasWidth),
      canvasHeight: Math.max(1, canvasHeight),
      renderOffsetX: expandH,
      renderOffsetY: expandV,
    };
  }
}
