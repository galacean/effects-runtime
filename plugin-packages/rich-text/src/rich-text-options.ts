import { spec, type TextStyle } from '@galacean/effects';
import { toRGBA } from './color-utils';
import { generateProgram } from './rich-text-parser';

export interface RichTextOptions {
  text: string,
  fontSize: number,
  fontFamily?: string,
  fontWeight?: spec.TextWeight,
  fontStyle?: spec.FontStyle,
  fontColor?: spec.vec4,
  isNewLine: boolean,
  /** Stable id of the parser range. It remains unchanged after wrapping. */
  sourceRangeId: string,
}

/** Parses RichText markup into deterministic source ranges. */
export function parseRichTextOptions (text: string, textStyle: TextStyle): RichTextOptions[] {
  const optionsList: RichTextOptions[] = [];
  let sourceRangeIndex = 0;
  const program = generateProgram((rangeText, context) => {
    const sourceRangeId = `range-${sourceRangeIndex++}`;
    let normalizedText = rangeText;

    if (/^\n+$/.test(normalizedText)) {
      normalizedText = normalizedText.replace(/\n/g, '\n ');
    }

    normalizedText.split('\n').forEach((segmentText, index) => {
      const options: RichTextOptions = {
        text: segmentText,
        fontSize: textStyle.fontSize,
        isNewLine: index > 0,
        sourceRangeId,
      };

      if ('b' in context) {
        options.fontWeight = spec.TextWeight.bold;
      }
      if ('i' in context) {
        options.fontStyle = spec.FontStyle.italic;
      }
      if ('size' in context && context.size) {
        options.fontSize = parseInt(context.size, 10);
      }
      if ('color' in context && context.color) {
        options.fontColor = toRGBA(context.color);
      }
      optionsList.push(options);
    });
  });

  program(text);

  return optionsList;
}
