import { isString } from './index';

export type color = [r: number, g: number, b: number, a: number];

export interface ColorStop {
  stop: number,
  color: color | number[],
}

export function colorToArr (hex: string | number[], normalized?: boolean): color {
  let ret: color = [0, 0, 0, 0];

  if (isString(hex)) {
    hex = (hex as string).replace(/[\s\t\r\n]/g, '');
    let m = /rgba?\(([.\d]+),([.\d]+),([.\d]+),?([.\d]+)?\)/.exec(hex);

    if (m) {
      const a = +m[4];

      ret = [+m[1], +m[2], +m[3], isNaN(a) ? 255 : a * 255];
    } else if (/^#[a-f\d]{3}$/i.test(hex)) {
      ret = [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16), 255];
      // eslint-disable-next-line no-cond-assign
    } else if (m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)) {
      ret = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255] || [0, 0, 0, 255];
    }
  } else if (hex instanceof Array) {
    ret = [hex[0], hex[1], hex[2], isNaN(hex[3]) ? 255 : hex[3]];
  }

  if (normalized) {
    for (let i = 0; i < 4; i++) {
      ret[i] /= 255;
    }
  }

  return ret;
}

export function getColorFromGradientStops (stops: ColorStop[], key: number, normalize?: boolean): color | number[] {
  if (stops.length) {
    let color: number[] | color | undefined;

    for (let j = 1; j <= stops.length - 1; j++) {
      const s0 = stops[j - 1];
      const s1 = stops[j];

      if (s0.stop <= key && key <= s1.stop) {
        color = interpolateColor(s0.color, s1.color, (key - s0.stop) / (s1.stop - s0.stop));

        break;
      }
    }
    if (!color) {
      color = stops[stops.length - 1].color;
    }

    return normalize ? color.map(n => n / 255) : color;
  }

  return [0, 0, 0, 0];
}

export function colorStopsFromGradient (gradient: number[][] | Record<string, string | number[]>): ColorStop[] {
  let stops: ColorStop[] = [];

  if (gradient instanceof Array) {
    gradient.forEach(val => {
      const [s, r, g, b, a] = val;

      stops.push({
        // TODO
        // @ts-expect-error
        stop: parsePercent(s),
        color: [r, g, b, a],
      });
    });
  } else {
    Object.keys(gradient).forEach(stop => {
      const colorRGB = gradient[stop];
      const color = colorToArr(colorRGB);

      stops.push({
        stop: parsePercent(stop),
        color,
      });
    });
  }
  stops = stops.sort((a, b) => a.stop - b.stop);
  if (stops.length) {
    if (stops[0].stop !== 0) {
      stops.unshift({ stop: 0, color: stops[0].color.slice() });
    }
    const lastStop = stops[stops.length - 1];

    if (lastStop.stop !== 1) {
      stops.push({ stop: 1, color: lastStop.color.slice() });
    }
  }

  return stops;
}

export function interpolateColor (a: color | number[], b: color | number[], s: number, origin?: boolean): color {
  const ret = [] as unknown as color;
  const ms = 1 - s;

  if (origin) {
    for (let i = 0; i < 4; i++) {
      ret[i] = a[i] * ms + b[i] * s;
    }
  } else {
    for (let i = 0; i < 3; i++) {
      ret[i] = Math.round(Math.sqrt(a[i] * a[i] * ms + b[i] * b[i] * s));
    }
    ret[3] = Math.round(a[3] * ms + b[3] * s);
  }

  return ret;
}

export function parsePercent (c: string): number {
  const match = /^(-)?([\d+.]+)%$/.exec(c);

  if (match) {
    return +match[2] / 100 * (match[1] ? -1 : 1);
  }

  return +c;
}
