/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { canvasPool } from '../../canvas-pool';

export type FilterFunction = (imageData: ImageData) => ImageData;
export type Filter = string | FilterFunction;

export interface FilterOptions {
  blurRadius?: number,
  brightness?: number,
  contrast?: number,
  grayscale?: number,
  sepia?: number,
  invert?: number,
  saturate?: number,
  hueRotate?: number,
}

/**
 * 滤镜系统，基于Konva架构实现
 */
export class TextFilters {
  private static _isCSSFiltersSupported?: boolean;

  /**
   * 检测浏览器是否支持CSS滤镜
   */
  static get isCSSFiltersSupported (): boolean {
    if (this._isCSSFiltersSupported === undefined) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      this._isCSSFiltersSupported = context ? 'filter' in context : false;
    }

    return this._isCSSFiltersSupported;
  }

  /**
   * 应用滤镜到画布
   * @param canvas - 原始画布
   * @param filters - 滤镜列表
   * @param options - 滤镜参数
   * @returns 应用滤镜后的画布
   */
  static applyFilters (
    canvas: HTMLCanvasElement,
    filters: Filter[],
    options: FilterOptions = {}
  ): HTMLCanvasElement {
    if (!filters || filters.length === 0) {
      return canvas;
    }

    // 检查是否所有滤镜都是CSS字符串且浏览器支持
    const canUseCSSFilters = this.isCSSFiltersSupported &&
      filters.every(filter => typeof filter === 'string');

    if (canUseCSSFilters) {
      return this.applyCSSFilters(canvas, filters as string[]);
    } else {
      return this.applyFunctionFilters(canvas, filters, options);
    }
  }

  /**
   * 使用CSS滤镜
   */
  private static applyCSSFilters (
    canvas: HTMLCanvasElement,
    filters: string[]
  ): HTMLCanvasElement {
    const filterCanvas = canvasPool.getCanvas();
    const context = filterCanvas.getContext('2d')!;

    // 设置画布尺寸
    filterCanvas.width = canvas.width;
    filterCanvas.height = canvas.height;

    // 应用CSS滤镜
    const filterString = filters.join(' ');

    context.filter = filterString;
    context.drawImage(canvas, 0, 0);
    context.filter = 'none'; // 重置滤镜

    return filterCanvas;
  }

  /**
   * 获取最大CSS模糊像素值
   */
  private static getMaxCssBlurPx (filters: Filter[]): number {
    let maxPx = 0;

    for (const f of filters) {
      if (typeof f !== 'string') {continue;}
      const re = /blur\(([^)]+)\)/g;
      let m: RegExpExecArray | null;

      while ((m = re.exec(f)) !== null) {
        const px = this.parseCSSLengthPx(m[1]);

        if (!isNaN(px)) {maxPx = Math.max(maxPx, px);}
      }
    }

    return maxPx;
  }

  /**
   * 使用函数滤镜（带边界处理）
   */
  private static applyFunctionFilters (
    canvas: HTMLCanvasElement,
    filters: Filter[],
    options: FilterOptions
  ): HTMLCanvasElement {
    const dpr = this.getDevicePixelRatio();
    const maxCssBlurPx = this.getMaxCssBlurPx(filters);
    const pad = this.calculateBlurRadius(maxCssBlurPx, dpr) + 2; // 多加2像素更稳

    const w = canvas.width;
    const h = canvas.height;

    const work = canvasPool.getCanvas();
    const wctx = work.getContext('2d', { willReadFrequently: true })!;

    work.width = w + pad * 2;
    work.height = h + pad * 2;

    // 在中心画原图
    wctx.clearRect(0, 0, work.width, work.height);
    wctx.drawImage(canvas, pad, pad);

    // 在 work 上处理整幅图像
    let imageData = wctx.getImageData(0, 0, work.width, work.height);

    for (const filter of filters) {
      if (typeof filter === 'string') {
        const fn = this.parseCSSFilter(filter, options);

        if (fn) {imageData = fn(imageData);}
      } else {
        imageData = filter(imageData);
      }
    }
    wctx.putImageData(imageData, 0, 0);

    // 输出到和原图一样大的画布（裁中心区域）
    const out = canvasPool.getCanvas();
    const octx = out.getContext('2d')!;

    out.width = w;
    out.height = h;
    octx.clearRect(0, 0, w, h);
    octx.drawImage(work, pad, pad, w, h, 0, 0, w, h);

    // 释放工作画布
    canvasPool.saveCanvas(work);

    return out;
  }

  /**
   * 解析CSS长度值（px单位专用）
   */
  private static parseCSSLengthPx (str: string): number {
    const s = str.trim();

    if (s.endsWith('px')) {return parseFloat(s);}

    // CSS blur允许无单位，按px处理
    return parseFloat(s);
  }

  /**
   * 解析CSS滤镜字符串为函数滤镜
   */
  private static parseCSSFilter (filter: string, options: FilterOptions): FilterFunction | null {
    const filters: FilterFunction[] = [];

    // 解析多个滤镜函数
    const regex = /(\w+)\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(filter)) !== null) {
      const [, funcName, valueStr] = match;

      switch (funcName) {
        case 'blur': {
          const dpr = this.getDevicePixelRatio();
          const cssPx = this.parseCSSLengthPx(valueStr);
          const radius = this.calculateBlurRadius(cssPx, dpr);

          if (radius > 0) {
            filters.push(imageData => this.blur(imageData, radius));
          }

          break;
        }
        case 'brightness': {
          const value = this.parseCSSValue(valueStr);

          filters.push(imageData => this.brightness(imageData, value));

          break;
        }
        case 'contrast': {
          const value = this.parseCSSValue(valueStr);

          filters.push(imageData => this.contrast(imageData, value));

          break;
        }
        case 'grayscale': {
          const value = this.parseCSSValue(valueStr);

          filters.push(imageData => this.grayscale(imageData, value));

          break;
        }
        case 'sepia': {
          const value = this.parseCSSValue(valueStr);

          filters.push(imageData => this.sepia(imageData, value));

          break;
        }
        case 'invert': {
          const value = this.parseCSSValue(valueStr);

          filters.push(imageData => this.invert(imageData, value));

          break;
        }
      }
    }

    if (filters.length === 0) {return null;}
    if (filters.length === 1) {return filters[0];}

    // 返回组合滤镜函数
    return imageData => {
      let result = imageData;

      for (const filterFn of filters) {
        result = filterFn(result);
      }

      return result;
    };
  }

  /**
   * 解析CSS值（处理百分比）
   */
  private static parseCSSValue (valueStr: string): number {
    const str = valueStr.trim();

    if (str.includes('%')) {
      return parseFloat(str) / 100;
    }

    return parseFloat(str);
  }

  /**
   * 获取设备像素比
   */
  private static getDevicePixelRatio (): number {
    return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }

  /**
   * 计算模糊半径（考虑DPR和视觉一致性）
   */
  private static calculateBlurRadius (blurPx: number, dpr: number): number {
    // 使用更精确的映射系数，避免过度模糊
    const radius = Math.floor(blurPx * dpr * 0.4);

    return Math.max(0, radius);
  }

  /**
   * 模糊滤镜 - 使用StackBlur算法实现与CSS一致的效果
   */
  static blur (imageData: ImageData, radius: number): ImageData {
    const { data, width, height } = imageData;
    const radiusInt = Math.round(radius);

    if (radiusInt <= 0) {return imageData;}

    // 创建新的ImageData用于处理
    const newData = new Uint8ClampedArray(data);
    const newImageData = new ImageData(newData, width, height);

    // 使用StackBlur算法实现与CSS一致的高斯模糊
    this.applyStackBlur(newImageData, radiusInt);

    return newImageData;
  }

  /**
   * 应用StackBlur算法实现与CSS一致的高斯模糊
   * 基于Mario Klingemann的StackBlur算法实现
   */
  private static applyStackBlur (imageData: ImageData, radius: number): void {

    if (radius < 1) {return;}

    // 限制半径范围
    const r = Math.min(radius, 255);

    // 使用正确的StackBlur算法
    this.stackBlurImageData(imageData, r);
  }

  /**
   * 正确的StackBlur算法实现
   * 修复了透明背景处理问题
   */
  private static stackBlurImageData (imageData: ImageData, radius: number): void {

    if (radius < 1) {return;}

    // 使用原始的filterGaussBlurRGBA实现，它正确处理了透明背景
    this.filterGaussBlurRGBA(imageData, radius);
  }

  /**
   * 原始的filterGaussBlurRGBA实现
   * 来自Konva的StackBlur实现，正确处理透明背景
   */
  private static filterGaussBlurRGBA (imageData: ImageData, radius: number): void {
    // 使用提供的StackBlur算法
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // 使用提供的常量表
    const mul_table = [
      512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292,
      512, 454, 405, 364, 328, 298, 271, 496, 456, 420, 388, 360, 335, 312, 292,
      273, 512, 482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259,
      496, 475, 456, 437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292,
      282, 273, 265, 512, 497, 482, 468, 454, 441, 428, 417, 405, 394, 383, 373,
      364, 354, 345, 337, 328, 320, 312, 305, 298, 291, 284, 278, 271, 265, 259,
      507, 496, 485, 475, 465, 456, 446, 437, 428, 420, 412, 404, 396, 388, 381,
      374, 367, 360, 354, 347, 341, 335, 329, 323, 318, 312, 307, 302, 297, 292,
      287, 282, 278, 273, 269, 265, 261, 512, 505, 497, 489, 482, 475, 468, 461,
      454, 447, 441, 435, 428, 422, 417, 411, 405, 399, 394, 389, 383, 378, 373,
      368, 364, 359, 354, 350, 345, 341, 337, 332, 328, 324, 320, 316, 312, 309,
      305, 301, 298, 294, 291, 287, 284, 281, 278, 274, 271, 268, 265, 262, 259,
      257, 507, 501, 496, 491, 485, 480, 475, 470, 465, 460, 456, 451, 446, 442,
      437, 433, 428, 424, 420, 416, 412, 408, 404, 400, 396, 392, 388, 385, 381,
      377, 374, 370, 367, 363, 360, 357, 354, 350, 347, 344, 341, 338, 335, 332,
      329, 326, 323, 320, 318, 315, 312, 310, 307, 304, 302, 299, 297, 294, 292,
      289, 287, 285, 282, 280, 278, 275, 273, 271, 269, 267, 265, 263, 261, 259,
    ];

    const shg_table = [
      9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 17, 17,
      17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 19, 19, 19, 19, 19, 19,
      19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
      20, 20, 20, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
      21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22,
      22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
      22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24,
    ];

    // 使用提供的BlurStack构造函数
    function BlurStack (this: any) {
      this.r = 0;
      this.g = 0;
      this.b = 0;
      this.a = 0;
      this.next = null;
    }

    let p: number,
      yi: number,
      yw: number,
      r_sum: number,
      g_sum: number,
      b_sum: number,
      a_sum: number,
      r_out_sum: number,
      g_out_sum: number,
      b_out_sum: number,
      a_out_sum: number,
      r_in_sum: number,
      g_in_sum: number,
      b_in_sum: number,
      a_in_sum: number,
      pr: number,
      pg: number,
      pb: number,
      pa: number,
      rbs: number;

    const div = radius + radius + 1,
      widthMinus1 = width - 1,
      heightMinus1 = height - 1,
      radiusPlus1 = radius + 1,
      sumFactor = (radiusPlus1 * (radiusPlus1 + 1)) / 2,
      stackStart = new (BlurStack as any)(),
      mul_sum = mul_table,
      shg_sum = shg_table;

    let stackEnd = null,
      stack = stackStart,
      stackIn: any = null,
      stackOut: any = null;

    for (let i = 1; i < div; i++) {
      stack = stack.next = new (BlurStack as any)();
      if (i === radiusPlus1) {
        stackEnd = stack;
      }
    }

    stack.next = stackStart;

    yw = yi = 0;

    for (let y = 0; y < height; y++) {
      r_in_sum =
        g_in_sum =
        b_in_sum =
        a_in_sum =
        r_sum =
        g_sum =
        b_sum =
        a_sum =
          0;

      r_out_sum = radiusPlus1 * (pr = pixels[yi]);
      g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
      b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);
      a_out_sum = radiusPlus1 * (pa = pixels[yi + 3]);

      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;
      a_sum += sumFactor * pa;

      stack = stackStart;

      for (let i = 0; i < radiusPlus1; i++) {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack.a = pa;
        stack = stack.next;
      }

      for (let i = 1; i < radiusPlus1; i++) {
        p = yi + ((widthMinus1 < i ? widthMinus1 : i) << 2);
        r_sum += (stack.r = pr = pixels[p]) * (rbs = radiusPlus1 - i);
        g_sum += (stack.g = pg = pixels[p + 1]) * rbs;
        b_sum += (stack.b = pb = pixels[p + 2]) * rbs;
        a_sum += (stack.a = pa = pixels[p + 3]) * rbs;

        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;
        a_in_sum += pa;

        stack = stack.next;
      }

      stackIn = stackStart;
      stackOut = stackEnd;
      for (let x = 0; x < width; x++) {
        pixels[yi + 3] = pa = (a_sum * mul_sum[radius]) >> shg_sum[radius];
        if (pa !== 0) {
          pa = 255 / pa;
          pixels[yi] = ((r_sum * mul_sum[radius]) >> shg_sum[radius]) * pa;
          pixels[yi + 1] = ((g_sum * mul_sum[radius]) >> shg_sum[radius]) * pa;
          pixels[yi + 2] = ((b_sum * mul_sum[radius]) >> shg_sum[radius]) * pa;
        } else {
          pixels[yi] = pixels[yi + 1] = pixels[yi + 2] = 0;
        }

        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;
        a_sum -= a_out_sum;

        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;
        a_out_sum -= stackIn.a;

        p = (yw + ((p = x + radius + 1) < widthMinus1 ? p : widthMinus1)) << 2;

        r_in_sum += stackIn.r = pixels[p];
        g_in_sum += stackIn.g = pixels[p + 1];
        b_in_sum += stackIn.b = pixels[p + 2];
        a_in_sum += stackIn.a = pixels[p + 3];

        r_sum += r_in_sum;
        g_sum += g_in_sum;
        b_sum += b_in_sum;
        a_sum += a_in_sum;

        stackIn = stackIn.next;

        r_out_sum += pr = stackOut.r;
        g_out_sum += pg = stackOut.g;
        b_out_sum += pb = stackOut.b;
        a_out_sum += pa = stackOut.a;

        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;
        a_in_sum -= pa;

        stackOut = stackOut.next;

        yi += 4;
      }
      yw += width;
    }

    for (let x = 0; x < width; x++) {
      g_in_sum =
        b_in_sum =
        a_in_sum =
        r_in_sum =
        g_sum =
        b_sum =
        a_sum =
        r_sum =
          0;

      yi = x << 2;
      r_out_sum = radiusPlus1 * (pr = pixels[yi]);
      g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
      b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);
      a_out_sum = radiusPlus1 * (pa = pixels[yi + 3]);

      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;
      a_sum += sumFactor * pa;

      stack = stackStart;

      for (let i = 0; i < radiusPlus1; i++) {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack.a = pa;
        stack = stack.next;
      }

      let yp = width;

      for (let i = 1; i <= radius; i++) {
        yi = (yp + x) << 2;

        r_sum += (stack.r = pr = pixels[yi]) * (rbs = radiusPlus1 - i);
        g_sum += (stack.g = pg = pixels[yi + 1]) * rbs;
        b_sum += (stack.b = pb = pixels[yi + 2]) * rbs;
        a_sum += (stack.a = pa = pixels[yi + 3]) * rbs;

        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;
        a_in_sum += pa;

        stack = stack.next;

        if (i < heightMinus1) {
          yp += width;
        }
      }

      yi = x;
      stackIn = stackStart;
      stackOut = stackEnd;
      for (let y = 0; y < height; y++) {
        p = yi << 2;
        pixels[p + 3] = pa = (a_sum * mul_sum[radius]) >> shg_sum[radius];
        if (pa > 0) {
          pa = 255 / pa;
          pixels[p] = ((r_sum * mul_sum[radius]) >> shg_sum[radius]) * pa;
          pixels[p + 1] = ((g_sum * mul_sum[radius]) >> shg_sum[radius]) * pa;
          pixels[p + 2] = ((b_sum * mul_sum[radius]) >> shg_sum[radius]) * pa;
        } else {
          pixels[p] = pixels[p + 1] = pixels[p + 2] = 0;
        }

        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;
        a_sum -= a_out_sum;

        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;
        a_out_sum -= stackIn.a;

        p =
          (x +
            ((p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1) * width) <<
          2;

        r_sum += r_in_sum += stackIn.r = pixels[p];
        g_sum += g_in_sum += stackIn.g = pixels[p + 1];
        b_sum += b_in_sum += stackIn.b = pixels[p + 2];
        a_sum += a_in_sum += stackIn.a = pixels[p + 3];

        stackIn = stackIn.next;

        r_out_sum += pr = stackOut.r;
        g_out_sum += pg = stackOut.g;
        b_out_sum += pb = stackOut.b;
        a_out_sum += pa = stackOut.a;

        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;
        a_in_sum -= pa;

        stackOut = stackOut.next;

        yi += width;
      }
    }
  }

  /**
   * 亮度滤镜
   */
  static brightness (imageData: ImageData, brightness: number): ImageData {
    const { data } = imageData;
    const newData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
      newData[i] = Math.min(255, Math.max(0, data[i] * brightness));
      newData[i + 1] = Math.min(255, Math.max(0, data[i + 1] * brightness));
      newData[i + 2] = Math.min(255, Math.max(0, data[i + 2] * brightness));
      newData[i + 3] = data[i + 3];
    }

    return new ImageData(newData, imageData.width, imageData.height);
  }

  /**
   * 对比度滤镜 - 修正为CSS兼容的对比度计算
   */
  static contrast (imageData: ImageData, contrast: number): ImageData {
    const { data } = imageData;
    const newData = new Uint8ClampedArray(data);
    // CSS对比度: 1.0是正常，<1.0降低对比度，>1.0增加对比度
    const factor = contrast;

    for (let i = 0; i < data.length; i += 4) {
      newData[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      newData[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      newData[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
      newData[i + 3] = data[i + 3];
    }

    return new ImageData(newData, imageData.width, imageData.height);
  }

  /**
   * 灰度滤镜
   */
  static grayscale (imageData: ImageData, amount: number): ImageData {
    const { data } = imageData;
    const newData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

      newData[i] = Math.round(data[i] * (1 - amount) + gray * amount);
      newData[i + 1] = Math.round(data[i + 1] * (1 - amount) + gray * amount);
      newData[i + 2] = Math.round(data[i + 2] * (1 - amount) + gray * amount);
      newData[i + 3] = data[i + 3];
    }

    return new ImageData(newData, imageData.width, imageData.height);
  }

  /**
   * 棕褐色滤镜
   */
  static sepia (imageData: ImageData, amount: number): ImageData {
    const { data } = imageData;
    const newData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      newData[i] = Math.min(255, Math.max(0, r * (1 - 0.607 * amount) + g * 0.769 * amount + b * 0.189 * amount));
      newData[i + 1] = Math.min(255, Math.max(0, r * 0.349 * amount + g * (1 - 0.314 * amount) + b * 0.168 * amount));
      newData[i + 2] = Math.min(255, Math.max(0, r * 0.272 * amount + g * 0.534 * amount + b * (1 - 0.869 * amount)));
      newData[i + 3] = data[i + 3];
    }

    return new ImageData(newData, imageData.width, imageData.height);
  }

  /**
   * 反色滤镜 - 修正为CSS兼容的反色计算
   */
  static invert (imageData: ImageData, amount: number): ImageData {
    const { data } = imageData;
    const newData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
      newData[i] = Math.round(255 * amount + data[i] * (1 - 2 * amount));
      newData[i + 1] = Math.round(255 * amount + data[i + 1] * (1 - 2 * amount));
      newData[i + 2] = Math.round(255 * amount + data[i + 2] * (1 - 2 * amount));
      newData[i + 3] = data[i + 3];
    }

    return new ImageData(newData, imageData.width, imageData.height);
  }

}
