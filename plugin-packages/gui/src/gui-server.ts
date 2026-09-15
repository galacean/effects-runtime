import { EngineServer, effectsClass } from '@galacean/effects';
import type { Engine, InputEvent, OverlayRenderer } from '@galacean/effects';
import { WindowRootControl } from './core/roots';

/** Engine-level owner for the GUI window root and its runtime subscriptions. */
@effectsClass('GUIServer')
export class GUIServer extends EngineServer {
  windowRoot: WindowRootControl;
  private disposed = false;
  private readonly overlayRenderer: OverlayRenderer = {
    render: () => this.windowRoot.render(),
  };

  constructor (engine: Engine) {
    // Update after scenes. Scene canvases detach during onBeforeExit.
    super(engine, 300);
  }

  override onLateUpdate (deltaTime: number): void {
    this.windowRoot.update(deltaTime);
  }

  private readonly resizeWindowRoot = (): void => {
    const rect = this.engine.canvas.getBoundingClientRect();
    const width = rect.width || this.engine.canvas.width;
    const height = rect.height || this.engine.canvas.height;

    this.windowRoot.resize(width, height);
  };

  private readonly pushInput = (event: InputEvent): void => {
    if (!event.isAccepted()) {
      this.windowRoot.pushInput(event);
    }
  };

  private readonly onCanvasBlur = (): void => {
    this.windowRoot.onCanvasBlur();
  };

  override onInit (): void {
    const { engine } = this;

    this.windowRoot = new WindowRootControl(engine);
    engine.renderer.addOverlayRenderer(this.overlayRenderer);
    engine.on('resize', this.resizeWindowRoot);
    engine.eventSystem.on('input', this.pushInput);
    engine.eventSystem.on('canvasBlur', this.onCanvasBlur);
    this.resizeWindowRoot();
  }

  override onDispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.engine.renderer.removeOverlayRenderer(this.overlayRenderer);
    this.engine.off('resize', this.resizeWindowRoot);
    this.engine.eventSystem.off('input', this.pushInput);
    this.engine.eventSystem.off('canvasBlur', this.onCanvasBlur);
    this.windowRoot.dispose();
  }
}
