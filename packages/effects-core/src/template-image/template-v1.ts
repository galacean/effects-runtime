import type { TemplateContentV1 } from '@galacean/effects-specification';
import { isString } from '../utils';
import { loadImage } from '../downloader';

export function requestAsync (url: string, opt?: { responseType?: XMLHttpRequestResponseType, method?: string, data?: Document | XMLHttpRequestBodyInit | null }) {
  opt = opt || {};

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.responseType = opt?.responseType || 'json';
    xhr.addEventListener('load', () => resolve(xhr.response));
    xhr.addEventListener('error', () => reject(Error(`load ${url} fail`)));
    xhr.open(opt?.method || 'get', url);
    xhr.send(opt?.data);
  });
}

/**
 *
 * @param url
 * @param template
 * @param variables
 * @param opts
 * @param flipY
 * @returns
 */
export async function combineImageTemplate1 (
  url: string | HTMLImageElement,
  template: TemplateContentV1,
  variables: Record<string, number | string | HTMLImageElement>,
  opts?: { templateScale?: number, canvas?: HTMLCanvasElement },
  flipY?: boolean,
): Promise<HTMLCanvasElement> {
  const replacedVariables: Record<string, any> = {};
  const pendings: any[] = [];

  opts = opts || {};
  variables = variables || {};
  if (template.asImage) {
    const name = template.content.replace(/\$/g, '');
    const replaceURL = variables[name] || template.variables[name];
    const onImage = (image: any) => {
      const canvas = opts?.canvas || document.createElement('canvas');
      const width = canvas.width = template.backgroundWidth;
      const height = canvas.height = template.backgroundHeight;
      const ctx = canvas.getContext('2d');

      ctx?.clearRect(0, 0, width, height);
      if (flipY) {
        ctx?.translate(0, height);
        ctx?.scale(1, -1);
      }
      ctx?.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);

      return canvas;
    };

    if (replaceURL) {
      return loadImage(replaceURL as string).then(onImage);
    }

    return loadURL(url).then(onImage);
  }
  const imageScale = opts.templateScale || 1;

  Object.keys(template.variables).forEach(name => {
    let val = template.variables[name];

    // eslint-disable-next-line no-prototype-builtins
    if ((variables as Object).hasOwnProperty(name)) {
      // @ts-expect-error
      val = variables[name];
    }
    if (/^image_/.test(name)) {
      const isArr = (val as any) instanceof Array;
      // @ts-expect-error
      const first = isArr ? val[0] : val;

      // @ts-expect-error
      pendings.push(requestImageBase64(first, isArr && val[1]).then(dataURL => replacedVariables[name] = dataURL));
    } else {
      replacedVariables[name] = val;
    }
  });

  await Promise.all(pendings);

  const bg = await loadImage(url);
  const content = template.content
    .replace(/\$([\w_]+)\$/g, (str, name) => { return replacedVariables[name]; })
    .replace(`width="${template.width}px"`, `width="${template.width * imageScale}px"`)
    .replace(`height="${template.height}px"`, `height="${template.height * imageScale}px"`);
  const fg = await loadImage(`data:image/svg+xml,${encodeURIComponent(content)}`);
  const canvas = opts?.canvas || document.createElement('canvas');

  canvas.width = bg.width * imageScale;
  canvas.height = bg.height * imageScale;

  return new Promise((resolve, reject) => {
    // FIXME: 先注释掉setTimeout
    // fix ios 14 bug, image may not be drawn
    // setTimeout(() => {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (flipY) {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(fg, 0, 0, fg.width, fg.height, (template.x || 0) * imageScale, (template.y || 0) * imageScale, template.width * imageScale / template.backgroundWidth * bg.width, template.height * imageScale / template.backgroundHeight * bg.height);
    resolve(canvas);
    //}, 0);
  });
}

/**
 * @internal
 * @deprecated since 2.0.0 - use `combineImageTemplate1` instead
 */
export async function combineImageTemplate1Async (
  url: string | HTMLImageElement,
  template: TemplateContentV1,
  variables: Record<string, number | string | HTMLImageElement>,
  opts?: { templateScale?: number, canvas?: HTMLCanvasElement },
  flipY?: boolean,
): Promise<HTMLCanvasElement> {
  console.warn('The combineImageTemplate1Async function is deprecated. Use combineImageTemplate1 instead.');

  return combineImageTemplate1(url, template, variables, opts, flipY);
}

function loadURL (url: string | HTMLImageElement) {
  return isString(url) ? loadImage(url as string) : Promise.resolve(url as HTMLImageElement);
}

function requestImageBase64 (first: string, alt: string) {
  return req(first, function (ex: any) {
    return alt ? req(alt, () => first) : first;
  });

  function req (val: any, onError: any) {
    if (/^(https?:)?\/\//.test(val)) {
      // @ts-expect-error
      return requestAsync(val, { responseType: 'blob' }).then(blobToBase64, onError);
    }

    return Promise.resolve(val);
  }
}

function blobToBase64 (blob: Blob): Promise<string> {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.readAsDataURL(blob);
    reader.onload = function () {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
  });
}
