const DOWNSAMPLE_FEATHER_FACTOR = 10.0;
const ATLAS_PADDING = 2.0;

export interface AtlasRect {
  x: number,
  y: number,
  w: number,
  h: number,
}

/**
 * Atlas 空间分配器
 * 用于在离屏纹理中为多个形状分配空间
 */
export class AtlasAllocator {
  private width: number;
  private height: number;
  private currentX = 0;
  private currentY = 0;
  private currentRowHeight = 0;

  constructor (width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  reset (): void {
    this.currentX = 0;
    this.currentY = 0;
    this.currentRowHeight = 0;
  }

  /**
   * 根据羽化半径计算降采样倍率
   */
  getDownsample (featherRadius: number): number {
    return Math.max(featherRadius / DOWNSAMPLE_FEATHER_FACTOR, 1.0);
  }

  /**
   * 将原始包围盒转换到 Atlas 坐标并进行 Y 轴翻转
   */
  fit (bbox: AtlasRect, downSample: number, outBbox: AtlasRect): boolean {
    const flippedY = this.height - bbox.y - bbox.h;

    const x1 = Math.floor(bbox.x / downSample);
    const y1 = Math.floor(flippedY / downSample);
    const x2 = Math.ceil((bbox.x + bbox.w) / downSample);
    const y2 = Math.ceil((flippedY + bbox.h) / downSample);

    outBbox.x = Math.max(x1, 0);
    outBbox.y = Math.max(y1, 0);
    outBbox.w = Math.min(this.width - outBbox.x, x2 - x1);
    outBbox.h = Math.min(this.height - outBbox.y, y2 - y1);

    return outBbox.w > 0 && outBbox.h > 0;
  }

  /**
   * 在 Atlas 中分配空间
   */
  allocate (w: number, h: number, outRect: AtlasRect): boolean {
    if (this.currentX + w > this.width) {
      this.currentY += this.currentRowHeight + ATLAS_PADDING;
      this.currentX = 0;
      this.currentRowHeight = 0;
    }

    if (this.currentY + h > this.height) {
      return false;
    }

    outRect.x = this.currentX;
    outRect.y = this.currentY;
    outRect.w = w;
    outRect.h = h;

    this.currentX += w + ATLAS_PADDING;
    this.currentRowHeight = Math.max(this.currentRowHeight, h);

    return true;
  }
}
