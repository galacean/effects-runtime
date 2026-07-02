import { type TextStyle, spec } from '@galacean/effects';
import type { CurveGlyphInfo, ContourMeasure } from '@galacean/effects';
import { computeGlyphsBounds, ContourMeasureIter, GraphicsPath } from '@galacean/effects';
import type { RichTextLayout } from '../../rich-text-layout';
import type { RichTextOptions } from '../../rich-text-component';
import type { RichCharDetail, RichLine, RichWrapStrategy, WrapResult } from '../rich-text-interfaces';

/**
 * 段测量结果
 */
interface SegMeasurement {
  options: RichTextOptions,
  charWidths: number[],
  fontAsc: number,
  fontDesc: number,
}

/**
 * 富文本沿路径排版策略（text on path）。
 *
 * 结构对齐 wrap-disabled：baselines + finishCurrentLine + lineHeight=gapPx + bbox from baselines。
 * 区别仅在于"逐字定位"——disabled 用 segmentInnerX 横向累加，OnPath 用 ContourMeasure.getPosTan
 * 沿路径取点。多出的逻辑（测量/路径解析/防裁切）抽成 private 方法，保持 computeLines 干净。
 *
 * 路径来源：curveGraphicsPath（引擎 GraphicsPath，钢笔 CustomShapeData 可直接产出）；
 * 若 isPathText 且无 curveGraphicsPath → 默认闭合圆；否则直线兜底。
 */
export class RichWrapOnPathStrategy implements RichWrapStrategy {
  /**
   * 最近一次 computeLines 实际用的 GraphicsPath（含默认圆兜底）。
   * 仅供调试取用（onDebugDraw 画参考线），不参与排版逻辑。
   */
  lastResolvedPath?: GraphicsPath;

  computeLines (
    processedOptions: RichTextOptions[],
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: RichTextLayout,
    letterSpace: number,
  ): WrapResult {
    const gapPx = layout.lineHeight || 0;
    const scaleFactor = 1 / 10; // 1/10px, 后面 context.font 设置的字号为 10px

    // ── 1. 预测量：逐段逐字测宽 + 字体级 asc/desc ──
    const { segMeasurements, totalTextWidth } = this.measureSegments(processedOptions, context, style, layout, letterSpace, scaleFactor);

    // ── 2. 解析路径 + 取 contours ──
    const contours = this.resolvePath(layout, totalTextWidth);

    if (contours.length === 0) {
      return { lines: [], maxLineWidth: 0, totalHeight: 0, bboxTop: 0, bboxBottom: 0, bboxHeight: 0 };
    }

    // ── 3. 排版：每个 contour 排一份完整文字（对齐 disabled 的行管理）──
    const lines: RichLine[] = [];
    const baselines: number[] = [];
    let currentLine: RichLine = this.createNewLine();
    let maxLineWidth = 0;
    let totalHeight = 0;
    const allGlyphs: CurveGlyphInfo[] = [];

    const finishCurrentLine = () => {
      if (currentLine.chars.length === 0) { return; }

      // 所有行都使用配置的行高（gapPx）
      currentLine.lineHeight = gapPx;

      // 记录本行基线
      const baseline = lines.length === 0 ? 0 : (baselines[baselines.length - 1] + gapPx);

      baselines.push(baseline);

      totalHeight += currentLine.lineHeight;
      lines.push(currentLine);
      maxLineWidth = Math.max(maxLineWidth, currentLine.width);
      currentLine = this.createNewLine();
    };

    for (const contour of contours) {
      const pathLength = contour.length();

      if (pathLength <= 0) { continue; }

      // 起始弧长 offset（按 textAlign）
      let currentArc = this.getStartOffset(layout, pathLength, totalTextWidth);
      let isFirstChar = true;
      let lastCharEndX = 0;

      segMeasurements.forEach(({ options, charWidths, fontAsc, fontDesc }) => {
        currentLine.lineAscent = Math.max(currentLine.lineAscent || 0, fontAsc);
        currentLine.lineDescent = Math.max(currentLine.lineDescent || 0, fontDesc);
        const charArr: RichCharDetail[] = [];

        // 逐字符处理。
        // 坐标语义：currentArc 是当前字起点（字 left bearing）在弧长轴上的位置，
        // 字占据 [currentArc, currentArc + charWidth]。letterSpace 是字与字之间的间距，
        // 推进顺序：先加间距（非首字）→ 判断越界 → 渲染 → 推进 charWidth。
        // 越界字跳过但间距仍推进，否则排满丢边缘字后剩余字整体偏移。
        for (let i = 0; i < charWidths.length; i++) {
          const ch = options.text[i];
          const charWidth = charWidths[i];

          // 非首字：先加与前字的 letterSpace（首字不加，丢弃的越界字也算"前字"）
          if (!isFirstChar) { currentArc += letterSpace; }
          const charEndArc = currentArc + charWidth;

          // getPosTan 内部 clamp 到 [0, L]：负弧长挤到起点产生重叠字、超长挤到终点产生重叠字。
          // 靠区间相交显式挡掉越界字，不依赖 getPosTan。
          // 字区间 [currentArc, charEndArc] 与 [0, pathLength]：
          if (charEndArc <= 0) {
            // 完全在路径左外（middle/right 排满时左端丢弃）→ 跳过，间距已推，继续
            currentArc = charEndArc;
            isFirstChar = false;

            continue;
          }
          if (currentArc >= pathLength) {
            // 完全在路径右外 → 本 contour 排不下更多字
            break;
          }
          // 部分相交（字区间跨 [0,L] 端点）：取点在 clamp 后的端点，字形会伸出端点外，
          // 不补出半个字（对齐 Figma「排不下即不整字渲染」也偏保守），保留渲染。

          const pt = contour.getPosTan(currentArc);
          const midPt = contour.getPosTan(currentArc + charWidth / 2);
          const y = pt.pos.y;
          const rotation = Math.atan2(midPt.tan.y, midPt.tan.x);
          const charX = pt.pos.x;

          charArr.push({ char: ch, x: charX, rotation, curvedOffsetY: y });
          allGlyphs.push({
            char: ch, x: charX, y, rotation,
            advance: charWidth, ascent: fontAsc, descent: fontDesc,
          });

          currentArc += charWidth;
          lastCharEndX = charX + charWidth;
          isFirstChar = false;
        }

        currentLine.chars.push(charArr);
        // charDetail.x 已是路径绝对坐标(pt.pos.x),段起点偏移必须为 0,
        // 否则 draw 会把"上一段末尾路径绝对 x"叠加到本字上导致多段双计(B1)。
        // line.width 保留路径绝对,仅用于 maxLineWidth 统计(autoWidth frameW)。
        currentLine.offsetX.push(0);
        currentLine.width = Math.max(currentLine.width, lastCharEndX);
        currentLine.richOptions.push(options);
      });

      // 结束当前行
      finishCurrentLine();
    }

    if (lines.length === 0) {
      return { lines: [], maxLineWidth: 0, totalHeight: 0, bboxTop: 0, bboxBottom: 0, bboxHeight: 0 };
    }

    // ── 4. 防裁切：旋转字形真实外溢范围 ──
    this.applyAntiClipBounds(lines, allGlyphs);

    // ── 5. 计算 bbox（照 disabled 模式从 baselines-asc/desc+margin 算）──
    let bboxTop = Infinity;
    let bboxBottom = -Infinity;

    for (let i = 0; i < lines.length; i++) {
      const asc = lines[i].lineAscent || 0;
      const desc = lines[i].lineDescent || 0;
      const textHeight = asc + desc;
      const margin = (gapPx - textHeight) / 2;

      bboxTop = Math.min(bboxTop, baselines[i] - asc - margin);
      bboxBottom = Math.max(bboxBottom, baselines[i] + desc + margin);
    }
    const bboxHeight = bboxBottom - bboxTop;

    return {
      lines,
      maxLineWidth,
      totalHeight,
      bboxTop,
      bboxBottom,
      bboxHeight,
    };
  }

  /**
   * 预测量：逐段逐字测宽 + 字体级 asc/desc，返回 segMeasurements + 总宽。
   */
  private measureSegments (
    processedOptions: RichTextOptions[],
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: RichTextLayout,
    letterSpace: number,
    scaleFactor: number,
  ): { segMeasurements: SegMeasurement[], totalTextWidth: number } {
    let totalTextWidth = 0;
    let nonEmptySegments = 0;
    const segMeasurements: SegMeasurement[] = [];

    processedOptions.forEach(options => {
      const { text, fontSize } = options;
      const fontStyle = options.fontStyle || style.fontStyle || 'normal';

      context.font = `${fontStyle} ${options.fontWeight || style.textWeight} 10px ${options.fontFamily || style.fontFamily}`;
      const glyphScale = fontSize * scaleFactor;
      const refMetrics = context.measureText('x');
      const fontAsc = refMetrics.fontBoundingBoxAscent * glyphScale;
      const fontDesc = refMetrics.fontBoundingBoxDescent * glyphScale;

      const charWidths: number[] = [];
      let segWidth = 0;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const w = context.measureText(ch).width;
        const charWidth = (w <= 0 ? 0 : w) * glyphScale;

        charWidths.push(charWidth);
        segWidth += charWidth;
      }
      // 字符间距：首字不加，每段内 (字数-1) 个间距
      segWidth += Math.max(0, charWidths.length - 1) * letterSpace;
      totalTextWidth += segWidth;
      if (charWidths.length > 0) { nonEmptySegments++; }

      segMeasurements.push({ options, charWidths, fontAsc, fontDesc });
    });

    // 段间 letterSpace：逐字循环跨段首字同样加 ls（isFirstChar 跨段不重置），
    // 故 total 也须含 (非空段数-1) 个段间 ls，否则多段 right/middle 定位偏（单段不受影响）。
    totalTextWidth += Math.max(0, nonEmptySegments - 1) * letterSpace;

    return { segMeasurements, totalTextWidth };
  }

  /**
   * 解析路径来源 + 取 contours。
   * 路径来源：curveGraphicsPath（引擎 GraphicsPath）；无路径 → 默认闭合圆（不回写 layout，避免污染状态机）。
   * 实际用的路径记到 lastResolvedPath，供调试（onDebugDraw 画参考线）取用。
   */
  private resolvePath (
    layout: RichTextLayout,
    totalTextWidth: number,
  ): ContourMeasure[] {
    const graphicsPath = layout.curveGraphicsPath ?? this.generateDefaultCirclePath(80);

    this.lastResolvedPath = graphicsPath;

    return new ContourMeasureIter(graphicsPath, 1).toArray();
  }

  /**
   * 起始弧长 offset（按 textAlign）。允许负值——排满后 middle 以路径中点对称、
   * right 以路径末端右钉，左右两端各自丢弃越界字（B8 排不下不渲染，对齐 Figma）。
   * 不再钳 0，否则 middle/right 排满会退化为 left（左钉起点）。越界字靠逐字区间相交判断挡。
   */
  private getStartOffset (layout: RichTextLayout, pathLength: number, totalTextWidth: number): number {
    if (layout.textAlign === spec.TextAlignment.middle) {
      return (pathLength - totalTextWidth) / 2;
    } else if (layout.textAlign === spec.TextAlignment.right) {
      return pathLength - totalTextWidth;
    }

    return 0;
  }

  /**
   * 防裁切：旋转字形真实包围盒并集（X + Y 都实时）。
   * 抖动靠 expanding 层 offset=(canvas-frame)/2 精确抵消 canvas 扩展（坐标系守恒），
   * 配合 vertical-align 路径模式 baselineY=0，字屏幕位置只跟 pt.pos 和 frame 尺寸有关，不抖。
   * 此处仅如实报告字的真实外接范围，画布刚好包字（省留白）。
   */
  private applyAntiClipBounds (lines: RichLine[], allGlyphs: CurveGlyphInfo[]): void {
    const bounds = computeGlyphsBounds(allGlyphs);

    for (const line of lines) {
      if (isFinite(bounds.minX)) { line.contentMinX = bounds.minX; }
      if (isFinite(bounds.maxX)) { line.contentMaxX = bounds.maxX; }
      if (isFinite(bounds.minY)) { line.lineAscent = Math.max(line.lineAscent || 0, -bounds.minY); }
      if (isFinite(bounds.maxY)) { line.lineDescent = Math.max(line.lineDescent || 0, bounds.maxY); }
    }
  }

  /**
   * 默认闭合圆路径（对齐 Figma text on path 默认形态）。
   * 4 段三次贝塞尔近似圆（kappa = 4(√2-1)/3 ≈ 0.5523），顺时针，从 (r,0) 起。
   */
  private generateDefaultCirclePath (radius: number): GraphicsPath {
    const r = radius;
    const k = radius * 0.5523;   // kappa
    const path = new GraphicsPath();

    path.moveTo(r, 0);
    path.bezierCurveTo(r, k, k, r, 0, r);        // → 90°
    path.bezierCurveTo(-k, r, -r, k, -r, 0);      // → 180°
    path.bezierCurveTo(-r, -k, -k, -r, 0, -r);    // → 270°
    path.bezierCurveTo(k, -r, r, -k, r, 0);       // → 360°
    path.closePath();

    return path;
  }

  /**
   * 创建新行
   */
  private createNewLine (): RichLine {
    return {
      richOptions: [],
      offsetX: [],   // 切块起点（相对行起点）
      width: 0,
      lineHeight: 0,  // 仅用 gapPx 作为行步进
      offsetY: 0,
      chars: [],     // 每个元素为 RichCharDetail 数组（切块内字符）
      lineAscent: 0,
      lineDescent: 0,
    };
  }
}
