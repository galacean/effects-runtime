import { ImGui } from '../../../imgui/index';

export type ImVec2 = ImGui.ImVec2;
export const ImVec2 = ImGui.ImVec2;

export type ImVec4 = ImGui.ImVec4;
export const ImVec4 = ImGui.ImVec4;

export class ImRect {
  Min: ImVec2;  // Upper-left
  Max: ImVec2;  // Lower-right

  constructor ();
  constructor (min: ImVec2, max: ImVec2);
  constructor (v: ImVec4);
  constructor (x1: number, y1: number, x2: number, y2: number);
  constructor (
    minOrX1?: ImVec2 | ImVec4 | number,
    minYOrY1?: ImVec2 | number,
    x2?: number,
    y2?: number
  ) {
    if (minOrX1 === undefined) {
      this.Min = new ImVec2(0.0, 0.0);
      this.Max = new ImVec2(0.0, 0.0);
    } else if (minOrX1 instanceof ImVec2 && minYOrY1 instanceof ImVec2) {
      this.Min = minOrX1;
      this.Max = minYOrY1;
    } else if (minOrX1 instanceof ImVec4) {
      this.Min = new ImVec2(minOrX1.x, minOrX1.y);
      this.Max = new ImVec2(minOrX1.z, minOrX1.w);
    } else if (
      typeof minOrX1 === 'number' &&
            typeof minYOrY1 === 'number' &&
            typeof x2 === 'number' &&
            typeof y2 === 'number'
    ) {
      this.Min = new ImVec2(minOrX1, minYOrY1);
      this.Max = new ImVec2(x2, y2);
    } else {
      throw new Error('Invalid constructor arguments');
    }
  }

  GetCenter (): ImVec2 {
    return new ImVec2(
      (this.Min.x + this.Max.x) * 0.5,
      (this.Min.y + this.Max.y) * 0.5
    );
  }

  GetSize (): ImVec2 {
    return new ImVec2(
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

  GetTL (): ImVec2 {
    return this.Min;
  }

  GetTR (): ImVec2 {
    return new ImVec2(this.Max.x, this.Min.y);
  }

  GetBL (): ImVec2 {
    return new ImVec2(this.Min.x, this.Max.y);
  }

  GetBR (): ImVec2 {
    return this.Max;
  }

  Contains (p: ImVec2): boolean;
  Contains (r: ImRect): boolean;
  Contains (arg: ImVec2 | ImRect): boolean {
    if (arg instanceof ImVec2) {
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

  ContainsWithPad (p: ImVec2, pad: ImVec2): boolean {
    return p.x >= this.Min.x - pad.x &&
               p.y >= this.Min.y - pad.y &&
               p.x < this.Max.x + pad.x &&
               p.y < this.Max.y + pad.y;
  }

  Overlaps (r: ImRect): boolean {
    return r.Min.y < this.Max.y &&
               r.Max.y > this.Min.y &&
               r.Min.x < this.Max.x &&
               r.Max.x > this.Min.x;
  }

  Add (p: ImVec2): void;
  Add (r: ImRect): void;
  Add (arg: ImVec2 | ImRect): void {
    if (arg instanceof ImVec2) {
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
  Expand (amount: ImVec2): void;
  Expand (amount: number | ImVec2): void {
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

  Translate (d: ImVec2): void {
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

  ClipWith (r: ImRect): void {
    this.Min.x = Math.max(this.Min.x, r.Min.x);
    this.Min.y = Math.max(this.Min.y, r.Min.y);
    this.Max.x = Math.min(this.Max.x, r.Max.x);
    this.Max.y = Math.min(this.Max.y, r.Max.y);
  }

  ClipWithFull (r: ImRect): void {
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

  ToVec4 (): ImVec4 {
    return new ImVec4(this.Min.x, this.Min.y, this.Max.x, this.Max.y);
  }
}