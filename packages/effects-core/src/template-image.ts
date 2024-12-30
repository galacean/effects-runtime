import type * as spec from '@galacean/effects-specification';
import { loadImage } from './downloader';
import { isString } from './utils';

export function getBackgroundImage (
  template: spec.TemplateContent,
  variables?: spec.TemplateVariables,
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
  template?: spec.TemplateContent,
  variables?: spec.TemplateVariables,
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

  // 获取动态换图的图片对象或 url 地址
  const templateBackground = getBackgroundImage(template, variables);

  if (templateBackground) {
    if (isString(templateBackground) && templateBackground !== image.src) {
      return loadImage(templateBackground);
    }
    if (templateBackground instanceof HTMLImageElement) {
      return templateBackground;
    }
  }

  return image;
}
