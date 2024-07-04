import type { TemplateContent } from '@galacean/effects-specification';
import { loadImage } from './downloader';
import { isString } from './utils';

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

  if (!image) {
    throw new Error('Image not provided.');
  }

  if (!template) {
    return image;
  }

  let drawImage: HTMLImageElement | number | string[] = image;
  // 获取动态换图的图片对象或 url 地址
  const templateBackground = getBackgroundImage(template, variables);

  if (
    templateBackground &&
    isString(templateBackground) &&
    templateBackground !== image.src
  ) {
    drawImage = isString(templateBackground) ? await loadImage(templateBackground) : templateBackground;
  }

  return drawImage;
}
