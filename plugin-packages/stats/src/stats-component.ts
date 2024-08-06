import { ItemBehaviour } from '@galacean/effects';
import { Monitor } from './monitor';

interface IRenderer {
  pipelineContext: {
    gl: WebGLRenderingContext | WebGL2RenderingContext,
  },
}

export class StatsComponent extends ItemBehaviour {
  /**
   * 监控对象
   */
  monitor: Monitor;
  override start (): void {
    const gl = (this.item.composition?.renderer as unknown as IRenderer).pipelineContext.gl;

    this.monitor = new Monitor(gl);
  }

  override update (dt: number): void {
    this.monitor.update(dt);
  }
}
