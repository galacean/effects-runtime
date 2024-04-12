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

export interface TemplateOptions {
  templateScale?: number, // 画布缩放系数
  debug?: boolean, // 显示边框
  borderColor?: string, // 边框颜色
  borderWidth?: number, // 边框宽度
  flipY?: boolean, // 是否反转画布
  scaleX?: number, // x 轴缩放
  scaleY?: number, // y 轴缩放
}

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
  options?: TemplateOptions,
) {
  if (!image) {
    throw Error('image not provided');
  }

  if (!template) {
    return image;
  }

  const templateScale = options?.templateScale || 1;
  const width = template.width;
  const height = template.height;
  let scaleX = templateScale;
  let scaleY = templateScale;
  let drawImage: HTMLImageElement | number | string[] = image;

  if (image.width !== width || image.height !== height) {
    // in webgl1 image will resize to pot
    // so scale template to image size
    scaleX *= (image.width / template.width);
    scaleY *= (image.height / template.height);
  }

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
  options?: TemplateOptions,
) {
  let image;

  if (typeof url === 'string') {
    image = await loadImage(url);
  } else {
    image = url;
  }

  return drawImageByTemplate(image, template, variables, options);
}
