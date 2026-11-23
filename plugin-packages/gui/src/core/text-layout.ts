import { TextCache } from '@galacean/effects';
import type { TextLineLayout, TextMeasurement } from '@galacean/effects';

export type TextMeasure = (text: string) => Pick<TextMeasurement, 'width'>;

export function getTextBoundaries (text: string): number[] {
  const boundaries = [0];
  let offset = 0;

  for (const character of TextCache.graphemeSegmenter(text)) {
    offset += character.length;
    boundaries.push(offset);
  }

  return boundaries;
}

/** Keep text indices compatible with textarea offsets without splitting a grapheme. */
export function snapTextIndex (text: string, index: number): number {
  const limit = Math.max(0, Math.min(text.length, Math.floor(index)));
  let result = 0;

  for (const boundary of getTextBoundaries(text)) {
    if (boundary > limit) {break;}
    result = boundary;
  }

  return result;
}

export function getTextPosition (layout: TextLineLayout, index: number): number {
  let character = 0;

  while (character + 1 < layout.boundaries.length && layout.boundaries[character + 1] <= index) {
    character++;
  }

  return layout.positions[character];
}

export function getTextIndexAtPosition (layout: TextLineLayout, x: number): number {
  for (let i = 1; i < layout.positions.length; i++) {
    if (x < (layout.positions[i - 1] + layout.positions[i]) * 0.5) {return layout.boundaries[i - 1];}
  }

  return layout.boundaries[layout.boundaries.length - 1];
}

/** Measure the replacement together with its prefix so their kerning is included. */
export function ellipsizeText (text: string, width: number, measure: TextMeasure, ellipsis = '…', force = false): string {
  if (!force && measure(text).width <= width) {return text;}
  if (measure(ellipsis).width > width) {return '';}
  let prefix = '';
  let result = ellipsis;

  for (const character of TextCache.graphemeSegmenter(text)) {
    prefix += character;
    const candidate = prefix + ellipsis;

    if (measure(candidate).width > width) {break;}
    result = candidate;
  }

  return result;
}
