import { Color } from '@galacean/effects-math/es/core/color';
import type { BezierCurve } from './value-getter';
import { ValueGetter, createValueGetter } from './value-getter';
import type { BezierValue } from '@galacean/effects-specification';

export class ColorCurve extends ValueGetter<Color> {
  private value = new Color();

  private rCurve: BezierCurve;
  private gCurve: BezierCurve;
  private bCurve: BezierCurve;
  private aCurve: BezierCurve;

  override onCreate (arg: ColorCurveData) {
    this.rCurve = createValueGetter(arg.r) as BezierCurve;
    this.gCurve = createValueGetter(arg.g) as BezierCurve;
    this.bCurve = createValueGetter(arg.b) as BezierCurve;
    this.aCurve = createValueGetter(arg.a) as BezierCurve;
  }

  override getValue (t: number): Color {
    const r = this.rCurve.getValue(t);
    const g = this.gCurve.getValue(t);
    const b = this.bCurve.getValue(t);
    const a = this.aCurve.getValue(t);

    this.value.set(r, g, b, a);

    return this.value;
  }
}

// TODO replace with spec def
export interface ColorCurveData {
  r: BezierValue,
  g: BezierValue,
  b: BezierValue,
  a: BezierValue,
}