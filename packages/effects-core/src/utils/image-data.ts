import { isString } from './index';
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
    for (let i = 0; i < width; i++) {
      const index = i / (width - 1);

      if (index <= stops[0].time) {
        data.set(stops[0].color.toArray(), i * 4);
      } else if (index >= stops[stops.length - 1].time) {
        data.set(stops[stops.length - 1].color.toArray(), i * 4);
      } else {
        for (let j = 0; j < stops.length - 1; j++) {
          const s0 = stops[j];
          const s1 = stops[j + 1];

          if (s0.time <= index && s1.time > index) {
            const color = interpolateColor(s0.color.toArray(), s1.color.toArray(), (index - s0.time) / (s1.time - s0.time));

            data.set(color, i * 4);

            break;
          }
        }
      }
    }
  }

  return image;
}
