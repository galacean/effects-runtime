import type {
  RichLine, RichOverflowStrategy, OverflowResult, HorizontalAlignResult, VerticalAlignResult,
} from '../rich-text-interfaces';

/**
 * 扩展画布溢出策略（visible / display 模式共用）
 *
 * 根据对齐后的内容位置检测溢出，对称扩展画布以容纳所有内容。
 *
 * 对称扩展的原因：元素定位以中心点为锚点，单侧扩展会导致视觉偏移。
 * 使用 max(溢出左, 溢出右) 作为双侧扩展量保持中心点稳定。
 *
 * 路径文本额外用 renderOffset=(canvas-frame)/2 精确抵消 canvas 扩展
 * （字屏幕位置 = 中心+(offset+pt.pos-canvas/2)·SCALE，代入后 canvas 消去），
 * 让字位置只跟路径与 frame 尺寸有关，不随字间距抖动。
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

    // 对称扩展（画布高 = frameHeight + expandV*2，两边各扩 expandV）。
    const expandV = Math.max(overflowTop, overflowBottom);

    // ── 水平溢出检测 ──
    let contentLeft = Infinity;
    let contentRight = -Infinity;

    for (let i = 0; i < lines.length; i++) {
      const xOff = horizontalResult.lineOffsets[i] ?? 0;
      const line = lines[i];

      // 曲线文本：旋转后字角左右探出，line.width(advance 域)框不住。
      // contentMinX/MaxX 是 glyph-bounds 算的路径绝对坐标（含 pt.pos.x），不再加 xOff（避免双重偏移导致抖动）。
      if (line.contentMinX !== undefined && line.contentMaxX !== undefined) {
        contentLeft = Math.min(contentLeft, line.contentMinX);
        contentRight = Math.max(contentRight, line.contentMaxX);
      } else {
        const w = line.width ?? 0;

        contentLeft = Math.min(contentLeft, xOff);
        contentRight = Math.max(contentRight, xOff + w);
      }
    }

    if (!isFinite(contentLeft)) { contentLeft = 0; }
    if (!isFinite(contentRight)) { contentRight = 0; }

    const overflowLeft = Math.max(0, -contentLeft);
    const overflowRight = Math.max(0, contentRight - frameWidth);

    // 对称扩展（画布宽 = frameWidth + expandH*2，两边各扩 expandH）。
    const expandH = Math.max(overflowLeft, overflowRight);

    // ── 最终画布尺寸 ──
    const canvasWidth = Math.max(1, Math.ceil(frameWidth + expandH * 2));
    const canvasHeight = Math.max(1, Math.ceil(frameHeight + expandV * 2));

    // renderOffset：路径文本用 (canvas - frame)/2 精确抵消 canvas 扩展。
    // 字屏幕位置 = 中心 + (offset + pt.pos - canvas/2)·SCALE，代入 offset=(canvas-frame)/2：
    //   = 中心 + (pt.pos - frame/2)·SCALE —— canvas（含 ceil）完全消去，只跟路径+frame 有关，不抖。
    // 普通富文本（无 contentMinX）维持 offset=expand（现状，零回归）。
    const isPathMode = lines.some(l => l.contentMinX !== undefined);
    const renderOffsetX = isPathMode ? (canvasWidth - frameWidth) / 2 : expandH;
    const renderOffsetY = isPathMode ? (canvasHeight - frameHeight) / 2 : expandV;

    return {
      canvasWidth,
      canvasHeight,
      renderOffsetX,
      renderOffsetY,
    };
  }
}
