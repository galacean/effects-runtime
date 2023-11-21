import * as spec from '@galacean/effects-specification';
import type { vec2 } from '@galacean/effects-specification';
import { SPRITE_VERTEX_STRIDE } from '../constants';
import { earcut } from './earcut';

type BezierPoint = [x: number, y: number, inx: number, iny: number, outx: number, outy: number];
type Geometry = {
  s: number[][],
  p: BezierPoint[],
  c?: vec2,
  t: number,
};

export type Shape2D = {
  gs?: spec.ShapeGeometry[], // multiple geometries
  t: number,
  g: spec.ShapeGeometry, // single geometry
};

export type GeometryFromShape = {
  aPoint: number[] | Float32Array,
  index: number[] | Uint16Array,
};
type ShapeGeometryPre = { p: spec.ShapePoints[1], s: spec.ShapeSplits[1] };
// FIXME: 考虑合并 Shape2D
export type ShapeData = { gs: ShapeGeometryPre[] } & { g: ShapeGeometryPre } & spec.ShapeGeometry;

const POINT_INDEX = 2;

export function getGeometryTriangles (geometry: spec.ShapeGeometry, options: { indexBase?: number, uvTransform?: number[] }) {
  const { s, p } = geometry;
  const segments = s[1];
  const points = p[1];
  let pointCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    pointCount += segment.length - 1;
  }

  const pointData = new Float32Array(pointCount * SPRITE_VERTEX_STRIDE);
  const { indexBase = 0, uvTransform } = options;
  let index = 0;
  let dx = 0, dy = 0, sw = 1, sh = 1, r;

  if (uvTransform) {
    dx = uvTransform[0];
    dy = uvTransform[1];
    r = uvTransform[4];
    sw = r ? uvTransform[3] : uvTransform[2];
    sh = r ? uvTransform[2] : uvTransform[3];
  }

  const temp: vec2 = [0, 0];
  const angle = r === 0 ? 0 : -Math.PI / 2;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const p0 = points[i];
    const p1 = points[i + 1] || points[0];
    const keys = segment;
    const point: vec2 = [0, 0];

    for (let j = 0; j < keys.length - 1; j++) {
      const key = keys[j];

      getBezier2DValue(point, key, p0, p1, p0[4], p0[5], p1[2], p1[3]);
      setPoint(point[0], point[1]);
    }
  }

  const indices = earcut(Array.from(pointData), null, SPRITE_VERTEX_STRIDE, indexBase);

  return { aPoint: pointData, index: new Uint16Array(indices) };

  function setPoint (x: number, y: number) {
    pointData[index++] = x / 2;
    pointData[index++] = y / 2;
    if (uvTransform) {
      temp[0] = x;
      temp[1] = y;
      rotateVec2(temp, temp, angle);
      pointData[index++] = dx + (temp[0] + 1) / 2 * sw;
      pointData[index++] = dy + (temp[1] + 1) / 2 * sh;
    } else {
      pointData[index++] = (x + 1) / 2;
      pointData[index++] = (y + 1) / 2;
    }
    index += POINT_INDEX;
  }
}

/**
 * 根据新老版形状数据获取形状几何数据
 * @param shape 新老版形状数据
 */
function getGeometriesByShapeData (shape: ShapeData) {
  const geometries: spec.ShapeGeometry[] = [];

  // 该版本的单个形状数据可以包含多个形状，可以加个埋点，五福之后没有就可以下掉
  if (shape.gs) {
    shape.gs.forEach(gs => {
      geometries.push({
        p: [spec.ValueType.SHAPE_POINTS, gs.p],
        s: [spec.ValueType.SHAPE_SPLITS, gs.s],
      });
    });
  } else if (shape.g) {
    geometries.push({
      p: [spec.ValueType.SHAPE_POINTS, shape.g.p],
      s: [spec.ValueType.SHAPE_SPLITS, shape.g.s],
    });
  } else {
    geometries.push(shape);
  }

  return geometries;
}

export function getGeometryByShape (shape: ShapeData, uvTransform: number[]): GeometryFromShape {
  const datas = [];
  // 老数据兼容处理
  const geometries = getGeometriesByShapeData(shape);
  let indexBase = 0;
  let aPoint = 0;
  let index = 0;

  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i];
    const data = getGeometryTriangles(geometry, { indexBase, uvTransform });

    indexBase += data.aPoint.length / 5;
    datas.push(data);
    aPoint += data.aPoint.length;
    index += data.index.length;
  }

  if (datas.length === 1) {
    return datas[0];
  }

  const aPointData = new Float32Array(aPoint);
  const indexData = new Uint16Array(index);

  // @ts-expect-error
  for (let i = 0, pointIndex = 0, idx = 0; i < datas[i]; i++) {
    const data = datas[i];

    aPointData.set(data.aPoint, pointIndex);
    pointIndex += data.aPoint.length;
    indexData.set(data.index, idx);
    idx += data.index.length;
  }

  return {
    aPoint: aPointData,
    index: indexData,
  };
}

export function rotateVec2 (out: vec2 | number[], vec2: vec2, angleInRad: number): vec2 {
  const c = Math.cos(angleInRad);
  const s = Math.sin(angleInRad);
  const x = vec2[0];
  const y = vec2[1];

  out[0] = c * x + s * y;
  out[1] = -s * x + c * y;

  return out as vec2;
}

function getBezier2DValue (
  out: vec2,
  t: number,
  p0: vec2 | BezierPoint | number[],
  p1: vec2 | BezierPoint | number[],
  cpx0: number,
  cpy0: number,
  cpx1: number,
  cpy1: number,
) {
  const ddt = 1 - t;
  const a = ddt * ddt * ddt;
  const b = 3 * t * ddt * ddt;
  const c = 3 * t * t * ddt;
  const d = t * t * t;

  out[0] = a * p0[0] + b * cpx0 + c * cpx1 + d * p1[0];
  out[1] = a * p0[1] + b * cpy0 + c * cpy1 + d * p1[1];

  return out;
}
