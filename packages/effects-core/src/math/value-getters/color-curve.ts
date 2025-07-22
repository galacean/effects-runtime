import { Color } from '@galacean/effects-math/es/core/color';
import { ValueGetter } from './value-getter';
import type * as spec from '@galacean/effects-specification';
import { createValueGetter } from './value-getter-map';
import type { BezierCurve } from './bezier-curve';

export class ColorCurve extends ValueGetter<Color> {
  private value = new Color();

  private rCurve: BezierCurve;
  private gCurve: BezierCurve;
  private bCurve: BezierCurve;
  private aCurve: BezierCurve;

  override onCreate (arg: spec.ColorCurveData) {
    this.rCurve = createValueGetter(arg[0]) as BezierCurve;
    this.gCurve = createValueGetter(arg[1]) as BezierCurve;
    this.bCurve = createValueGetter(arg[2]) as BezierCurve;
    this.aCurve = createValueGetter(arg[3]) as BezierCurve;
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