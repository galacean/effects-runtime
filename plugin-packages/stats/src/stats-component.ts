import type { Engine, GLRenderer } from '@galacean/effects';
import { Behaviour } from '@galacean/effects';
import { Monitor } from './monitor';
import type { StatsOptions } from './stats';

export class StatsComponent extends Behaviour {
  /**
   * 监控对象
   */
  monitor: Monitor;

  constructor (
    public override engine: Engine,
    private readonly options: Required<StatsOptions>,
  ) {
    super(engine);
  }

  override onStart (): void {
    const renderer = this.engine.renderer as GLRenderer;
    const gl = renderer.pipelineContext.gl;

    this.monitor = new Monitor(gl, this.options);
  }

  override onUpdate (dt: number): void {
    this.monitor.update(dt);
  }

  override dispose (): void {
    super.dispose();
    this.monitor.dispose();
  }
}
