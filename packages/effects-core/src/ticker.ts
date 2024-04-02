import { clamp } from '@galacean/effects-math/es/core/index';

/**
 * 定时器类
 */
export class Ticker {
  tickers: ((dt: number) => void)[];
  private paused = true;
  private lastTime = 0;
  private targetFPS: number;
  private interval: number;
  private intervalId: number;
  private resetTickers: boolean;
  private _deltaTime = 0;

  constructor (fps = 60) {
    this.setFPS(fps);
    this.tickers = [];
  }

  /**
   * 获取定时器当前帧更新的时间
   */
  get deltaTime () {
    return this._deltaTime;
  }

  /**
   * FPS 帧率设置
   */
  getFPS () {
    return this.targetFPS;
  }
  setFPS (fps: number) {
    this.targetFPS = clamp(fps, 1, 120);
    // 注意：-2 的原因是保证帧率稳定
    // interval 在 fps 为 60 的时候设成 15 累计误差会很大，设成 14 较稳定
    // requestanimationFrame 在不同的刷新率下时间间隔不一样，120hz 的误差在 8 以内，60hz 的误差在 16 以内
    this.interval = Math.floor(1000 / fps) - 2;
  }

  /**
   * 获取定时器暂停标志位
   * @returns 暂停标志位
   */
  getPaused () {
    return this.paused;
  }

  /**
   * 定时器开始方法
   */
  start () {
    this.paused = false;
    this._deltaTime = 0;
    if (!this.intervalId) {
      this.lastTime = performance.now();
      const raf = requestAnimationFrame || function (func) {
        return window.setTimeout(func, 16.7);
      };
      const runLoop = () => {
        this.intervalId = raf(runLoop);
        if (!this.paused) {
          this.tick();
        }
      };

      runLoop();
    }
  }

  /**
   * 定时器停止方法
   */
  stop () {
    (cancelAnimationFrame || window.clearTimeout)(this.intervalId);
    this.intervalId = 0;
    this.lastTime = 0;
    this.paused = true;
    this._deltaTime = 0;
    this.tickers = [];
  }

  /**
   * 定时器暂停方法
   */
  pause () {
    this.paused = true;
    this._deltaTime = 0;
  }

  /**
   * 定时器恢复方法
   */
  resume () {
    this.paused = false;
    this._deltaTime = 0;
  }

  /**
   * 定时器 tick 方法
   */
  tick () {
    if (this.paused) {
      return;
    }
    const startTime = performance.now();

    this._deltaTime = startTime - this.lastTime;
    if (this._deltaTime >= this.interval) {
      this.lastTime = startTime;

      if (this.resetTickers) {
        this.tickers = this.tickers.filter(tick => tick);
        this.resetTickers = false;
      }

      for (let i = 0, len = this.tickers.length; i < len; i++) {
        const tick = this.tickers[i];

        tick(this._deltaTime);
      }
    }
  }

  /**
   * 定时器添加计时方法
   * @param ticker - 定时器类
   */
  add (ticker: (dt: number) => void) {
    if (typeof ticker !== 'function') {
      throw new Error('Ticker: The tick object must implement the tick method.');
    }
    this.tickers.push(ticker);
  }
}
