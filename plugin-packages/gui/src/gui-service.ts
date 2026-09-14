import { EngineService, effectsClass } from '@galacean/effects';
import type { InputEvent } from '@galacean/effects';
import { WindowRootControl } from './core/roots';

/** Engine-level owner for the GUI window root and its runtime subscriptions. */
@effectsClass('GUIService')
export class GUIService extends EngineService {
  // Update and draw after scenes. Scene canvases detach during onBeforeExit.
  override readonly order: number = 300;
  windowRoot: WindowRootControl;
  private disposed = false;

  override onLateUpdate (deltaTime: number): void {
    this.windowRoot.update(deltaTime);
  }

  override onDraw (): void {
    this.windowRoot.render();
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
    this.engine.off('resize', this.resizeWindowRoot);
    this.engine.eventSystem.off('input', this.pushInput);
    this.engine.eventSystem.off('canvasBlur', this.onCanvasBlur);
    this.windowRoot.dispose();
  }
}
