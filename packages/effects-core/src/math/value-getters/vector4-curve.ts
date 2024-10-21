import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { BezierCurve } from './value-getter';
import { ValueGetter } from './value-getter';
import type { spec } from '@galacean/effects-core';
import { createValueGetter } from './value-getter-map';

export class Vector4Curve extends ValueGetter<Vector4> {
  private value = new Vector4();

  private xCurve: BezierCurve;
  private yCurve: BezierCurve;
  private zCurve: BezierCurve;
  private wCurve: BezierCurve;

  override onCreate (arg: spec.Vector4CurveData) {
    this.xCurve = createValueGetter(arg.x) as BezierCurve;
    this.yCurve = createValueGetter(arg.y) as BezierCurve;
    this.zCurve = createValueGetter(arg.z) as BezierCurve;
    this.wCurve = createValueGetter(arg.w) as BezierCurve;
  }

  override getValue (t: number): Vector4 {
    const x = this.xCurve.getValue(t);
    const y = this.yCurve.getValue(t);
    const z = this.zCurve.getValue(t);
    const w = this.wCurve.getValue(t);

    this.value.set(x, y, z, w);

    return this.value;
  }
}