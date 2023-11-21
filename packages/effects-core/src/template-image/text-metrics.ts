import { getConfig, TEMPLATE_USE_OFFSCREEN_CANVAS } from '../config';

export interface IFontMetrics {
  ascent: number,
  descent: number,
  fontSize: number,
}

export class TextMetrics {

  public static _fonts: { [font: string]: IFontMetrics } = {};

  public static METRICS_STRING = '|ÉqÅ';
  public static BASELINE_SYMBOL = 'M';
  public static BASELINE_MULTIPLIER = 1.4;
  public static HEIGHT_MULTIPLIER = 2.0;

  private static __canvas: HTMLCanvasElement;
  private static __context: CanvasRenderingContext2D;

  public static measureFont (font: string): IFontMetrics {
    // as this method is used for preparing assets, don't recalculate things if we don't need to
    if (TextMetrics._fonts[font]) {
      return TextMetrics._fonts[font];
    }

    const properties: IFontMetrics = {
      ascent: 0,
      descent: 0,
      fontSize: 0,
    };

    const canvas = TextMetrics._canvas;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;

    context.font = font;

    const metricsString = TextMetrics.METRICS_STRING + TextMetrics.BASELINE_SYMBOL;
    const width = Math.ceil(context.measureText(metricsString).width);
    let baseline = Math.ceil(context.measureText(TextMetrics.BASELINE_SYMBOL).width);
    const height = Math.ceil(TextMetrics.HEIGHT_MULTIPLIER * baseline);

    baseline = baseline * TextMetrics.BASELINE_MULTIPLIER | 0;

    canvas.width = width;
    canvas.height = height;

    context.fillStyle = '#f00';
    context.fillRect(0, 0, width, height);

    context.font = font;

    context.textBaseline = 'alphabetic';
    context.fillStyle = '#000';
    context.fillText(metricsString, 0, baseline);

    const imagedata = context.getImageData(0, 0, width, height).data;
    const pixels = imagedata.length;
    const line = width * 4;

    let i = 0;
    let idx = 0;
    let stop = false;

    // ascent. scan from top to bottom until we find a non red pixel
    for (i = 0; i < baseline; ++i) {
      for (let j = 0; j < line; j += 4) {
        if (imagedata[idx + j] !== 255) {
          stop = true;

          break;
        }
      }
      if (!stop) {
        idx += line;
      } else {
        break;
      }
    }

    properties.ascent = baseline - i;

    idx = pixels - line;
    stop = false;

    // descent. scan from bottom to top until we find a non red pixel
    for (i = height; i > baseline; --i) {
      for (let j = 0; j < line; j += 4) {
        if (imagedata[idx + j] !== 255) {
          stop = true;

          break;
        }
      }

      if (!stop) {
        idx -= line;
      } else {
        break;
      }
    }

    properties.descent = i - baseline;
    properties.fontSize = properties.ascent + properties.descent;

    TextMetrics._fonts[font] = properties;

    return properties;
  }

  public static get _canvas (): HTMLCanvasElement {
    let canvas: HTMLCanvasElement;

    if (getConfig(TEMPLATE_USE_OFFSCREEN_CANVAS)) {
      // @ts-expect-error
      canvas = window._createOffscreenCanvas(10, 10);
      TextMetrics.__canvas = canvas;
    } else if (!TextMetrics.__canvas) {
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = 10;
      TextMetrics.__canvas = canvas;
    }

    return TextMetrics.__canvas;
  }
}
