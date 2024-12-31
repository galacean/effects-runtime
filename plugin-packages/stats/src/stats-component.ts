import type { GLRenderer } from '@galacean/effects';
import { Behaviour } from '@galacean/effects';
import { Monitor } from './monitor';
import type { StatsOptions } from './stats';

export class StatsComponent extends Behaviour {
  /**
   * 监控对象
   */
  monitor: Monitor;

  init (options: Required<StatsOptions>): void {
    const renderer = this.engine.renderer as GLRenderer;
    const gl = renderer.pipelineContext.gl;

    this.monitor = new Monitor(gl, options);
  }

  override onUpdate (dt: number): void {
    this.monitor.update(dt);
  }

  override dispose (): void {
    super.dispose();
    this.monitor.dispose();
  }
}
