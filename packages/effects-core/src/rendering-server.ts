import { effectsClass } from './decorators';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import { Graphics } from './render/graphics';
import { Renderer } from './render/renderer';
import { RenderTargetPool } from './render/render-target-pool';
import type { RenderPassClearAction } from './render/render-pass';
import { SceneServer } from './scene-server';
import { TextureLoadAction } from './texture';

/** Owns per-engine drawing services, after the graphics device is initialized. */
@effectsClass('RenderingServer')
export class RenderingServer extends EngineServer {
  renderer: Renderer;
  /** @internal */
  renderTargetPool: RenderTargetPool;
  private _graphics?: Graphics;
  private disposed = false;
  private readonly clearAction: RenderPassClearAction = {
    stencilAction: TextureLoadAction.clear,
    clearStencil: 0,
    depthAction: TextureLoadAction.clear,
    clearDepth: 1,
    colorAction: TextureLoadAction.clear,
    clearColor: [0, 0, 0, 0],
  };

  constructor (engine: Engine) {
    super(engine, -900);
  }

  /** Lazily allocate the shared 2D buffers, materials and text cache. */
  get graphics (): Graphics {
    if (this.disposed) {
      throw new Error('RenderingServer is disposed.');
    }

    return this._graphics ??= new Graphics(this.engine);
  }

  override onInit (): void {
    this.renderTargetPool = new RenderTargetPool(this.engine);
    this.renderer = Renderer.create(this.engine);
  }

  /** Submit the frame after every server has finished its onDraw preparation. */
  renderFrame (): void {
    const scenes = this.engine.getServer(SceneServer);

    this.renderer.renderCompositions(scenes.compositions, this.clearAction);
    this.renderer.renderOverlays();
    this.renderTargetPool.flush();
  }

  override onDispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this._graphics?.dispose();
    this._graphics = undefined;
    this.renderer.dispose();
    this.renderTargetPool.dispose();
  }
}
