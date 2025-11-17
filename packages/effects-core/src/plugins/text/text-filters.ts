/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { canvasPool } from '../../canvas-pool';

export type Filter = string;

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
 * 简化的滤镜系统，仅支持CSS滤镜
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
  ): HTMLCanvasElement {
    if (!filters || filters.length === 0) {
      return canvas;
    }

    // 仅使用CSS滤镜
    if (this.isCSSFiltersSupported) {
      return this.applyCSSFilters(canvas, filters);
    }

    // 如果不支持CSS滤镜，直接返回原画布
    return canvas;
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
}
