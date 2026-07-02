import { type TextStyle, spec } from '@galacean/effects';
import type { ContourMeasure } from '@galacean/effects';
import { ContourMeasureIter, GraphicsPath } from '@galacean/effects';
import { computeGlyphsBounds } from './glyph-bounds';
import type { CurveGlyphInfo } from './glyph-bounds';
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
 * 富文本沿路径排版策略。
 * 字沿 curveGraphicsPath 排，无路径用默认闭合圆。
 */
export class RichWrapOnPathStrategy implements RichWrapStrategy {
  computeLines (
    processedOptions: RichTextOptions[],
    context: CanvasRenderingContext2D,
    style: TextStyle,
    layout: RichTextLayout,
    letterSpace: number,
  ): WrapResult {
    const gapPx = layout.lineHeight || 0;
    const scaleFactor = 1 / 10; // context.font 用 10px 测量

    // 预测量字宽和总宽
    const { segMeasurements, totalTextWidth } = this.measureSegments(processedOptions, context, style, layout, letterSpace, scaleFactor);

    // 解析路径取 contours
    const contours = this.resolvePath(layout, totalTextWidth);

    if (contours.length === 0) {
      return { lines: [], maxLineWidth: 0, totalHeight: 0, bboxTop: 0, bboxBottom: 0, bboxHeight: 0 };
    }

    // 逐 contour 排一份完整文字
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

        // 逐字沿曲线取点，越界字跳过但间距照推，避免排满丢字后剩余字偏移
        for (let i = 0; i < charWidths.length; i++) {
          const ch = options.text[i];
          const charWidth = charWidths[i];

          if (!isFirstChar) { currentArc += letterSpace; }
          const charEndArc = currentArc + charWidth;

          // 越界字区间与 [0, pathLength] 比较：左外跳过、右外停排。
          // getPosTan 会把越界弧长钳到端点产生重叠字，这里显式挡掉。
          if (charEndArc <= 0) {
            currentArc = charEndArc;
            isFirstChar = false;

            continue;
          }
          if (currentArc >= pathLength) {
            break;
          }

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
        // charDetail.x 已是路径绝对坐标，段起点偏移必须为 0，否则多段会双计
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

    // 防裁切：算真实包围盒写入行度量
    this.applyAntiClipBounds(lines, allGlyphs);

    // 计算 bbox
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
   * 逐段逐字测宽，返回各段度量 + 总宽（含段间 letterSpace）。
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
      // 段内字间距：首字不加
      segWidth += Math.max(0, charWidths.length - 1) * letterSpace;
      totalTextWidth += segWidth;
      if (charWidths.length > 0) { nonEmptySegments++; }

      segMeasurements.push({ options, charWidths, fontAsc, fontDesc });
    });

    // 段间字间距：跨段首字同样加 letterSpace，total 要补 (段数-1) 个
    totalTextWidth += Math.max(0, nonEmptySegments - 1) * letterSpace;

    return { segMeasurements, totalTextWidth };
  }

  /**
   * 取路径 contours。无曲线用默认闭合圆，不回写 layout。
   */
  private resolvePath (
    layout: RichTextLayout,
    totalTextWidth: number,
  ): ContourMeasure[] {
    const graphicsPath = layout.curveGraphicsPath ?? this.generateDefaultCirclePath(80);

    return new ContourMeasureIter(graphicsPath, 1).toArray();
  }

  /**
   * 起始弧长。允许负值：排满后 middle 以路径中点对称、right 钉末端，
   * 越界字由循环里的区间判断丢弃。
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
   * 算旋转字形真实包围盒，写入行的 contentMinX/MaxX 和 lineAscent/Descent，
   * 供 overflow 检测溢出防裁切。
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
   * 默认闭合圆，4 段三次贝塞尔近似（kappa ≈ 0.5523），顺时针从 (r,0) 起。
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
      offsetX: [],
      width: 0,
      lineHeight: 0,
      offsetY: 0,
      chars: [],
      lineAscent: 0,
      lineDescent: 0,
    };
  }
}
