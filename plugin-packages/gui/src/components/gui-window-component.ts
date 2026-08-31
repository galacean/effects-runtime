import { Component } from '@galacean/effects';
import type { Engine, InputEvent } from '@galacean/effects';
import { WindowRootControl } from '../core/roots';

/** Engine-level owner for the GUI window root and its runtime subscriptions. */
export class GUIWindowComponent extends Component {
  readonly windowRoot: WindowRootControl;
  private disposed = false;

  private readonly updateWindowRoot = (deltaTime: number): void => {
    this.windowRoot.update(deltaTime);
  };

  private readonly renderWindowRoot = (): void => {
    this.windowRoot.render();
  };

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

  constructor (engine: Engine) {
    super(engine);
    this.windowRoot = new WindowRootControl(engine);
    engine.on('update', this.updateWindowRoot);
    engine.on('postrender', this.renderWindowRoot);
    engine.on('resize', this.resizeWindowRoot);
    engine.eventSystem.on('input', this.pushInput);
    engine.eventSystem.on('canvasBlur', this.onCanvasBlur);
    this.resizeWindowRoot();
  }

  override dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.engine.off('update', this.updateWindowRoot);
    this.engine.off('postrender', this.renderWindowRoot);
    this.engine.off('resize', this.resizeWindowRoot);
    this.engine.eventSystem.off('input', this.pushInput);
    this.engine.eventSystem.off('canvasBlur', this.onCanvasBlur);
    this.windowRoot.dispose();
    super.dispose();
  }
}
