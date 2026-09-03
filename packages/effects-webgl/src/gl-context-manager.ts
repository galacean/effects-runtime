import type { GLType, LostHandler, RestoreHandler } from '@galacean/effects-core';
import { assertExist, createGLContext } from '@galacean/effects-core';

export class GLContextManager {
  gl: WebGL2RenderingContext | null;

  private readonly contextLostListener: (e: Event) => void;
  private readonly contextRestoredListener: (e: Event) => void;
  private readonly restoreHandlers: RestoreHandler[] = [];
  private readonly lostHandlers: LostHandler[] = [];

  constructor (
    public canvas: HTMLCanvasElement | OffscreenCanvas | null,
    public readonly glType: GLType = 'webgl',
    options: WebGLContextAttributes = {},
  ) {
    assertExist(canvas);
    this.gl = createGLContext(canvas, glType, options) as WebGL2RenderingContext;
    this.contextLostListener = (e: Event) => {
      // 必须在 lost 同步阶段最前调用 preventDefault，浏览器才会触发 restored 事件。
      e.preventDefault();
      for (const lostHandler of this.lostHandlers) {
        lostHandler.lost(e);
      }
    };
    this.contextRestoredListener = () => {
      for (const restoreHandler of this.restoreHandlers) {
        void restoreHandler.restore();
      }
    };
    canvas.addEventListener('webglcontextlost', this.contextLostListener);
    canvas.addEventListener('webglcontextrestored', this.contextRestoredListener);
  }

  dispose (releaseContext = true) {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostListener);
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredListener);
    }

    if (this.gl && releaseContext) {
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
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
