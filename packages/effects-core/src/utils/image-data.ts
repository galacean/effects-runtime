import { isString } from './index';
import type { ColorStop } from './color';
import { colorStopsFromGradient, colorToArr, interpolateColor } from './color';

export function imageDataFromColor (value: string | number[]) {
  if (isString(value)) {
    value = colorToArr(value);
  }

  const color = value;
  const image = {
    width: 1,
    height: 1,
    data: new Uint8Array(1 * 1 * 4),
  };
  const data = image.data;

  for (let i = 0; i < 4; i++) {
    data[i] = color[i];
  }

  return image;
}

export function imageDataFromGradient (gradient: number[][] | Record<string, string | number[]>) {
  const width = 128;
  const image = {
    width,
    height: 1,
    data: new Uint8Array(width * 1 * 4),
  };
  const data = image.data;
  const stops = colorStopsFromGradient(gradient);

  if (stops.length) {
    data.set(stops[0].color.toArray(), 0);
    for (let i = 1, cursor = 0; i < width - 1; i++) {
      const index = i / width;
      let s0!: ColorStop;
      let s1!: ColorStop;

      for (let j = cursor; j < stops.length; j++) {
        s0 = stops[j];
        s1 = stops[j + 1];
        if (s0.time <= index && s1.time > index) {
          break;
        }
      }
      const color = interpolateColor(s0.color.toArray(), s1.color.toArray(), (index - s0.time) / (s1.time - s0.time));

      data.set(color, i * 4);
    }
    data.set(stops[stops.length - 1].color.toArray(), (width - 1) * 4);
  }

  return image;
}
