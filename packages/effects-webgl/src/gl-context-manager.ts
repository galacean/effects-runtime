import type { LostHandler, RestoreHandler } from '@galacean/effects-core';
import { assertExist, createGLContext } from '@galacean/effects-core';

export class GLContextManager {
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;

  private readonly contextLostListener: (e: Event) => void;
  private readonly contextRestoredListener: (e: Event) => void;
  private readonly restoreHandlers: RestoreHandler[] = [];
  private readonly lostHandlers: LostHandler[] = [];

  constructor (
    public canvas: HTMLCanvasElement | OffscreenCanvas | null,
    public readonly glType: 'webgl' | 'webgl2' = 'webgl',
    options: WebGLContextAttributes = {},
  ) {
    assertExist(canvas);
    this.gl = createGLContext(canvas, glType, options);
    this.contextLostListener = (e: Event) => {
      for (const lostHandler of this.lostHandlers) {
        lostHandler.lost(e);
      }
      this.canvas?.removeEventListener('webglcontextlost', this.contextLostListener);
    };
    this.contextRestoredListener = (e: Event) => {
      for (const restorable of this.restoreHandlers) {
        restorable.restore();
      }
      this.canvas?.addEventListener('webglcontextlost', this.contextLostListener);
    };
    canvas.addEventListener('webglcontextlost', this.contextLostListener);
    canvas.addEventListener('webglcontextrestored', this.contextRestoredListener);
  }

  dispose () {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostListener);
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredListener);
    }
    this.gl = null;
    this.canvas = null;
  }

  addLostHandler (lostHandler: LostHandler) {
    this.lostHandlers.push(lostHandler);
  }

  removeLostHandler (lostHandler: LostHandler) {
    const index = this.lostHandlers.indexOf(lostHandler);

    if (index > -1) {
      this.lostHandlers.splice(index, 1);
    }
  }

  addRestoreHandler (restoreHandler: RestoreHandler) {
    this.restoreHandlers.push(restoreHandler);
  }

  removeRestoreHandler (restorable: RestoreHandler) {
    const index = this.restoreHandlers.indexOf(restorable);

    if (index > -1) {
      this.restoreHandlers.splice(index, 1);
    }
  }
}
