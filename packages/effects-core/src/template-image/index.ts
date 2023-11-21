import type { FontBase, StringTemplate, TemplateContentV1, TemplateContentV2 } from '@galacean/effects-specification';
import { FontStyle, TextAlignment, TextOverflow } from '@galacean/effects-specification';
import { QText, QTextWrapMode } from './qtext';
import { QCanvasViewer } from './qcanvas-viewer';
import { loadImage } from '../downloader';
import { addItem, isString } from '../utils';
import { combineImageTemplate1 } from './template-v1';
import { getConfig, TEMPLATE_USE_OFFSCREEN_CANVAS } from '../config';

export * from './qcanvas-viewer';
export * from './qtext';
export * from './template-v1';

export const DEFAULT_FONTS = [
  'serif',
  'sans-serif',
  'monospace',
  'courier',
];

// 文本框在canvas中的位置
export interface TextLayout {
  x: number,
  y: number,
  width: number,
  height: number,
}

export interface TemplateOptions {
  templateScale?: number, // 画布缩放系数
  canvas?: HTMLCanvasElement, // 绘制画布
  textLayouts?: TextLayout[], // 返回文本布局信息
  debug?: boolean, // 显示边框
  borderColor?: string, // 边框颜色
  borderWidth?: number, // 边框宽度
  flipY?: boolean, // 是否反转画布
  scaleX?: number, // x轴缩放
  scaleY?: number, // y轴缩放
  toData?: boolean, // 返回 imageData 对象
}

const defaultWidth = 800;
const defaultHeight = 600;
const viewerCanvasMap: Map<HTMLCanvasElement, QCanvasViewer> = new Map<HTMLCanvasElement, QCanvasViewer>();

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
      // in hongmeng system,create too many canvas will case render error
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

function getCanvasViewer (
  width: number,
  height: number,
  opt?: TemplateOptions
) {
  let viewer: QCanvasViewer;
  const scale = opt?.templateScale || 1.0;
  const flipY = opt?.flipY || false;

  if (opt?.canvas) {
    viewer = viewerCanvasMap.get(opt.canvas) as QCanvasViewer;
    if (!viewer) {
      const newViewer = new QCanvasViewer(opt.canvas, width, height, scale, scale, flipY);

      viewerCanvasMap.set(opt.canvas, newViewer);
      viewer = newViewer;
    }
  } else {
    const canvas = canvasPool.getCanvas();

    viewer = new QCanvasViewer(canvas, defaultWidth, defaultHeight, scale, scale, flipY);
  }

  return viewer;
}

function convert2QTextList (
  stringTemplateContent: StringTemplate,
  variables?: Record<string, number | string>,
  opt?: TemplateOptions
) {
  // 创建文本绘制对象
  const fonts = stringTemplateContent.fonts;
  const qTextList: QText[] = [];

  stringTemplateContent.texts.forEach(text => {
    let textString = text.t;
    const left = text.x;
    const top = text.y;
    // 字体属性
    let font: FontBase = {
      weight: 400,
      family: 'serif',
      size: 48,
      style: FontStyle.normal,
    };

    if (text.f !== undefined) {
      font = fonts[text.f];
    }

    // 文字替换
    const name = text.n;

    // eslint-disable-next-line no-prototype-builtins
    if (name && variables && variables.hasOwnProperty(name)) {
      textString = `${variables[name]}`;
    }

    // 创建文字对象
    const qtext = new QText(textString, {
      left: left,
      top: top,
      fontSize: font.size,
      fontFamily: font.family,
      fontWeight: `${font.weight}`,
      fontStyle: 'normal',
      name,
    });

    // @ts-expect-error
    if (text.r !== undefined) {
      // @ts-expect-error
      qtext.angle = (text.r * Math.PI / 180);
    }

    qtext.active = opt?.debug ?? false;

    //文字最大宽度
    if (text.w !== undefined) {
      qtext.width = text.w;
    }

    // 字间距
    if (font.letterSpace !== undefined) {
      qtext.letterSpacing = font.letterSpace;
    }

    // 超过最大宽度行为
    if (text.of === TextOverflow.display) {
      qtext.wrap = QTextWrapMode.Default;
    } else if (text.of === TextOverflow.clip) {
      qtext.wrap = QTextWrapMode.Clip;
    } else if (text.of === TextOverflow.ellipsis) {
      qtext.wrap = QTextWrapMode.Ellipsis;
    }

    // 文字颜色
    if (text.c !== undefined) {
      const textColor = stringTemplateContent.colors[text.c][1];
      let alpha = 1.0;

      if (textColor[3] !== undefined) {
        alpha = textColor[3] / 255;
      }
      qtext.color = `rgba(${textColor[0]}, ${textColor[1]}, ${textColor[2]}, ${alpha})`;
    }

    // 文字对齐方式
    if (text.a === TextAlignment.left) {
      qtext.textAlign = 'left';
    } else if (text.a === TextAlignment.middle) {
      qtext.textAlign = 'center';
    } else if (text.a === TextAlignment.right) {
      qtext.textAlign = 'right';
    }

    // 文字style
    if (font.style === FontStyle.normal) {
      qtext.fontStyle = 'normal';
    } else if (font.style === FontStyle.italic) {
      qtext.fontStyle = 'italic';
    } else if (font.style === FontStyle.oblique) {
      qtext.fontStyle = 'oblique';
    }

    // 文字weight
    if (font.weight !== undefined) {
      qtext.fontWeight = String(font.weight);
    }

    // 边框颜色
    if (opt?.borderColor) {
      qtext.borderColor = opt.borderColor;
    }

    if (opt?.borderWidth !== undefined) {
      qtext.borderWidth = opt.borderWidth;
    }

    qTextList.push(qtext);
  });

  return qTextList;
}

export function getBackgroundImage (template: TemplateContentV2, variables?: Record<string, number | string | string[]>) {
  let templateBackground;

  if (template?.background?.name) {
    const name = template.background.name;

    if (variables && variables[name]) {
      templateBackground = variables[name];
    } else if (template.background?.url) {
      templateBackground = template.background.url;
    }
  }

  return templateBackground;
}

async function drawImageAndTemplate (
  viewer: QCanvasViewer,
  image?: HTMLImageElement,
  template?: TemplateContentV2,
  variables?: Record<string, number | string>,
  opt?: TemplateOptions
) {

  if (!image) {
    throw Error('image not provided');
  }

  const templateScale = opt?.templateScale || 1;
  let scaleX = templateScale;
  let scaleY = templateScale;
  let drawImage = image;
  let width = image.width;
  let height = image.height;

  if (template) {

    width = template.width;
    height = template.height;

    if (image.width !== width || image.height !== height) {
      //in webgl1 image will resize to pot
      //so scale template to image size
      scaleX *= (image.width / template.width);
      scaleY *= (image.height / template.height);
    }

    // 获取动态换图的图片对象或url地址
    const templateBackground = getBackgroundImage(template, variables);

    if (templateBackground && templateBackground !== image.src) {
      // @ts-expect-error
      drawImage = isString(templateBackground) ? await loadImage(templateBackground as string) : templateBackground;
    }

    // 转换文字对象到qtext
    const stringTemplateContent = template.content;

    if (stringTemplateContent) {

      // 创建文本绘制对象
      const qTextList = convert2QTextList(
        stringTemplateContent,
        variables,
        { ...opt, ...{ scaleX: scaleX, scaleY: scaleY } },
      );

      qTextList.forEach(qText => {
        viewer.addObject(qText);
      });
    }

  }

  viewer.flipY = opt?.flipY ?? false;
  viewer.initDimension(width, height, scaleX, scaleY);

  // 设置背景图
  viewer.background = drawImage;

  // 将文本绘制到canvas上
  viewer.render();

  // 设置布局数据
  const textLayouts = opt?.textLayouts;

  if (textLayouts) {
    // 清空数组
    textLayouts.length = 0;
    // 返回文本的布局对象
    viewer.textList.forEach(qText => {
      const layout = qText.getLayout();
      const textLayout: TextLayout = {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
      };

      textLayouts.push(textLayout);
    });
  }
}

async function prepareFontResources (template: TemplateContentV2) {
  if (template.content && template.content.fonts) {
    const fontDescList = template.content.fonts;

    for (let i = 0; i < fontDescList.length; ++i) {
      const name = fontDescList[i].family;
      const url = fontDescList[i].url;

      let hasFontAdd = false;

      if (DEFAULT_FONTS.includes(name as string)) {
        hasFontAdd = true;
      } else {
        if (document.fonts !== undefined) {
          document.fonts.forEach(fontFace => {
            if (fontFace.family === name) {
              hasFontAdd = true;
            }
          });
        }
      }

      if (!hasFontAdd && url !== undefined && url !== '') {
        const source = `url(${url})`;

        if (document.fonts !== undefined) {
          const fontFace = new FontFace(`${name}`, source);

          await fontFace.load();
          // @ts-expect-error
          document.fonts.add(fontFace);
        }
      }
    }

  }
}

/**
 * @param {string|HTMLImageElement} url
 * @param {TemplateContentV2} [template]
 * @param {Record<string, number | string>} [variables]
 * @param {TemplateOptions} [opts]
 * @param {boolean} [flipY]
 * @returns
 */
export async function combineImageTemplate2 (
  url: string | HTMLImageElement,
  template?: TemplateContentV2,
  variables?: Record<string, number | string>,
  opts?: TemplateOptions,
  flipY?: boolean
): Promise<HTMLCanvasElement> {
  const templateOption = { ...opts, flipY };
  // 获取绘制文本viewer
  const viewer = getCanvasViewer(defaultWidth, defaultWidth, templateOption);

  // 下载字体
  if (template !== undefined) {
    await prepareFontResources(template);
  }
  // 清空文本
  viewer.clearText();

  if (typeof url === 'string') {
    const image = await loadImage(url);

    await drawImageAndTemplate(viewer, image, template, variables, templateOption);

    return viewer.renderCanvas;
  } else {
    await drawImageAndTemplate(viewer, url, template, variables, templateOption);

    return viewer.renderCanvas;
  }
}

/**
 * @internal
 * @deprecated since 2.0.0 - use `combineImageTemplate2` instead
 */
export async function combineImageTemplate2Async (
  url: string | HTMLImageElement,
  template?: TemplateContentV2,
  variables?: Record<string, number | string>,
  opts?: TemplateOptions,
  flipY?: boolean
): Promise<HTMLCanvasElement | ImageData> {
  console.warn('The combineImageTemplate2Async function is deprecated. Use combineImageTemplate2 instead.');

  return combineImageTemplate2(url, template, variables, opts, flipY);
}

/**
 * @param url
 * @param template
 * @param variables
 * @param opts
 * @param flipY
 * @returns
 */
export async function combineImageTemplate (
  url: string | HTMLImageElement,
  template: TemplateContentV1 | TemplateContentV2,
  variables: Record<string, number | string>,
  opts?: { templateScale?: number, canvas?: HTMLCanvasElement },
  flipY?: boolean,
): Promise<HTMLCanvasElement> {
  if ((template as TemplateContentV2).v === 2) {
    return combineImageTemplate2(
      url,
      template as TemplateContentV2,
      variables,
      {
        templateScale: opts?.templateScale,
        toData: true,
      },
      flipY,
    );
  }

  return combineImageTemplate1(url, template as TemplateContentV1, variables, opts, flipY);
}

/**
 * @internal
 * @deprecated since 2.0.0 - use `combineImageTemplate` instead
 */
export async function combineImageTemplateAsync (
  url: string | HTMLImageElement,
  template: TemplateContentV1 | TemplateContentV2,
  variables: Record<string, number | string>,
  opts?: { templateScale?: number, canvas?: HTMLCanvasElement },
  flipY?: boolean,
): Promise<HTMLCanvasElement | HTMLImageElement | ImageData> {
  console.warn('The combineImageTemplateAsync function is deprecated. Use combineImageTemplate instead.');

  return combineImageTemplate(url, template, variables, opts, flipY);
}
