import { effectsClass } from './decorators';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import { RenderingDevice } from './rendering-device';
import { Renderer } from './render/renderer';

/** Initializes the per-engine device before other servers, and releases it last. */
@effectsClass('GraphicsServer')
export class GraphicsServer extends EngineServer {
  constructor (engine: Engine) {
    super(engine, -1000);
  }

  override onInit (): void {
    const { engine } = this;

    engine.renderingDevice = RenderingDevice.create(engine);
    engine.renderingDevice.initialize();
    engine.renderer = Renderer.create(engine);
  }

  override onDispose (): void {
    this.engine.renderingDevice.dispose();
  }
}
