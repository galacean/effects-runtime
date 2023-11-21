export function sanitizeNumbers (vec: number[], zeroValue = Number.EPSILON) {
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
