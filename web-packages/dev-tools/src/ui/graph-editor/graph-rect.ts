import { math } from '@galacean/effects';

export class GraphRect {
  Min: math.Vector2;  // Upper-left
  Max: math.Vector2;  // Lower-right

  constructor ();
  constructor (min: math.Vector2, max: math.Vector2);
  constructor (v: math.Vector4);
  constructor (x1: number, y1: number, x2: number, y2: number);
  constructor (
    minOrX1?: math.Vector2 | math.Vector4 | number,
    minYOrY1?: math.Vector2 | number,
    x2?: number,
    y2?: number
  ) {
    if (minOrX1 === undefined) {
      this.Min = new math.Vector2(0.0, 0.0);
      this.Max = new math.Vector2(0.0, 0.0);
    } else if (minOrX1 instanceof math.Vector2 && minYOrY1 instanceof math.Vector2) {
      this.Min = minOrX1;
      this.Max = minYOrY1;
    } else if (minOrX1 instanceof math.Vector4) {
      this.Min = new math.Vector2(minOrX1.x, minOrX1.y);
      this.Max = new math.Vector2(minOrX1.z, minOrX1.w);
    } else if (
      typeof minOrX1 === 'number' &&
            typeof minYOrY1 === 'number' &&
            typeof x2 === 'number' &&
            typeof y2 === 'number'
    ) {
      this.Min = new math.Vector2(minOrX1, minYOrY1);
      this.Max = new math.Vector2(x2, y2);
    } else {
      throw new Error('Invalid constructor arguments');
    }
  }

  GetCenter (): math.Vector2 {
    return new math.Vector2(
      (this.Min.x + this.Max.x) * 0.5,
      (this.Min.y + this.Max.y) * 0.5
    );
  }

  GetSize (): math.Vector2 {
    return new math.Vector2(
      this.Max.x - this.Min.x,
      this.Max.y - this.Min.y
    );
  }

  GetWidth (): number {
    return this.Max.x - this.Min.x;
  }

  GetHeight (): number {
    return this.Max.y - this.Min.y;
  }

  GetArea (): number {
    return (this.Max.x - this.Min.x) * (this.Max.y - this.Min.y);
  }

  GetTL (): math.Vector2 {
    return this.Min;
  }

  GetTR (): math.Vector2 {
    return new math.Vector2(this.Max.x, this.Min.y);
  }

  GetBL (): math.Vector2 {
    return new math.Vector2(this.Min.x, this.Max.y);
  }

  GetBR (): math.Vector2 {
    return this.Max;
  }

  Contains (p: math.Vector2): boolean;
  Contains (r: GraphRect): boolean;
  Contains (arg: math.Vector2 | GraphRect): boolean {
    if (arg instanceof math.Vector2) {
      return arg.x >= this.Min.x &&
                   arg.y >= this.Min.y &&
                   arg.x < this.Max.x &&
                   arg.y < this.Max.y;
    } else {
      return arg.Min.x >= this.Min.x &&
                   arg.Min.y >= this.Min.y &&
                   arg.Max.x <= this.Max.x &&
                   arg.Max.y <= this.Max.y;
    }
  }

  ContainsWithPad (p: math.Vector2, pad: math.Vector2): boolean {
    return p.x >= this.Min.x - pad.x &&
               p.y >= this.Min.y - pad.y &&
               p.x < this.Max.x + pad.x &&
               p.y < this.Max.y + pad.y;
  }

  Overlaps (r: GraphRect): boolean {
    return r.Min.y < this.Max.y &&
               r.Max.y > this.Min.y &&
               r.Min.x < this.Max.x &&
               r.Max.x > this.Min.x;
  }

  Add (p: math.Vector2): void;
  Add (r: GraphRect): void;
  Add (arg: math.Vector2 | GraphRect): void {
    if (arg instanceof math.Vector2) {
      if (this.Min.x > arg.x) {this.Min.x = arg.x;}
      if (this.Min.y > arg.y) {this.Min.y = arg.y;}
      if (this.Max.x < arg.x) {this.Max.x = arg.x;}
      if (this.Max.y < arg.y) {this.Max.y = arg.y;}
    } else {
      if (this.Min.x > arg.Min.x) {this.Min.x = arg.Min.x;}
      if (this.Min.y > arg.Min.y) {this.Min.y = arg.Min.y;}
      if (this.Max.x < arg.Max.x) {this.Max.x = arg.Max.x;}
      if (this.Max.y < arg.Max.y) {this.Max.y = arg.Max.y;}
    }
  }

  Expand (amount: number): void;
  Expand (amount: math.Vector2): void;
  Expand (amount: number | math.Vector2): void {
    if (typeof amount === 'number') {
      this.Min.x -= amount;
      this.Min.y -= amount;
      this.Max.x += amount;
      this.Max.y += amount;
    } else {
      this.Min.x -= amount.x;
      this.Min.y -= amount.y;
      this.Max.x += amount.x;
      this.Max.y += amount.y;
    }
  }

  Translate (d: math.Vector2): void {
    this.Min.x += d.x;
    this.Min.y += d.y;
    this.Max.x += d.x;
    this.Max.y += d.y;
  }

  TranslateX (dx: number): void {
    this.Min.x += dx;
    this.Max.x += dx;
  }

  TranslateY (dy: number): void {
    this.Min.y += dy;
    this.Max.y += dy;
  }

  ClipWith (r: GraphRect): void {
    this.Min.x = Math.max(this.Min.x, r.Min.x);
    this.Min.y = Math.max(this.Min.y, r.Min.y);
    this.Max.x = Math.min(this.Max.x, r.Max.x);
    this.Max.y = Math.min(this.Max.y, r.Max.y);
  }

  ClipWithFull (r: GraphRect): void {
    this.Min.x = Math.max(Math.min(this.Min.x, r.Max.x), r.Min.x);
    this.Min.y = Math.max(Math.min(this.Min.y, r.Max.y), r.Min.y);
    this.Max.x = Math.min(Math.max(this.Max.x, r.Min.x), r.Max.x);
    this.Max.y = Math.min(Math.max(this.Max.y, r.Min.y), r.Max.y);
  }

  Floor (): void {
    this.Min.x = Math.trunc(this.Min.x);
    this.Min.y = Math.trunc(this.Min.y);
    this.Max.x = Math.trunc(this.Max.x);
    this.Max.y = Math.trunc(this.Max.y);
  }

  IsInverted (): boolean {
    return this.Min.x > this.Max.x || this.Min.y > this.Max.y;
  }

  ToVec4 (): math.Vector4 {
    return new math.Vector4(this.Min.x, this.Min.y, this.Max.x, this.Max.y);
  }
}
