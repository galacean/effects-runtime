import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type * as spec from '@galacean/effects-specification';
import { ValueGetter } from './value-getter';
import { createValueGetter } from './value-getter-map';
import type { BezierCurve } from './bezier-curve';

export class Vector4Curve extends ValueGetter<Vector4> {
  private value = new Vector4();

  private xCurve: BezierCurve;
  private yCurve: BezierCurve;
  private zCurve: BezierCurve;
  private wCurve: BezierCurve;

  override onCreate (arg: spec.Vector4CurveData) {
    this.xCurve = createValueGetter(arg[0]) as BezierCurve;
    this.yCurve = createValueGetter(arg[1]) as BezierCurve;
    this.zCurve = createValueGetter(arg[2]) as BezierCurve;
    this.wCurve = createValueGetter(arg[3]) as BezierCurve;
  }

  override getValue (t: number): Vector4 {
    const x = this.xCurve.getValue(t);
    const y = this.yCurve.getValue(t);
    const z = this.zCurve.getValue(t);
    const w = this.wCurve.getValue(t);

    this.value.set(x, y, z, w);

    return this.value;
  }

  override getMaxTime (): number {
    return Math.max(
      this.xCurve.getMaxTime(),
      this.yCurve.getMaxTime(),
      this.zCurve.getMaxTime(),
      this.wCurve.getMaxTime(),
    );
  }
}

export class Vector3Curve extends ValueGetter<Vector3> {
  private value = new Vector3();

  private xCurve: BezierCurve;
  private yCurve: BezierCurve;
  private zCurve: BezierCurve;

  override onCreate (arg: spec.Vector3CurveData) {
    this.xCurve = createValueGetter(arg[0]) as BezierCurve;
    this.yCurve = createValueGetter(arg[1]) as BezierCurve;
    this.zCurve = createValueGetter(arg[2]) as BezierCurve;
  }

  override getValue (t: number): Vector3 {
    const x = this.xCurve.getValue(t);
    const y = this.yCurve.getValue(t);
    const z = this.zCurve.getValue(t);

    this.value.set(x, y, z);

    return this.value;
  }

  override getMaxTime (): number {
    return Math.max(
      this.xCurve.getMaxTime(),
      this.yCurve.getMaxTime(),
      this.zCurve.getMaxTime(),
    );
  }
}

export class Vector2Curve extends ValueGetter<Vector2> {
  private value = new Vector2();

  private xCurve: BezierCurve;
  private yCurve: BezierCurve;

  override onCreate (arg: spec.Vector2CurveData) {
    this.xCurve = createValueGetter(arg[0]) as BezierCurve;
    this.yCurve = createValueGetter(arg[1]) as BezierCurve;
  }

  override getValue (t: number): Vector2 {
    const x = this.xCurve.getValue(t);
    const y = this.yCurve.getValue(t);

    this.value.set(x, y);

    return this.value;
  }

  override getMaxTime (): number {
    return Math.max(
      this.xCurve.getMaxTime(),
      this.yCurve.getMaxTime(),
    );
  }
}
