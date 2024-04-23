import type { TemplateContent } from '@galacean/effects-specification';
import { loadImage } from './downloader';
import { addItem, isString } from './utils';
import { getConfig, TEMPLATE_USE_OFFSCREEN_CANVAS } from './config';

export const DEFAULT_FONTS = [
  'serif',
  'sans-serif',
  'monospace',
  'courier',
];

class CanvasPool {
  readonly elements: HTMLCanvasElement[];

  constructor () {
    this.elements = [];
  }

  dispose () {
    this.elements.forEach(e => e.remove());
    // @ts-expect-error
    this.elements = [];
  }

  getCanvas (): HTMLCanvasElement {
    if (this.elements.length) {
      // @ts-expect-error
      return this.elements.shift();
    }
    if (getConfig(TEMPLATE_USE_OFFSCREEN_CANVAS)) {
      // @ts-expect-error
      return window._createOffscreenCanvas(10, 10);
    } else {
      // in hongmeng system, create too many canvas will case render error
      const defCanvas = document.createElement('canvas');

      defCanvas.getContext('2d', { willReadFrequently: true });

      return defCanvas;
    }
  }

  saveCanvas (cvs: HTMLCanvasElement) {
    cvs.width = cvs.height = 1;
    if (this.elements.length < 3) {
      addItem(this.elements, cvs);
    } else {
      cvs.remove();
    }
  }
}

export const canvasPool = new CanvasPool();

export function getDefaultTemplateCanvasPool () {
  return canvasPool;
}

export function getBackgroundImage (
  template: TemplateContent,
  variables?: Record<string, number | string | string[]>,
) {
  let templateBackground;
  const { name, url } = template?.background ?? {};

  if (name) {
    if (variables && variables[name]) {
      templateBackground = variables[name];
    } else if (url) {
      templateBackground = url;
    }
  }

  return templateBackground;
}

async function drawImageByTemplate (
  image?: HTMLImageElement,
  template?: TemplateContent,
  variables?: Record<string, number | string>,
) {
  if (!image) {
    throw Error('image not provided');
  }

  if (!template) {
    return image;
  }

  let drawImage: HTMLImageElement | number | string[] = image;
  // 获取动态换图的图片对象或 url 地址
  const templateBackground = getBackgroundImage(template, variables);

  if (templateBackground && templateBackground !== image.src) {
    drawImage = isString(templateBackground) ? await loadImage(templateBackground) : templateBackground;
  }

  return drawImage;
}

/**
 * @param url
 * @param template
 * @param variables
 * @param options
 * @returns
 */
export async function combineImageTemplate (
  url: string | HTMLImageElement,
  template?: TemplateContent,
  variables?: Record<string, number | string>,
) {
  let image;

  if (typeof url === 'string') {
    image = await loadImage(url);
  } else {
    image = url;
  }

  return drawImageByTemplate(image, template, variables);
}
