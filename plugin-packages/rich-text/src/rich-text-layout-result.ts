import type { TextStyle } from '@galacean/effects';
import type {
  HorizontalAlignResult, OverflowResult, RichLine, VerticalAlignResult,
} from './strategies/rich-text-interfaces';

/** 已完成布局的字符框，坐标位于最终画布的逻辑像素空间。 */
export interface RichTextCharacterBox {
  readonly index: number,
  readonly length: number,
  readonly x: number,
  readonly y: number,
  readonly width: number,
  readonly height: number,
}

/** 编辑器消费的最终布局视图。 */
export interface RichTextEditingLayout {
  readonly width: number,
  readonly height: number,
  readonly characters: readonly RichTextCharacterBox[],
}

/** 渲染和编辑共用的最终字形位置。 */
export interface RichTextGlyph extends RichTextCharacterBox {
  readonly char: string,
  readonly baselineY: number,
}

/** 一个具有相同绘制样式的字形片段。 */
export interface RichTextDrawRun {
  readonly fontSize: number,
  readonly fontFamily: TextStyle['fontFamily'],
  readonly fontWeight: TextStyle['textWeight'],
  readonly fontStyle: TextStyle['fontStyle'],
  readonly fontColor: TextStyle['textColor'],
  readonly glyphs: readonly RichTextGlyph[],
}

/**
 * 富文本策略管线的最终只读结果。
 *
 * 坐标已应用内容缩放、对齐和溢出偏移；画布渲染和编辑器命中应读取同一结果。
 */
export interface RichTextLayoutResult {
  readonly width: number,
  readonly height: number,
  readonly drawRuns: readonly RichTextDrawRun[],
  readonly characters: readonly RichTextCharacterBox[],
}

/** 将行内布局坐标解析为渲染与编辑器可共享的最终坐标。 */
export function createRichTextLayoutResult (
  lines: readonly RichLine[],
  horizontalResult: HorizontalAlignResult,
  verticalResult: VerticalAlignResult,
  overflowResult: OverflowResult,
  textStyle: TextStyle,
): RichTextLayoutResult {
  const drawRuns: RichTextDrawRun[] = [];
  const characters: RichTextGlyph[] = [];

  lines.forEach((line, lineIndex) => {
    const lineOffsetX = (horizontalResult.lineOffsets[lineIndex] ?? 0) + overflowResult.renderOffsetX;
    const baselineY = (verticalResult.lineYOffsets[lineIndex] ?? 0) + overflowResult.renderOffsetY;
    const glyphHeight = (line.lineAscent ?? 0) + (line.lineDescent ?? 0);
    const selectionHeight = Math.max(line.lineHeight, glyphHeight);
    const top = baselineY - (line.lineAscent ?? 0) - Math.max(0, (line.lineHeight - glyphHeight) / 2);
    const isEmptyLine = line.chars.every(segment => segment.length === 0);

    line.richOptions.forEach((options, segmentIndex) => {
      const segmentStartX = line.offsetX[segmentIndex] ?? 0;
      const glyphs: RichTextGlyph[] = [];
      const chars = line.chars[segmentIndex] ?? [];
      const fontSize = options.fontSize;

      if (isEmptyLine && segmentIndex === 0) {
        glyphs.push(Object.freeze({
          char: '', index: options.textOffset ?? 0, length: 0,
          x: lineOffsetX + segmentStartX, y: top, width: 0, height: selectionHeight, baselineY,
        }));
      } else {
        chars.forEach((char, charIndex) => {
          const nextX = chars[charIndex + 1]?.x
            ?? ((line.offsetX[segmentIndex + 1] ?? line.width) - segmentStartX);

          glyphs.push(Object.freeze({
            char: char.char, index: char.index, length: char.char.length,
            x: lineOffsetX + segmentStartX + char.x, y: top,
            width: nextX - char.x, height: selectionHeight, baselineY,
          }));
        });
      }

      if (!glyphs.length) { return; }
      const fontColor = Object.freeze([...(options.fontColor ?? textStyle.textColor)]) as TextStyle['textColor'];

      drawRuns.push(Object.freeze({
        fontSize,
        fontFamily: options.fontFamily ?? textStyle.fontFamily,
        fontWeight: options.fontWeight ?? textStyle.textWeight,
        fontStyle: options.fontStyle ?? textStyle.fontStyle,
        fontColor,
        glyphs: Object.freeze(glyphs),
      }));
      characters.push(...glyphs);
    });
  });

  return Object.freeze({
    width: overflowResult.canvasWidth,
    height: overflowResult.canvasHeight,
    drawRuns: Object.freeze(drawRuns),
    characters: Object.freeze(characters),
  });
}
