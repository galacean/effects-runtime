import { Behaviour, type GLRenderer } from '@galacean/effects';
import { Monitor } from './monitor';

export class StatsComponent extends Behaviour {
  /**
   * 监控对象
   */
  monitor: Monitor;

  override onStart (): void {
    const renderer = this.engine.renderer as GLRenderer;
    const gl = renderer.pipelineContext.gl;

    this.monitor = new Monitor(gl);
  }

  override onUpdate (dt: number): void {
    this.monitor.update(dt);
  }
}
