import { canvasPool } from '../canvas-pool';
import type { CanvasAndContext } from '../canvas-pool';
import type { Engine } from '../engine';
import { EventEmitter } from '../events';
import { glContext } from '../gl';
import { Texture, TextureSourceType } from '../texture';

export type FontWeight = 'normal' | 'bold' | number;
export type FontStyle = 'normal' | 'italic' | 'oblique';

export const ATLAS_SIZE = 512;
const BASE_FONT_SIZE = 100;
const METRICS_STRING = '|ÉqÅM';

export type BitmapFontStyle = {
  fontFamily: string | string[],
  fontSize?: number,
  fontWeight?: FontWeight,
  fontStyle?: FontStyle,
  fontVariant?: 'normal' | 'small-caps',
  textBaseline?: CanvasTextBaseline,
  lineHeight?: number,
};

export type GlyphAtlasOptions = {
  style: BitmapFontStyle,
  resolution?: number,
  padding?: number,
  skipKerning?: boolean,
  overrideSize?: boolean,
  textureSize?: number,
  mipmap?: boolean,
};

export type FontMetrics = { ascent: number, descent: number, fontSize: number };

const fontMetricsCache: Record<string, FontMetrics> = Object.create(null);
const glyphMeasurementCache = new Map<string, { width: number, height: number }>();

export type GlyphFrame = { x: number, y: number, width: number, height: number };

export type GlyphInfo = {
  id: number | undefined,
  xOffset: number,
  yOffset: number,
  xAdvance: number,
  kerning: Record<string, number>,
  page?: number,
  frame?: GlyphFrame,
};

export type GlyphAtlasPage = {
  canvasAndContext: CanvasAndContext,
  texture: Texture,
  /** Source dimensions and resolution in font measurement units. */
  width: number,
  height: number,
  resolution: number,
};

type FontPage = GlyphAtlasPage & { dirty: boolean };

export type GlyphLayoutLine = {
  width: number,
  charPositions: number[],
  chars: string[],
  spaceWidth: number,
  spacesIndex: number[],
};

export type GlyphLayout = {
  width: number,
  height: number,
  scale: number,
  offsetY: number,
  lines: GlyphLayoutLine[],
};

/** A dynamic bitmap font with shared texture pages and normalized glyph metrics. */
export class GlyphAtlas extends EventEmitter<{ destroy: [font: GlyphAtlas] }> {
  readonly chars: Record<string, GlyphInfo> = Object.create(null);
  readonly pages: GlyphAtlasPage[] = [];
  readonly baseMeasurementFontSize = BASE_FONT_SIZE;
  readonly baseLineOffset = 0;
  readonly baseRenderedFontSize: number;
  readonly fontMetrics: FontMetrics;
  readonly lineHeight: number;
  readonly resolution: number;
  private readonly style: BitmapFontStyle;
  private readonly padding: number;
  private readonly skipKerning: boolean;
  private readonly textureSize: number;
  private readonly mipmap: boolean;
  private readonly measurement: CanvasAndContext;
  private readonly measureCache: Record<string, number> = Object.create(null);
  private currentChars: string[] = [];
  private currentX = 0;
  private currentY = 0;
  private currentMaxCharHeight = 0;
  private currentPageIndex = -1;

  constructor (private engine: Engine, options: GlyphAtlasOptions) {
    super();
    this.style = {
      fontSize: 26, fontWeight: 'normal', fontStyle: 'normal', fontVariant: 'normal',
      textBaseline: 'alphabetic', lineHeight: 0, ...options.style,
    };
    this.baseRenderedFontSize = options.overrideSize ? BASE_FONT_SIZE : this.style.fontSize!;
    this.style.fontSize = BASE_FONT_SIZE;
    this.resolution = options.resolution ?? 1;
    this.padding = options.padding ?? 4;
    this.skipKerning = options.skipKerning ?? false;
    this.textureSize = options.textureSize ?? ATLAS_SIZE;
    this.mipmap = options.mipmap ?? true;
    this.measurement = canvasPool.getCanvasAndContext(1, 1);
    const context = this.measurement.context;

    const font = fontString(this.style, BASE_FONT_SIZE);

    if (!fontMetricsCache[font]) {
      context.font = font;
      const metrics = context.measureText(METRICS_STRING);
      const ascent = metrics.actualBoundingBoxAscent ?? 0;
      const descent = metrics.actualBoundingBoxDescent ?? 0;

      fontMetricsCache[font] = { ascent, descent, fontSize: ascent + descent };
    }
    this.fontMetrics = fontMetricsCache[font];
    this.lineHeight = this.style.lineHeight || this.fontMetrics.fontSize
      || (options.overrideSize ? BASE_FONT_SIZE : options.style.fontSize || 26);
  }

  ensureCharacters (text: string): void {
    const charList = TextCache.graphemeSegmenter(text)
      .filter(char => !this.currentChars.includes(char))
      .filter((char, index, self) => self.indexOf(char) === index);

    if (!charList.length) {
      return;
    }
    this.currentChars = [...this.currentChars, ...charList];
    let page = this.currentPageIndex === -1 ? this.nextPage() : this.pages[this.currentPageIndex];
    let { canvas, context } = page.canvasAndContext;
    let currentX = this.currentX;
    let currentY = this.currentY;
    let currentMaxCharHeight = this.currentMaxCharHeight;
    const fontScale = this.baseRenderedFontSize / this.baseMeasurementFontSize;
    const padding = this.padding;
    const maxTextureWidth = canvas.width / this.resolution;
    const maxTextureHeight = canvas.height / this.resolution;

    for (const char of charList) {
      const metrics = this.measureGlyph(char);
      const width = metrics.width * fontScale;
      const textureGlyphWidth = Math.ceil((this.style.fontStyle === 'italic' ? 2 : 1) * width);
      const height = metrics.height * fontScale;
      const paddedWidth = textureGlyphWidth + padding * 2;
      const paddedHeight = height + padding * 2;
      const hasTexture = char !== '\n' && char !== '\r' && char !== '\t' && char !== ' ';

      if (hasTexture) {
        currentMaxCharHeight = Math.ceil(Math.max(paddedHeight, currentMaxCharHeight));
      }
      if (currentX + paddedWidth > maxTextureWidth) {
        currentY += currentMaxCharHeight;
        currentMaxCharHeight = paddedHeight;
        currentX = 0;
        if (currentY + currentMaxCharHeight > maxTextureHeight) {
          (page as FontPage).dirty = true;
          page = this.nextPage();
          ({ canvas, context } = page.canvasAndContext);
          currentX = 0;
          currentY = 0;
          currentMaxCharHeight = 0;
        }
      }

      const data: GlyphInfo = {
        id: char.codePointAt(0),
        xOffset: -(padding / fontScale),
        yOffset: -(padding / fontScale),
        xAdvance: context.measureText(char).width / fontScale,
        kerning: {},
      };

      this.chars[char] = data;
      if (hasTexture) {
        context.fillText(
          char, currentX + padding,
          currentY + padding + metrics.height * fontScale - this.fontMetrics.descent * fontScale,
        );
        const px = page.width * fontScale;
        const py = page.height * fontScale;

        data.page = this.currentPageIndex;
        data.frame = {
          x: currentX / px * page.width,
          y: currentY / py * page.height,
          width: paddedWidth / px * page.width,
          height: paddedHeight / py * page.height,
        };
        currentX += Math.ceil(paddedWidth);
      }
    }
    (page as FontPage).dirty = true;
    this.currentX = currentX;
    this.currentY = currentY;
    this.currentMaxCharHeight = currentMaxCharHeight;
    if (!this.skipKerning) {
      this.applyKerning(charList, context, fontScale);
    }
  }

  /** Layout uses grapheme indices and positions in font measurement units. */
  getLayout (text: string, fontSize: number, trimEnd = true): GlyphLayout {
    this.ensureCharacters(text);
    const chars = TextCache.graphemeSegmenter(text);
    const emptyLine = (): GlyphLayoutLine => ({ width: 0, charPositions: [], chars: [], spaceWidth: 0, spacesIndex: [] });
    const layout: GlyphLayout = {
      width: 0, height: 0, scale: fontSize / this.baseMeasurementFontSize,
      offsetY: this.baseLineOffset, lines: [emptyLine()],
    };
    let line = layout.lines[0];
    let previousChar: string | undefined;
    const scale = this.baseMeasurementFontSize / fontSize;
    const adjustedLineHeight = this.style.lineHeight ? this.style.lineHeight * scale : this.lineHeight;
    let wordWidth = 0;
    const wordChars: string[] = [];
    const wordPositions: number[] = [];

    const nextWord = (): void => {
      for (let j = 0; j < wordChars.length; j++) {
        line.chars.push(wordChars[j]);
        line.charPositions.push(wordPositions[j] + line.width);
      }
      line.width += wordWidth;
      wordWidth = 0;
      wordChars.length = 0;
      wordPositions.length = 0;
    };
    const nextLine = (): void => {
      let index = line.chars.length - 1;

      if (trimEnd) {
        while (line.chars[index] === ' ' || line.chars[index] === '\t') {
          line.width -= this.chars[line.chars[index--]].xAdvance;
          line.spacesIndex.pop();
        }
      }
      layout.width = Math.max(layout.width, line.width);
      line = emptyLine();
      layout.lines.push(line);
      layout.height += adjustedLineHeight;
    };

    for (let i = 0; i <= chars.length; i++) {
      const char = chars[i];
      const data = this.chars[char];
      const isEnd = i === chars.length;

      if (/\s/.test(char) || char === '\r' || char === '\n' || isEnd) {
        nextWord();
        if (!isEnd && data) {
          line.charPositions.push(0);
        }
        if (char === '\r' || char === '\n') {
          nextLine();
        } else if (!isEnd && data) {
          const spaceWidth = data.xAdvance + (data.kerning[previousChar!] || 0);

          line.width += spaceWidth;
          line.spaceWidth = spaceWidth;
          line.spacesIndex.push(line.charPositions.length);
          line.chars.push(char);
        }
      } else if (data) {
        const kerning = data.kerning[previousChar!] || 0;

        wordPositions.push(wordWidth + kerning);
        wordChars.push(char);
        wordWidth += data.xAdvance + kerning;
        if (/^[-\u2010\u2013\u2014\u00ad]$/.test(char)) {
          nextWord();
        }
      }
      previousChar = char;
    }
    nextLine();

    return layout;
  }

  uploadIfDirty (): void {
    for (const page of this.pages as FontPage[]) {
      if (page.dirty) {
        page.texture.updateSource({
          sourceType: TextureSourceType.image, image: page.canvasAndContext.canvas, target: glContext.TEXTURE_2D,
          flipY: true, premultiplyAlpha: true, generateMipmap: this.mipmap,
          magFilter: glContext.LINEAR, minFilter: this.mipmap ? glContext.LINEAR_MIPMAP_LINEAR : glContext.LINEAR,
          wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
        });
        page.dirty = false;
      }
    }
  }

  dispose (): void {
    this.emit('destroy', this);
    for (const listener of this.getListeners('destroy')) {
      this.off('destroy', listener);
    }
    for (const page of this.pages) {
      bitmapCanvasPool.release(page.canvasAndContext);
      page.texture.dispose();
    }
    canvasPool.releaseCanvasAndContext(this.measurement);
    const disposed = this as unknown as { chars: null, pages: null };

    disposed.chars = null;
    disposed.pages = null;
  }

  private measureGlyph (text: string): { width: number, height: number } {
    const key = text + '-' + JSON.stringify(this.style);
    const cached = glyphMeasurementCache.get(key);

    if (cached) {
      glyphMeasurementCache.delete(key);
      glyphMeasurementCache.set(key, cached);

      return cached;
    }
    if (this.fontMetrics.fontSize === 0) {
      this.fontMetrics.fontSize = BASE_FONT_SIZE;
      this.fontMetrics.ascent = BASE_FONT_SIZE;
      this.fontMetrics.descent = 0;
    }
    const context = this.measurement.context;

    context.font = fontString(this.style, BASE_FONT_SIZE);
    const lines = text.split(/(?:\r\n|\r|\n)/);
    let width = 0;

    for (const line of lines) {
      const metrics = context.measureText(line);
      const left = -(metrics.actualBoundingBoxLeft ?? 0);
      const right = metrics.actualBoundingBoxRight ?? 0;

      width = Math.max(width, metrics.width, right - left);
    }
    const lineHeight = this.style.lineHeight || this.fontMetrics.fontSize;
    const height = Math.max(lineHeight, this.fontMetrics.fontSize) + (lines.length - 1) * lineHeight;
    const measurement = { width, height };

    glyphMeasurementCache.set(key, measurement);
    if (glyphMeasurementCache.size > 1000) {
      glyphMeasurementCache.delete(glyphMeasurementCache.keys().next().value);
    }

    return measurement;
  }

  private applyKerning (newChars: string[], context: CanvasRenderingContext2D, fontScale: number): void {
    const measureCache = this.measureCache;

    for (const first of newChars) {
      for (const second of this.currentChars) {
        let c1 = measureCache[first];

        if (!c1) { c1 = measureCache[first] = context.measureText(first).width; }
        let c2 = measureCache[second];

        if (!c2) { c2 = measureCache[second] = context.measureText(second).width; }
        let total = context.measureText(first + second).width;
        let amount = total - (c1 + c2);

        if (amount && this.chars[first]) {
          this.chars[first].kerning[second] = amount / fontScale;
        }
        total = context.measureText(first + second).width;
        amount = total - (c1 + c2);
        if (amount && this.chars[second]) {
          this.chars[second].kerning[first] = amount / fontScale;
        }
      }
    }
  }

  private nextPage (): GlyphAtlasPage {
    this.currentPageIndex++;
    const canvasAndContext = bitmapCanvasPool.get(this.textureSize, this.textureSize, this.resolution);
    const { canvas, context } = canvasAndContext;

    context.scale(this.resolution, this.resolution);
    context.font = fontString(this.style, this.baseRenderedFontSize);
    context.textBaseline = this.style.textBaseline!;
    context.fillStyle = '#ffffff';
    context.shadowColor = 'black';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    const resolution = this.resolution * (this.baseRenderedFontSize / this.baseMeasurementFontSize);
    const texture = Texture.create(this.engine, {
      sourceType: TextureSourceType.image, image: canvas, target: glContext.TEXTURE_2D,
      flipY: true, premultiplyAlpha: true, generateMipmap: this.mipmap,
      magFilter: glContext.LINEAR, minFilter: this.mipmap ? glContext.LINEAR_MIPMAP_LINEAR : glContext.LINEAR,
      wrapS: glContext.CLAMP_TO_EDGE, wrapT: glContext.CLAMP_TO_EDGE,
    });

    texture.initialize();
    const page: FontPage = {
      canvasAndContext, texture, resolution, width: canvas.width / resolution, height: canvas.height / resolution, dirty: true,
    };

    this.pages[this.currentPageIndex] = page;

    return page;
  }
}

/** Shared dynamic fonts, independent of the requested display size. */
export class TextCache {
  static graphemeSegmenter: (text: string) => string[] = (() => {
    // eslint-disable-next-line compat/compat
    if (typeof Intl?.Segmenter === 'function') {
      // eslint-disable-next-line compat/compat
      const segmenter = new Intl.Segmenter();

      return (text: string) => {
        const result: string[] = [];
        let index = 0;

        for (const segment of segmenter.segment(text)) {
          result[index++] = segment.segment;
        }

        return result;
      };
    }

    return (text: string) => Array.from(text);
  })();

  private readonly atlases = new Map<string, GlyphAtlas>();
  private _resolution: number;

  constructor (private engine: Engine) {
    this._resolution = engine.displayServer.pixelRatio;
  }

  get resolution (): number { return this._resolution; }

  getAtlas (fontSize: number, fontFamily: string, fontWeight: FontWeight, fontStyle: FontStyle): GlyphAtlas {
    const resolution = this.engine.displayServer.pixelRatio;

    if (resolution !== this.resolution) {
      this.clear();
      this._resolution = resolution;
    }
    const key = fontFamily + '-' + fontStyle + '-normal-' + fontWeight;
    let font = this.atlases.get(key);

    if (!font) {
      font = new GlyphAtlas(this.engine, {
        style: { fontFamily, fontSize, fontWeight, fontStyle },
        resolution, overrideSize: true, skipKerning: false, padding: 4,
      });
      font.once('destroy', () => this.atlases.delete(key));
      this.atlases.set(key, font);
    }

    return font;
  }

  uploadDirty (): void {
    for (const atlas of this.atlases.values()) {
      atlas.uploadIfDirty();
    }
  }

  dispose (): void { this.clear(); }

  private clear (): void {
    for (const atlas of this.atlases.values()) {
      atlas.dispose();
    }
    this.atlases.clear();
  }
}

function fontString (style: BitmapFontStyle, fontSize: number): string {
  const generic = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
  const families = Array.isArray(style.fontFamily) ? style.fontFamily.slice() : style.fontFamily.split(',');

  for (let i = families.length - 1; i >= 0; i--) {
    let family = families[i].trim();

    if (!(/(["'])[^'"]+\1/).test(family) && !generic.includes(family)) {
      family = '"' + family + '"';
    }
    families[i] = family;
  }

  return style.fontStyle + ' ' + style.fontVariant + ' ' + style.fontWeight + ' ' + fontSize + 'px ' + families.join(',');
}

function nextPowerOfTwo (value: number): number {
  value += value === 0 ? 1 : 0;
  value--;
  value |= value >>> 1;
  value |= value >>> 2;
  value |= value >>> 4;
  value |= value >>> 8;
  value |= value >>> 16;

  return value + 1;
}

/** Bitmap pages keep their context creation settings separate from readback canvases. */
class BitmapCanvasPool {
  private readonly canvases: Record<number, CanvasAndContext[]> = Object.create(null);

  get (width: number, height: number, resolution: number): CanvasAndContext {
    width = nextPowerOfTwo(Math.ceil(width * resolution - 1e-6));
    height = nextPowerOfTwo(Math.ceil(height * resolution - 1e-6));
    const key = (width << 17) + (height << 1);
    const pool = this.canvases[key] ?? (this.canvases[key] = []);
    let canvasAndContext = pool.pop();

    if (!canvasAndContext) {
      const canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;
      canvasAndContext = { canvas, context: canvas.getContext('2d')! };
    }

    return canvasAndContext;
  }

  release (canvasAndContext: CanvasAndContext): void {
    const { canvas, context } = canvasAndContext;
    const key = (canvas.width << 17) + (canvas.height << 1);

    context.resetTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    this.canvases[key].push(canvasAndContext);
  }
}

const bitmapCanvasPool = new BitmapCanvasPool();
