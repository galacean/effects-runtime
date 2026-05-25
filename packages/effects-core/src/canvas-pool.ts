import { addItem, assertExist, removeItem } from './utils';
import { getConfig, TEMPLATE_USE_OFFSCREEN_CANVAS } from './config';

/**
 * 池内缓存的一组 canvas 与其 2D context。
 */
export type CanvasAndContext = {
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
};

class CanvasPool {
  /**
   * 空闲 canvas 的全局缓存上限。
   */
  private readonly _maxCachedCount = 16;
  /**
   * 按尺寸 key 分桶的空闲 canvas 池。
   */
  private readonly _canvasPool: { [x in string | number]: CanvasAndContext[] } = Object.create(null);
  /**
   * 全局空闲队列，顺序表示最近归还时间，头部最久未使用。
   */
  private readonly _cachedCanvasAndContexts: CanvasAndContext[] = [];

  constructor () {
  }

  /**
   * 释放池内所有空闲 canvas。
   */
  dispose () {
    this.clear();
  }

  /**
   * 清空当前池里的所有空闲项。
   */
  clear () {
    for (const key of Object.keys(this._canvasPool)) {
      const canvasPool = this._canvasPool[key];

      canvasPool.forEach(({ canvas }) => this.destroyCanvas(canvas));
      delete this._canvasPool[key];
    }

    this._cachedCanvasAndContexts.length = 0;
  }

  /**
   * 按目标尺寸获取一组可复用的 canvas 与 context。
   */
  getCanvasAndContext (width: number, height: number): CanvasAndContext {
    const key = this.getKey(width, height);
    const canvasPool = this._canvasPool[key];

    if (canvasPool && canvasPool.length !== 0) {
      const canvasAndContext = canvasPool.pop();

      assertExist(canvasAndContext);

      removeItem(this._cachedCanvasAndContexts, canvasAndContext);

      if (canvasPool.length === 0) {
        delete this._canvasPool[key];
      }

      return canvasAndContext;
    }

    return this.createCanvasAndContext(width, height);
  }

  /**
  * 归还一组 canvas 与 context，并在超过上限时收缩空闲缓存池。
   */
  releaseCanvasAndContext (canvasAndContext: CanvasAndContext) {
    const { width, height } = canvasAndContext.canvas;
    const key = this.getKey(width, height);

    this.resetCanvasAndContext(canvasAndContext);

    if (!this._canvasPool[key]) {
      this._canvasPool[key] = [];
    }

    // addItem 内部已经做了重复添加判断。
    addItem(this._canvasPool[key], canvasAndContext);

    // LRU 队列更需要先删再加：
    // 1. 队列里只能保留一份空闲对象记录，不能重复。
    // 2. 归还代表“刚刚被使用过”，需要把它移动到队尾，
    //    这样队头始终是最久没被再次使用的空闲对象。
    removeItem(this._cachedCanvasAndContexts, canvasAndContext);
    this._cachedCanvasAndContexts.push(canvasAndContext);

    // 超过上限后，批量清理一部分最旧的空闲项，
    // 避免缓存总量继续增长。
    if (this.getCachedCount() > this._maxCachedCount) {
      this.cleanUnusedCachedCanvasPool();
    }
  }

  /**
   * 新建一组指定尺寸的 canvas 与 context。
   */
  private createCanvasAndContext (width = 1, height = 1): CanvasAndContext {
    let canvas: HTMLCanvasElement;

    if (getConfig(TEMPLATE_USE_OFFSCREEN_CANVAS)) {
      canvas = window._createOffscreenCanvas(10, 10);
    } else {
      // in hongmeng system, create too many canvas will case render error
      canvas = document.createElement('canvas');
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });

    assertExist(context);

    canvas.width = width;
    canvas.height = height;

    return { canvas, context };
  }

  /**
   * 清理归还对象上的绘制状态，确保下次复用时是干净的。
   */
  private resetCanvasAndContext (canvasAndContext: CanvasAndContext) {
    const { canvas, context } = canvasAndContext;

    if ('resetTransform' in context && typeof context.resetTransform === 'function') {
      context.resetTransform();
    } else {
      context.setTransform(1, 0, 0, 1, 0, 0);
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * 计算尺寸分桶使用的整数 key。
   */
  private getKey (width: number, height: number) {
    return (width << 17) + (height << 1);
  }

  /**
   * 当前池内空闲对象总数。
   */
  private getCachedCount () {
    return this._cachedCanvasAndContexts.length;
  }

  /**
   * 收缩空闲缓存池，移除最久未使用的一半空闲项。
   */
  private cleanUnusedCachedCanvasPool () {
    const evictCount = Math.max(1, Math.ceil(this._cachedCanvasAndContexts.length / 2));

    for (let index = 0; index < evictCount; index++) {
      const canvasAndContext = this._cachedCanvasAndContexts.shift();

      assertExist(canvasAndContext);

      const { width, height } = canvasAndContext.canvas;
      const key = this.getKey(width, height);
      const canvasPool = this._canvasPool[key];

      if (canvasPool) {
        removeItem(canvasPool, canvasAndContext);

        if (canvasPool.length === 0) {
          delete this._canvasPool[key];
        }
      }

      this.destroyCanvas(canvasAndContext.canvas);
    }
  }

  /**
   * 销毁单个 canvas 节点。
   */
  private destroyCanvas (canvas: HTMLCanvasElement) {
    if ('remove' in canvas && typeof canvas.remove === 'function') {
      canvas.remove();
    }
  }
}

export const canvasPool = new CanvasPool();
