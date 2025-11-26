export class MathUtils {
  static PI = 3.1415927;
  static PI2 = MathUtils.PI * 2;
  static radiansToDegrees = 180 / MathUtils.PI;
  static radDeg = MathUtils.radiansToDegrees;
  static degreesToRadians = MathUtils.PI / 180;
  static degRad = MathUtils.degreesToRadians;

  static clamp (value: number, min: number, max: number) {
    if (value < min) { return min; }
    if (value > max) { return max; }

    return value;
  }

  static cosDeg (degrees: number) {
    return Math.cos(degrees * MathUtils.degRad);
  }

  static sinDeg (degrees: number) {
    return Math.sin(degrees * MathUtils.degRad);
  }

  static signum (value: number): number {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
  }

  static toInt (x: number) {
    return x > 0 ? Math.floor(x) : Math.ceil(x);
  }

  static cbrt (x: number) {
    const y = Math.pow(Math.abs(x), 1 / 3);

    return x < 0 ? -y : y;
  }

  static randomTriangular (min: number, max: number): number {
    return MathUtils.randomTriangularWith(min, max, (min + max) * 0.5);
  }

  static randomTriangularWith (min: number, max: number, mode: number): number {
    const u = Math.random();
    const d = max - min;

    if (u <= (mode - min) / d) { return min + Math.sqrt(u * d * (mode - min)); }

    return max - Math.sqrt((1 - u) * d * (max - mode));
  }
}

export abstract class Interpolation {
  protected abstract applyInternal (a: number): number;
  apply (start: number, end: number, a: number): number {
    return start + (end - start) * this.applyInternal(a);
  }
}

export class Pow extends Interpolation {
  protected power = 2;

  constructor (power: number) {
    super();
    this.power = power;
  }

  applyInternal (a: number): number {
    if (a <= 0.5) { return Math.pow(a * 2, this.power) / 2; }

    return Math.pow((a - 1) * 2, this.power) / (this.power % 2 == 0 ? -2 : 2) + 1;
  }
}

export class PowOut extends Pow {
  constructor (power: number) {
    super(power);
  }

  override applyInternal (a: number): number {
    return Math.pow(a - 1, this.power) * (this.power % 2 == 0 ? -1 : 1) + 1;
  }
}
