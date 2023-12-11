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

  constructor (fps = 60) {
    this.setFPS(fps);
    this.tickers = [];
  }

  /**
   * FPS 帧率设置
   */
  getFPS () {
    return this.targetFPS;
  }
  setFPS (fps: number) {
    this.targetFPS = clamp(fps, 1, 120);
    this.interval = Math.floor(1000 / fps) - 1;
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
    this.tickers = [];
  }

  /**
   * 定时器暂停方法
   */
  pause () {
    this.paused = true;
  }

  /**
   * 定时器恢复方法
   */
  resume () {
    this.paused = false;
  }

  /**
   * 定时器 tick 方法
   */
  tick () {
    if (this.paused) {
      return;
    }
    const startTime = performance.now();
    const deltaTime = startTime - this.lastTime;

    if (deltaTime >= this.interval) {

      this.lastTime = startTime;

      if (this.resetTickers) {
        this.tickers = this.tickers.filter(tick => tick);
        this.resetTickers = false;
      }

      for (let i = 0, len = this.tickers.length; i < len; i++) {
        const tick = this.tickers[i];

        tick(deltaTime);
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
