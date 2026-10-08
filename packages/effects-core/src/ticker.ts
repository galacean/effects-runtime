import { clamp } from '@galacean/effects-math/es/core/utils';

export const DEFAULT_FPS = 60;

/**
 * 定时器类
 */
export class Ticker {
  tickers: ((dt: number) => void)[];

  private paused = true;
  private lastTime = 0;
  private targetFPS: number;
  private intervalId: number;
  private resetTickers: boolean;
  // deltaTime
  private dt = 0;

  constructor (fps = DEFAULT_FPS) {
    this.setFPS(fps);
    this.tickers = [];
  }

  /**
   * 获取定时器当前帧更新的时间
   */
  get deltaTime () {
    return this.dt;
  }

  /**
   * Engine Update/Draw 的目标帧率；Ticker 回调本身每次 RAF 都执行。
   */
  getFPS () {
    return this.targetFPS;
  }
  setFPS (fps: number) {
    this.targetFPS = clamp(fps, 1, 120);
  }

  /**
   * 获取定时器暂停标志位
   * @returns
   */
  getPaused () {
    return this.paused;
  }

  /**
   * 定时器开始方法
   */
  start () {
    if (this.paused) {
      this.lastTime = performance.now();
    }
    this.paused = false;
    this.dt = 0;

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
    this.dt = 0;
    this.tickers = [];
  }

  /**
   * 定时器暂停方法
   */
  pause () {
    this.paused = true;
    this.dt = 0;
  }

  /**
   * 定时器恢复方法
   */
  resume () {
    if (this.paused) {
      this.lastTime = performance.now();
    }
    this.paused = false;
    this.dt = 0;
  }

  /**
   * 定时器 tick 方法
   */
  tick () {
    if (this.paused) {
      return;
    }
    const startTime = performance.now();

    this.dt = startTime - this.lastTime;
    this.lastTime = startTime;

    if (this.resetTickers) {
      this.tickers = this.tickers.filter(tick => tick);
      this.resetTickers = false;
    }
    for (const tick of this.tickers) {
      tick(this.dt);
    }
  }

  /**
   * 添加逐 RAF 回调，dt 为相邻回调的时间差（毫秒），不受目标 FPS 限制。
   * @param ticker - 定时器类
   */
  add (ticker: (dt: number) => void) {
    if (typeof ticker !== 'function') {
      throw new Error('The tick object must implement the tick method.');
    }
    this.tickers.push(ticker);
  }
}
