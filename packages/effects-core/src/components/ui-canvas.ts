import type { Engine } from '../engine';
import { CanvasRootControl } from '../gui';
import { Component } from './component';

export enum CanvasRenderMode {
  ScreenSpace = 0,
  CameraSpace = 1,
  WorldSpace = 2,
  WorldSpaceFaceCamera = 3,
}

/** Canvas-layer boundary attached to a VFXItem. Input state remains owned by the window root. */
export class UICanvas extends Component {
  readonly rootControl: CanvasRootControl;
  renderMode = CanvasRenderMode.ScreenSpace;
  receivesEvents = true;
  private _order = 0;
  private registered = false;

  constructor (engine: Engine) {
    super(engine);
    this.rootControl = new CanvasRootControl(engine, this);
  }

  get order (): number {
    return this._order;
  }

  set order (value: number) {
    if (this._order !== value) {
      this._order = value;
      this.engine.windowRoot.canvases.sortCanvases();
    }
  }

  get isVisible (): boolean {
    return this.renderMode === CanvasRenderMode.ScreenSpace && this.enabled &&
      !!this.item?.isActive;
  }

  override onEnable (): void {
    this.register();
  }

  override onDisable (): void {
    this.unregister();
  }

  override onDestroy (): void {
    this.destroyCanvas();
  }

  override dispose (): void {
    this.destroyCanvas();
    super.dispose();
  }

  private register (): void {
    if (!this.registered) {
      this.rootControl.parent = this.engine.windowRoot.canvases;
      this.registered = true;
    }
  }

  private unregister (): void {
    if (this.registered) {
      this.rootControl.parent = null;
      this.registered = false;
    }
  }

  private destroyCanvas (): void {
    this.unregister();
    if (!this.rootControl.isDisposed) {
      this.rootControl.dispose();
    }
  }
}
