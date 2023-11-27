import type { math } from '@galacean/effects';

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;

export function sanitizeNumbers (vec: number[] | Vector2 | Vector3 | Vector4, zeroValue = Number.EPSILON) {
  if (!(vec instanceof Array)) {
    vec = vec.toArray();
  }

  return vec.map(num => {
    if (Math.abs(num) <= zeroValue || 1 / num === -Infinity) {
      return 0;
    }

    return num;
  });
}

export function sleep (ms: number) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}
