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
 * 字体度量探针字符串。带重音符的 É/Å 把墨水顶推到接近字体真实 ascent，
 * 单字 'M' 只有 cap height(~0.7em) 太矮，会让 CJK / 带重音字顶部越过 cell 上界被裁
 */
const METRICS_STRING = '|ÉqÅ';

/** 字体度量基线符号 */
const BASELINE_SYMBOL = 'M';

/**
 * 字形 cell 四周留白（逻辑像素）。ink 略超字体度量、或 italic 斜体越界时由它吸收，
 * 保证 cell 采样矩形内不裁切字形
 */
const GLYPH_PADDING = 4;

/**
 * 单个字形在 atlas 中的位置 / 度量。
 *
 * `px/py/pw/ph` 是 atlas canvas 像素（scale 后，含四周 padding）。
 * `advance` 是逻辑像素光标前进量（1x，不含 padding）— quad 宽度含 padding，
 * 但相邻字只按 advance 前进，padding 区透明因此重叠无妨。
 * `paddingLeft` 是逻辑像素左侧留白（1x），quad 起点左偏此量使字形 ink 落在 cursorX
 */
export type GlyphInfo = {
  px: number,
  py: number,
  pw: number,
  ph: number,
  advance: number,
  paddingLeft: number,
};

/**
 * 一种字体（family + weight + style + size 唯一确定）对应一张 atlas。
 *
 * Skyline 风格 packer：行内堆字，行尾换行，cell 高 = ceil((fontHeight + padding*2) * 1)，
 * 所有字共用同一 cell 高与 baseline，实现同行 baseline 对齐。
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

  /** cell 高（逻辑像素，含 padding），用于 quad 高度 */
  readonly lineHeight: number;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly glyphs = new Map<string, GlyphInfo>();
  /** baseline 距 cell 顶距离（像素，scale 后，含顶部 padding） */
  private readonly baselinePx: number;
  /** cell 高（像素，scale 后，含 padding） */
  private readonly cellHPx: number;
  /** 四周留白（像素，scale 后） */
  private readonly paddingPx: number;
  /** italic 字形 cell 宽额外放大倍数（防斜体越界重叠） */
  private readonly italicScale: number;

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
    /** baseline 距 cell 顶距离（像素，scale 后，仅 ascent 部分，不含 padding） */
    ascentPx: number,
    /** baseline 距 cell 底距离（像素，scale 后，仅 descent 部分） */
    descentPx: number,
    fontStyle: FontStyle,
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

    this.paddingPx = GLYPH_PADDING * FONT_SCALE;
    this.italicScale = fontStyle === 'italic' ? 2 : 1;

    // ascent/descent 由探针 '|ÉqÅM' 测得 actualBoundingBox（重音字已抬高 ink 顶），
    // 两者内部保持浮点，仅 cell 高做一次外层 ceil — 与 padding 共同保证 cell 内不裁切
    const fontHeightPx = ascentPx + descentPx;

    this.baselinePx = this.paddingPx + ascentPx;
    this.cellHPx = Math.ceil(fontHeightPx + this.paddingPx * 2);
    this.lineHeight = this.cellHPx / FONT_SCALE;

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
    // italic 放大 cell 宽防斜体越界；ceil 对齐像素网格避免相邻字采样重叠
    const widthPx = Math.max(1, Math.ceil(advancePx * this.italicScale));
    const paddedWidthPx = widthPx + this.paddingPx * 2;
    const cellH = this.cellHPx;

    // 行尾换行
    if (this.currentX + paddedWidthPx > ATLAS_SIZE) {
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

    // baseline 落在 cell 顶部下方 paddingPx + ascentPx 处，四周 padding 吸收越界 ink
    ctx.fillText(char, px + this.paddingPx, py + this.baselinePx);

    this.currentX += paddedWidthPx;
    this.dirty = true;

    const info: GlyphInfo = {
      px, py,
      pw: paddedWidthPx,
      ph: cellH,
      advance: advancePx / FONT_SCALE,
      paddingLeft: this.paddingPx / FONT_SCALE,
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

    const scaledFontString = `${fontStyle} ${fontWeight} ${fontSize * FONT_SCALE}px ${fontFamily}`;

    // 探一次得到字体级 ascent/descent（整张 atlas 共享 cell 高与 baseline，各字对齐）。
    // 直接在 scaledFontString 下测，得到的就是 scale 后像素，无需再乘 FONT_SCALE。
    // 探针用 '|ÉqÅ' + 'M'：带重音符的 ÉÅ 把 ink 顶推到接近字体真实 ascent，
    // 单字 'M' 只有 cap height(~0.7em) 太矮，CJK / 带重音字顶部会越过 cell 上界被裁。
    // 取 actualBoundingBoxAscent/Descent 度量 ink 边界，跨平台语义稳定
    const probeCanvasAndContext = canvasPool.getCanvasAndContext(1, 1);
    const probeCtx = probeCanvasAndContext.context;
    let ascentPx = fontSize * 0.8 * FONT_SCALE;
    let descentPx = fontSize * 0.2 * FONT_SCALE;

    try {
      probeCtx.font = scaledFontString;
      const m = probeCtx.measureText(METRICS_STRING + BASELINE_SYMBOL);

      ascentPx = m.actualBoundingBoxAscent || ascentPx;
      descentPx = m.actualBoundingBoxDescent || descentPx;
    } finally {
      canvasPool.releaseCanvasAndContext(probeCanvasAndContext);
    }

    const atlas = new GlyphAtlas(this.engine, scaledFontString, ascentPx, descentPx, fontStyle);

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
