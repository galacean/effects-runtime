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
   * 在 Atlas 中分配空间
   */
  allocate (w: number, h: number, outRect: AtlasRect): boolean {
    if (!(w > 0 && h > 0 && w <= this.width && h <= this.height)) {
      return false;
    }
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
