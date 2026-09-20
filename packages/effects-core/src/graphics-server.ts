import { effectsClass } from './decorators';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import { RenderingDevice } from './rendering-device';

/** Initializes the per-engine device before other servers, and releases it last. */
@effectsClass('GraphicsServer')
export class GraphicsServer extends EngineServer {
  renderingDevice: RenderingDevice;

  constructor (engine: Engine) {
    super(engine, -1000);
  }

  override onInit (): void {
    this.renderingDevice = RenderingDevice.create(this.engine);
  }

  override onDispose (): void {
    this.renderingDevice.dispose();
  }
}
