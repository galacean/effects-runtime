import * as spec from '@galacean/effects-specification';
import { colorToArr, isFunction } from '../../utils';
import { BezierCurve, BezierCurvePath, BezierCurveQuat, GradientValue, LinearValue, LineSegments, PathSegments, RandomSetValue, RandomValue, RandomVectorValue, StaticValue } from './value-getter';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { ColorCurve } from './color-curve';
import { Vector2Curve, Vector4Curve } from './vector-curves';
import { ValueGetter } from './value-getter';
import { HELP_LINK } from '../../constants';

const map: Record<any, any> = {
  [spec.ValueType.RANDOM] (props: number[][]) {
    if (props[0] instanceof Array) {
      return new RandomVectorValue(props);
    }

    return new RandomValue(props);
  },
  [spec.ValueType.CONSTANT] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.CONSTANT_VEC2] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.CONSTANT_VEC3] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.CONSTANT_VEC4] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.RGBA_COLOR] (props: number) {
    return new StaticValue(props);
  },
  [spec.ValueType.COLORS] (props: number[][]) {
    return new RandomSetValue(props.map(c => colorToArr(c, false)));
  },
  [spec.ValueType.LINE] (props: number[][]) {
    if (props.length === 2 && props[0][0] === 0 && props[1][0] === 1) {
      return new LinearValue([props[0][1], props[1][1]]);
    }

    return new LineSegments(props);
  },
  [spec.ValueType.GRADIENT_COLOR] (props: number[][] | Record<string, string>) {
    return new GradientValue(props);
  },
  [spec.ValueType.LINEAR_PATH] (pros: number[][][]) {
    return new PathSegments(pros);
  },
  [spec.ValueType.BEZIER_CURVE] (props: number[][][]) {
    if (props.length === 1) {
      return new StaticValue(props[0][1][1]);
    }

    return new BezierCurve(props);
  },
  [spec.ValueType.BEZIER_CURVE_PATH] (props: number[][][]) {
    if (props[0].length === 1) {
      return new StaticValue(new Vector3(...props[1][0]));
    }

    return new BezierCurvePath(props);
  },
  [spec.ValueType.BEZIER_CURVE_QUAT] (props: number[][][]) {
    if (props[0].length === 1) {
      return new StaticValue(new Quaternion(...props[1][0]));
    }

    return new BezierCurveQuat(props);
  },
  [spec.ValueType.COLOR_CURVE] (props: spec.ColorCurveData) {
    return new ColorCurve(props);
  },
  [spec.ValueType.VECTOR4_CURVE] (props: spec.Vector4CurveData) {
    return new Vector4Curve(props);
  },
  [spec.ValueType.VECTOR2_CURVE] (props: spec.Vector2CurveData) {
    return new Vector2Curve(props);
  },
};

export function createValueGetter (args: any): ValueGetter<any> {
  if (!args || !isNaN(+args)) {
    return new StaticValue(args || 0);
  }

  if (args instanceof ValueGetter) {
    return args;
  }

  if (isFunction(map[args[0]])) {
    return map[args[0]](args[1]);
  } else {
    throw new Error(`ValueType: ${args[0]} is not supported, see ${HELP_LINK['ValueType: 21/22 is not supported']}.`);
  }
}