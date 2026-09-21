import { HELP_LINK } from './constants';
import { effectsClass } from './decorators';
import type { Engine } from './engine';
import { EngineServer } from './engine-server';
import { RenderingDevice } from './rendering-device';
import { getPixelRatio, logger } from './utils';

/** Owns the display surface sizing and device lifecycle, before other built-in servers. */
@effectsClass('DisplayServer')
export class DisplayServer extends EngineServer {
  renderingDevice: RenderingDevice;
  displayAspect: number;
  displayScale = 1;
  offscreenMode = false;
  pixelRatio: number;
  readonly ownsCanvas: boolean;

  constructor (engine: Engine) {
    super(engine, -1100);
    this.pixelRatio = engine.options.pixelRatio ?? getPixelRatio();
    this.ownsCanvas = engine.options.ownsCanvas ?? true;
  }

  override onInit (): void {
    this.renderingDevice = RenderingDevice.create(this.engine);
  }

  override onDispose (): void {
    this.renderingDevice.dispose();
  }

  // Engine receives the surface before registered servers are constructed.
  get canvas (): HTMLCanvasElement {
    return this.engine.canvas;
  }

  set canvas (value: HTMLCanvasElement) {
    this.engine.canvas = value;
  }

  /**
   * 将渲染器重新和父容器大小对齐
   */
  resize () {
    const { parentElement } = this.canvas;
    let containerWidth;
    let containerHeight;
    let canvasWidth;
    let canvasHeight;

    if (parentElement) {
      const size = this.getTargetSize(parentElement);

      containerWidth = size[0];
      containerHeight = size[1];
      canvasWidth = size[2];
      canvasHeight = size[3];
    } else {
      containerWidth = canvasWidth = this.canvas.width;
      containerHeight = canvasHeight = this.canvas.height;
    }
    const aspect = containerWidth / containerHeight;

    if (containerWidth && containerHeight) {
      const documentWidth = document.documentElement.clientWidth;

      if (canvasWidth > documentWidth * 2) {
        logger.error(`DPI overflowed, width ${canvasWidth} is more than 2x document width ${documentWidth}, see ${HELP_LINK['DPI overflowed']}.`);
      }
      const maxSize = this.engine.env ? this.renderingDevice.gpuCapability.detail.maxTextureSize : 2048;

      if ((canvasWidth > maxSize || canvasHeight > maxSize)) {
        logger.error(`Container size overflowed ${canvasWidth}x${canvasHeight}, see ${HELP_LINK['Container size overflowed']}.`);
        if (aspect > 1) {
          canvasWidth = Math.round(maxSize);
          canvasHeight = Math.round(maxSize / aspect);
        } else {
          canvasHeight = Math.round(maxSize);
          canvasWidth = Math.round(maxSize * aspect);
        }
      }

      this.canvas.style.width = containerWidth + 'px';
      this.canvas.style.height = containerHeight + 'px';
      logger.info(`Resize engine ${this.engine.name} [${canvasWidth},${canvasHeight},${containerWidth},${containerHeight}].`);

      this.setSize(canvasWidth, canvasHeight);
    }
  }

  setSize (width: number, height: number) {
    if (this.renderingDevice.getWidth() !== width || this.renderingDevice.getHeight() !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.renderingDevice.setViewport(0, 0, width, height);
    }

    this.engine.emit('resize', this.engine);
  }

  private getTargetSize (parentEle: HTMLElement) {
    if (parentEle === undefined || parentEle === null) {
      throw new Error(`Container is not an HTMLElement, see ${HELP_LINK['Container is not an HTMLElement']}.`);
    }
    const displayAspect = this.displayAspect;
    // 小程序环境没有 getComputedStyle
    const computedStyle = window.getComputedStyle?.(parentEle);
    let targetWidth;
    let targetHeight;
    let finalWidth = 0;
    let finalHeight = 0;

    if (computedStyle) {
      finalWidth = parseInt(computedStyle.width, 10);
      finalHeight = parseInt(computedStyle.height, 10);
    } else {
      finalWidth = parentEle.clientWidth;
      finalHeight = parentEle.clientHeight;
    }

    if (displayAspect) {
      const parentAspect = finalWidth / finalHeight;

      if (parentAspect > displayAspect) {
        targetHeight = finalHeight * this.displayScale;
        targetWidth = targetHeight * displayAspect;
      } else {
        targetWidth = finalWidth * this.displayScale;
        targetHeight = targetWidth / displayAspect;
      }
    } else {
      targetWidth = finalWidth;
      targetHeight = finalHeight;
    }
    const ratio = this.pixelRatio;
    let containerWidth = targetWidth;
    let containerHeight = targetHeight;

    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
    if (targetWidth < 1 || targetHeight < 1) {
      if (this.offscreenMode) {
        targetWidth = targetHeight = containerWidth = containerHeight = 1;
      } else {
        throw new Error(`Invalid container size ${targetWidth}x${targetHeight}, see ${HELP_LINK['Invalid container size']}.`);
      }
    }

    return [containerWidth, containerHeight, targetWidth, targetHeight];
  }
}
