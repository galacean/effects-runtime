import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Texture } from '../texture';

/**
 * 字重(对齐 canvas 2d font 字符串可接受值)
 */
export type FontWeight = 'normal' | 'bold' | number;

/**
 * 字形(对齐 canvas 2d font 字符串可接受值)
 */
export type FontStyle = 'normal' | 'italic';

type CacheEntry = {
  texture: Texture,
  /** 文本绘制宽度(像素,纹理宽) */
  width: number,
  /** 文本绘制高度(像素,纹理高,= ascent + descent) */
  height: number,
};

const DEFAULT_MAX_ENTRIES = 64;

/**
 * 字形纹理超采样倍数。canvas 按 `fontSize * FONT_SCALE` 渲染,纹理像素也是 scale 倍,
 * 但 quad 仍按 1x 逻辑尺寸绘制 — 双线性 downsample 后比原 1x 渲染清晰得多
 */
const FONT_SCALE = 2;

/**
 * 文本纹理 LRU 缓存。
 *
 * 每条文本(不分颜色)对应一张离屏 canvas 渲染的白色字体纹理。命中即返回旧 Texture;
 * 未命中时用自有的离屏 canvas 渲染并上传新 Texture。容量满时按 LRU 顺序 dispose 最旧条目。
 *
 * 颜色由 `Graphics.drawText` 的 `color` 参数透传到 vColor,纹理只负责字形 alpha,
 * 所以同一段文本不同颜色不会重复 upload。
 *
 * 入参全部展开(避免调用方每帧创建临时 style 对象触发 GC)
 */
export class TextCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;

  /** 渲染字形纹理用的离屏 canvas。每次 render 复用,canvas resize 自动清空 */
  private renderCanvas: HTMLCanvasElement | null = null;
  private renderCtx: CanvasRenderingContext2D | null = null;

  constructor (private engine: Engine, maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  /**
   * 取(必要时渲染)文本纹理。`text` 为空字符串时返回 null,调用方应跳过绘制
   */
  get (
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: FontWeight,
    fontStyle: FontStyle,
  ): CacheEntry | null {
    if (!text) {
      return null;
    }
    const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const key = text + '|' + fontString;

    const cached = this.cache.get(key);

    if (cached) {
      // LRU promote:删除再 set 把它放到 Map 末尾(最近使用)
      this.cache.delete(key);
      this.cache.set(key, cached);

      return cached;
    }

    const scaledFontString = `${fontStyle} ${fontWeight} ${fontSize * FONT_SCALE}px ${fontFamily}`;
    const entry = this.render(text, fontString, scaledFontString, fontSize);

    if (!entry) {
      return null;
    }
    this.cache.set(key, entry);
    this.evictIfNeeded();

    return entry;
  }

  /**
   * 清空所有缓存条目并 dispose 对应纹理。Engine dispose 时调用
   */
  dispose (): void {
    for (const entry of this.cache.values()) {
      entry.texture.dispose();
    }
    this.cache.clear();

    this.renderCanvas = null;
    this.renderCtx = null;
  }

  private evictIfNeeded (): void {
    while (this.cache.size > this.maxEntries) {
      const firstKey = this.cache.keys().next().value;

      if (firstKey === undefined) {
        break;
      }
      const firstEntry = this.cache.get(firstKey);

      if (firstEntry) {
        firstEntry.texture.dispose();
      }
      this.cache.delete(firstKey);
    }
  }

  /**
   * 离屏渲染指定文本到一张白色字形纹理(2x 超采样)。失败时返回 null。
   *
   * 返回的 `width` / `height` 是 1x 逻辑尺寸(用于 quad 绘制),纹理像素是 scale 倍
   */
  private render (
    text: string,
    fontString: string,
    scaledFontString: string,
    fontSize: number,
  ): CacheEntry | null {
    if (!this.renderCtx) {
      this.renderCanvas = document.createElement('canvas');
      this.renderCtx = this.renderCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!this.renderCtx || !this.renderCanvas) {
      return null;
    }
    const canvas = this.renderCanvas;
    const ctx = this.renderCtx;

    // 1x 字体测量逻辑尺寸
    ctx.font = fontString;
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
    const logicalWidth = Math.max(1, Math.ceil(metrics.width));
    const logicalHeight = Math.max(1, Math.ceil(ascent + descent));

    // 实际 canvas 像素 = 逻辑 * scale,canvas resize 会重置 ctx 状态需重新设字体
    const pixelWidth = logicalWidth * FONT_SCALE;
    const pixelHeight = logicalHeight * FONT_SCALE;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    ctx.font = scaledFontString;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.fillText(text, 0, ascent * FONT_SCALE);

    const imageData = ctx.getImageData(0, 0, pixelWidth, pixelHeight);
    const texture = Texture.createWithData(
      this.engine,
      {
        data: new Uint8Array(imageData.data),
        width: pixelWidth,
        height: pixelHeight,
      },
      {
        flipY: true,
        magFilter: glContext.LINEAR,
        minFilter: glContext.LINEAR,
        wrapS: glContext.CLAMP_TO_EDGE,
        wrapT: glContext.CLAMP_TO_EDGE,
      },
    );

    return { texture, width: logicalWidth, height: logicalHeight };
  }
}
