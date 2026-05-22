import { canvasPool } from '../canvas-pool';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Texture, TextureSourceType } from '../texture';

/**
 * 字重（对齐 canvas 2d font 字符串可接受值）
 */
export type FontWeight = 'normal' | 'bold' | number;

/**
 * 字形（对齐 canvas 2d font 字符串可接受值）
 */
export type FontStyle = 'normal' | 'italic';

/**
 * 字形纹理超采样倍数。canvas 按 `fontSize * FONT_SCALE` 渲染，纹理像素也是 scale 倍，
 * 但 quad 仍按 1x 逻辑尺寸绘制 — 双线性 downsample 后比原 1x 渲染清晰得多
 */
export const FONT_SCALE = 2;

/**
 * 单张字符 atlas 的边长(像素,scale 后的实际像素,非逻辑尺寸)。
 * 512×512 在 24px 字号下约可容纳 250+ 字形,常见 demo 文本足够
 */
export const ATLAS_SIZE = 512;

/**
 * 单个字形在 atlas 中的位置 / 度量。
 *
 * `px/py/pw/ph` 是 atlas canvas 像素（scale 后）。
 * `width` 是逻辑像素宽度（= pw / FONT_SCALE），用于 quad 宽 + cursor advance
 */
export type GlyphInfo = {
  px: number,
  py: number,
  pw: number,
  ph: number,
  width: number,
};

/**
 * 一种字体（family + weight + style + size 唯一确定）对应一张 atlas。
 *
 * Skyline 风格 packer：行内堆字，行尾换行，行高 = (ascent+descent) * FONT_SCALE。
 * atlas 满后 `ensureChar` 返回 null，调用方应跳过该字（不再扩页，v1 范围）。
 *
 * canvas 内容变更后需要 `uploadIfDirty` 重新上传到纹理 — 由调用方在使用纹理前主动触发，
 * 避免每加一字都 upload 一次造成的 GL 开销
 */
export class GlyphAtlas {
  /** atlas canvas（像素 = ATLAS_SIZE × ATLAS_SIZE，自有不进 canvasPool） */
  readonly canvas: HTMLCanvasElement;
  /** 与 canvas 绑定的纹理，内容变更后通过 updateSource 重传 */
  readonly texture: Texture;

  /** 行高（逻辑像素，= ascent + descent），所有字共享 */
  readonly lineHeight: number;
  /** 行 ascent（逻辑像素，baseline 距行顶距离） */
  readonly ascent: number;
  /** 行 descent（逻辑像素，baseline 距行底距离） */
  readonly descent: number;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly glyphs = new Map<string, GlyphInfo>();
  /** 行高（像素，scale 后） */
  private readonly lineHeightPx: number;
  /** baseline 距行顶距离（像素，scale 后） */
  private readonly ascentPx: number;

  /** packer 状态：下一字开始的左上角像素位置 */
  private currentX = 0;
  private currentY = 0;
  /** atlas 已满，后续 ensureChar 全部失败（避免反复 measureText） */
  private full = false;
  /** 自上次 upload 以来 canvas 是否有新字写入 */
  private dirty = true;

  constructor (
    private engine: Engine,
    private readonly scaledFontString: string,
    ascent: number,
    descent: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: false });

    if (!ctx) {
      throw new Error('GlyphAtlas: failed to get 2d context');
    }
    this.ctx = ctx;
    ctx.font = scaledFontString;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';

    this.ascent = ascent;
    this.descent = descent;
    this.lineHeight = ascent + descent;
    this.ascentPx = Math.ceil(ascent * FONT_SCALE);
    this.lineHeightPx = Math.ceil((ascent + descent) * FONT_SCALE);

    this.texture = Texture.create(engine, {
      sourceType: TextureSourceType.image,
      image: this.canvas,
      target: glContext.TEXTURE_2D,
      flipY: true,
      magFilter: glContext.LINEAR,
      minFilter: glContext.LINEAR,
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
    });
    this.texture.initialize();
  }

  /**
   * 取（必要时渲染并打包）单字。返回 GlyphInfo 或 null（atlas 已满）
   */
  ensureChar (char: string): GlyphInfo | null {
    const cached = this.glyphs.get(char);

    if (cached) {
      return cached;
    }
    if (this.full) {
      return null;
    }

    const ctx = this.ctx;

    // 每次重设字体，防御外部潜在污染（虽然 ctx 私有）
    ctx.font = this.scaledFontString;
    // measureText 用的是 scaledFontString，advance 已经是 scale 后的像素，不能再乘 FONT_SCALE
    const advancePx = ctx.measureText(char).width;
    const cellW = Math.max(1, Math.ceil(advancePx));
    const cellH = this.lineHeightPx;

    // 行尾换行
    if (this.currentX + cellW > ATLAS_SIZE) {
      this.currentX = 0;
      this.currentY += cellH;
    }
    // atlas 满，后续不再尝试
    if (this.currentY + cellH > ATLAS_SIZE) {
      this.full = true;
      console.warn(`GlyphAtlas full, dropping char "${char}"`);

      return null;
    }

    const px = this.currentX;
    const py = this.currentY;

    ctx.fillText(char, px, py + this.ascentPx);

    this.currentX += cellW;
    this.dirty = true;

    const info: GlyphInfo = {
      px, py, pw: cellW, ph: cellH,
      width: cellW / FONT_SCALE,
    };

    this.glyphs.set(char, info);

    return info;
  }

  /**
   * 若有新字写入 canvas，把整张 canvas 重新上传到纹理。调用方在使用纹理（flushBatch）前调用
   */
  uploadIfDirty (): void {
    if (!this.dirty) {
      return;
    }
    this.texture.updateSource({
      sourceType: TextureSourceType.image,
      image: this.canvas,
      target: glContext.TEXTURE_2D,
      flipY: true,
      magFilter: glContext.LINEAR,
      minFilter: glContext.LINEAR,
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
    });
    this.dirty = false;
  }

  dispose (): void {
    this.texture.dispose();
    this.glyphs.clear();
  }
}

/**
 * 字符 atlas 缓存。每种字体（family + weight + style + size）分配一张
 * `ATLAS_SIZE × ATLAS_SIZE` 的离屏 canvas atlas，字符按需逐个绘制并打包，
 * `Graphics.drawText` 通过逐字 quad 引用 atlas 子矩形渲染。
 *
 * - 同一段文本不同颜色不会重复 upload（颜色由顶点 `vColor` 乘上字形 alpha）
 * - 同一字体/字号下重复字符只渲染一次，显著减少 canvas → texture 上传次数
 *
 * 入参全部展开（避免调用方每帧创建临时 style 对象触发 GC）
 */
export class TextCache {
  /** fontKey -> 该字体的字符 atlas */
  private readonly atlases = new Map<string, GlyphAtlas>();

  constructor (private engine: Engine) { }

  /**
   * 取(必要时新建)对应字体的字符 atlas
   */
  getAtlas (
    fontSize: number,
    fontFamily: string,
    fontWeight: FontWeight,
    fontStyle: FontStyle,
  ): GlyphAtlas {
    const fontKey = `${fontStyle}|${fontWeight}|${fontSize}|${fontFamily}`;
    const cached = this.atlases.get(fontKey);

    if (cached) {
      return cached;
    }

    const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const scaledFontString = `${fontStyle} ${fontWeight} ${fontSize * FONT_SCALE}px ${fontFamily}`;

    // 用 'M' 探一次得到字体级 ascent/descent（整张 atlas 共享行高，各字 baseline 对齐）
    const probeCanvas = canvasPool.getCanvas();
    const probeCtx = probeCanvas.getContext('2d');
    let ascent = fontSize * 0.8;
    let descent = fontSize * 0.2;

    if (probeCtx) {
      probeCtx.font = fontString;
      const m = probeCtx.measureText('M');

      ascent = m.actualBoundingBoxAscent || ascent;
      descent = m.actualBoundingBoxDescent || descent;
    }
    canvasPool.saveCanvas(probeCanvas);

    const atlas = new GlyphAtlas(this.engine, scaledFontString, ascent, descent);

    this.atlases.set(fontKey, atlas);

    return atlas;
  }

  /**
   * 把所有 dirty 的 atlas canvas 内容上传到对应纹理。
   * 由 `Graphics.flushBatch` 在 drawGeometry 前调用，确保即将采样的 atlas 纹理是最新的；
   * 一帧多次 drawText 共写同一 atlas 时，只在 flush 边界 upload 一次，避免逐 drawText 反复重传
   */
  uploadDirty (): void {
    for (const atlas of this.atlases.values()) {
      atlas.uploadIfDirty();
    }
  }

  /**
   * 清空所有 atlas 并 dispose 对应纹理。Engine dispose 时调用
   */
  dispose (): void {
    for (const atlas of this.atlases.values()) {
      atlas.dispose();
    }
    this.atlases.clear();
  }
}
