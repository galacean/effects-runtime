export class Vector2 {
  constructor (public x = 0, public y = 0) {
  }

  set (x: number, y: number): Vector2 {
    this.x = x;
    this.y = y;

    return this;
  }

  length () {
    const x = this.x;
    const y = this.y;

    return Math.sqrt(x * x + y * y);
  }

  normalize () {
    const len = this.length();

    if (len != 0) {
      this.x /= len;
      this.y /= len;
    }

    return this;
  }
}

