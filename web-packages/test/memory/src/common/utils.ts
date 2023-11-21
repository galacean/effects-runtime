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

export function shuffleArray (array: Object[], offset: number, count: number) {
  // @ts-expect-error
  Math.seedrandom(`shuffleArray${offset}-${count}`);

  for (let i = 0; i < count; i++) {
    const j = Math.min(Math.floor(Math.random() * count), count - 1);
    const t = array[i + offset];

    array[i + offset] = array[j + offset];
    array[j + offset] = t;
  }
}