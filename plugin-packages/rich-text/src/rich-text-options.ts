import { spec, TextStyle, type FancyConfig, type FancyRenderLayer, type FancyScopeResolution } from '@galacean/effects';
import { toRGBA } from './color-utils';
import { generateProgram } from './rich-text-parser';

export type RichTextRangeFancyLayers = Record<string, FancyRenderLayer[]>;

/**
 * Runtime RichText options. The extra fancy fields are intentionally kept
 * here, instead of changing the base scene specification, so the plugin can
 * consume a whole RichText string plus its resolved fancy snapshot.
 */
export interface RichTextContentOptions extends spec.RichTextContentOptions {
  fancyConfig?: FancyConfig,
  /** @deprecated Temporary compatibility input. */
  rangeFancyLayers?: RichTextRangeFancyLayers,
  /** Runtime-only padding budget for interactive fancy parameters. */
  fancyRenderPadding?: {
    left?: number,
    right?: number,
    top?: number,
    bottom?: number,
  },
}

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
  /** Optional range-level fancy layers, resolved before layout is split into lines. */
  rangeFancyLayers?: FancyRenderLayer[],
}

/** Parses RichText markup into deterministic source ranges. */
export function parseRichTextOptions (
  text: string,
  textStyle: TextStyle,
  rangeFancyLayersById?: RichTextRangeFancyLayers,
  fancyResolution?: FancyScopeResolution,
): RichTextOptions[] {
  const optionsList: RichTextOptions[] = [];
  let sourceRangeIndex = 0;
  const program = generateProgram((rangeText, context) => {
    const currentSourceRangeIndex = sourceRangeIndex++;
    const sourceRangeId = `range-${currentSourceRangeIndex}`;
    const legacyRangeLayers = rangeFancyLayersById?.[sourceRangeId];
    const resolvedRangeLayers = legacyRangeLayers ?? (
      fancyResolution
        ? TextStyle.resolveRangeOverride(
          fancyResolution,
          fancyResolution.rangeOverrides[currentSourceRangeIndex],
          textStyle.textColor,
        )
        : undefined
    );
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
        rangeFancyLayers: resolvedRangeLayers,
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
