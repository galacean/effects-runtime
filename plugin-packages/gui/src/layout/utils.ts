const EPSILON = 1e-7;

export function assertFinite (name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

export function assertEnumValue (name: string, value: number, maximum: number): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`Invalid ${name}.`);
  }
}

export function sum (values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Grows slots by weight, removing capped slots and redistributing their
 * unused share. Fractional pixels are accumulated and the last slot absorbs
 * the remaining numerical error when the supplied space is integral.
 */
export function growSlots (
  sizes: number[],
  ceilings: number[],
  weights: number[],
  extra: number,
  integerPixels: boolean,
): number {
  let remaining = Math.max(0, extra);
  let active = sizes.map((_, index) => index).filter(index =>
    weights[index] > 0 && (ceilings[index] < 0 || sizes[index] < ceilings[index] - EPSILON));

  while (remaining > EPSILON && active.length > 0) {
    const totalWeight = active.reduce((total, index) => total + weights[index], 0);
    let capped = false;

    for (const index of active) {
      const ceiling = ceilings[index];
      const share = remaining * weights[index] / totalWeight;

      if (ceiling >= 0 && sizes[index] + share > ceiling + EPSILON) {
        const growth = Math.max(0, ceiling - sizes[index]);

        sizes[index] = ceiling;
        remaining -= growth;
        active = active.filter(value => value !== index);
        capped = true;

        break;
      }
    }
    if (capped) {
      continue;
    }

    let assigned = 0;
    let pixelError = 0;

    for (let activeIndex = 0; activeIndex < active.length; activeIndex++) {
      const index = active[activeIndex];
      let growth = activeIndex === active.length - 1
        ? remaining - assigned
        : remaining * weights[index] / totalWeight;

      if (integerPixels && activeIndex !== active.length - 1) {
        const exactGrowth = growth + pixelError;

        growth = Math.floor(exactGrowth);
        pixelError = exactGrowth - growth;
      }
      sizes[index] += growth;
      assigned += growth;
    }
    remaining = 0;
  }

  return remaining;
}

export function alignmentOffset (alignment: number, remaining: number): number {
  if (alignment === 1) {
    return remaining / 2;
  }
  if (alignment === 2) {
    return remaining;
  }

  return 0;
}
