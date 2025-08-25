import type { GLEngine, GLRenderer } from '@galacean/effects';
import { Behaviour } from '@galacean/effects';
import { Monitor } from './monitor';
import type { StatsOptions } from './stats';

/**
 * Stats 组件，用于监控渲染性能
 */
export class StatsComponent extends Behaviour {
  /**
   * 监控对象
   */
  monitor: Monitor;

  init (options: Required<StatsOptions>): void {
    const renderer = this.engine.renderer as GLRenderer;
    const gl = (renderer.engine as GLEngine).gl;

    this.monitor = new Monitor(gl, options);
  }

  /**
   * 每帧更新
   * @param dt
   */
  override onUpdate (dt: number): void {
    this.monitor.update(dt);
  }

  /**
   * 释放资源
   */
  override dispose (): void {
    super.dispose();
    this.monitor.dispose();
  }
}
