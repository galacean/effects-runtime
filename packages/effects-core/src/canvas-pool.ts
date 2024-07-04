import { addItem } from './utils';
import { getConfig, TEMPLATE_USE_OFFSCREEN_CANVAS } from './config';

class CanvasPool {
  readonly elements: HTMLCanvasElement[] = [];

  constructor () {
  }

  dispose () {
    this.elements.forEach(e => e.remove());
    // clearing the array
    this.elements.length = 0;
  }

  getCanvas (): HTMLCanvasElement {
    if (this.elements.length !== 0) {
      return this.elements.shift()!;
    }
    if (getConfig(TEMPLATE_USE_OFFSCREEN_CANVAS)) {
      return window._createOffscreenCanvas(10, 10);
    } else {
      // in hongmeng system, create too many canvas will case render error
      const defCanvas = document.createElement('canvas');

      defCanvas.getContext('2d', { willReadFrequently: true });

      return defCanvas;
    }
  }

  saveCanvas (canvas: HTMLCanvasElement) {
    canvas.width = 1;
    canvas.height = 1;
    if (this.elements.length < 3) {
      addItem(this.elements, canvas);
    } else {
      canvas.remove();
    }
  }
}

export const canvasPool = new CanvasPool();

export function getDefaultTemplateCanvasPool () {
  return canvasPool;
}
