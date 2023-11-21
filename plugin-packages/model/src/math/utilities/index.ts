class MathUtils {
  static EPSILON6 = 0.000001;
  static EPSILON7 = 0.0000001;
  static EPSILON21 = 0.000000000000000000001;

  static acosClamped (value: number) {
    return Math.acos(MathUtils.clamp(value, -1.0, 1.0));
  }

  static clamp (value: number, min: number, max: number) {
    return value < min ? min : value > max ? max : value;
  }

  static equalsEpsilon (
    left: number,
    right: number,
    relativeEpsilon: number,
    absoluteEpsilon: number
  ) {
    relativeEpsilon = (relativeEpsilon ?? 0.0);
    absoluteEpsilon = (absoluteEpsilon ?? relativeEpsilon);
    const absDiff = Math.abs(left - right);

    return (
      absDiff <= absoluteEpsilon ||
      absDiff <= relativeEpsilon * Math.max(Math.abs(left), Math.abs(right))
    );
  }
}

export { MathUtils };
