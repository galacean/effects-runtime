import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Matrix3, Vector2, Vector3 } from './core';

/**
 * 二维几何工具函数：极角、向量夹角与包围盒归一化/还原。
 */

const UNIT_BOX = new Box2(new Vector2(), new Vector2(1, 1));
const MATRIX_EPSILON = 1e-8;

/**
 * 读取轴对齐包围盒的四个角点。
 * @param box 轴对齐包围盒
 * @returns 按顺时针排列的四个新角点
 */
export function getBoxCorners (box: Box2): Vector2[] {
  return [
    box.min.clone(),
    new Vector2(box.max.x, box.min.y),
    box.max.clone(),
    new Vector2(box.min.x, box.max.y),
  ];
}

/** 从 Box2 的视图角点建立归一化 Box2 到视图坐标的二维仿射变换。 */
export function getBoxTransform (points: Vector2[]): Matrix3 | undefined {
  if (points.length !== 4) {
    return undefined;
  }

  const [leftTop, rightTop, , leftBottom] = points;
  const transform = new Matrix3().setFromRowMajorData(
    rightTop.x - leftTop.x,
    leftBottom.x - leftTop.x,
    leftTop.x,
    rightTop.y - leftTop.y,
    leftBottom.y - leftTop.y,
    leftTop.y,
    0,
    0,
    1,
  );

  return Math.abs(transform.determinant()) <= MATRIX_EPSILON ? undefined : transform;
}

/** 从一个视图 Box2 建立无旋转变换。 */
export function getBoxTransformFromBox (box: Box2): Matrix3 | undefined {
  if (box.isEmpty()) {
    return undefined;
  }
  const size = box.getSize();

  return new Matrix3().setFromRowMajorData(
    size.x, 0, box.min.x,
    0, size.y, box.min.y,
    0, 0, 1,
  );
}

/** 使用二维变换映射一个 Box2 局部点。 */
export function transformBoxPoint (transform: Matrix3, point: Vector2): Vector2 {
  const result = transform.transformPoint(new Vector3(point.x, point.y, 1));

  return new Vector2(result.x, result.y);
}

/** 将视图点逆变换到 Box2 局部坐标。 */
export function inverseTransformBoxPoint (transform: Matrix3, point: Vector2): Vector2 {
  return transformBoxPoint(transform.clone().invert(), point);
}

/** 临时计算 Box2 变换后的四个点。 */
export function getTransformedBoxCorners (transform: Matrix3, box: Box2 = UNIT_BOX): Vector2[] {
  return getBoxCorners(box).map(point => transformBoxPoint(transform, point));
}

/** 计算 Box2 变换后的轴对齐范围。 */
export function getTransformedBox (transform: Matrix3, box: Box2 = UNIT_BOX): Box2 {
  return setBoxFromPoints(new Box2(), getTransformedBoxCorners(transform, box));
}

/**
 * 判断一个变换后的 Box2 是否与轴对齐 Box2 相交。
 *
 * 使用分离轴判定而不是仅比较轴对齐包围盒，避免旋转元素在实际四边形未接触选区时被误选。
 * 边界接触也视为相交。
 * @param transform Box2 到视图坐标的变换
 * @param target 视图坐标下的轴对齐 Box2
 * @param box 待变换的 Box2
 * @returns 两个区域是否相交
 */
export function transformedBoxIntersectsBox (
  transform: Matrix3,
  target: Box2,
  box: Box2 = UNIT_BOX,
): boolean {
  if (box.isEmpty() || target.isEmpty()) {
    return false;
  }

  const transformedCorners = getTransformedBoxCorners(transform, box);
  const targetCorners = getBoxCorners(target);
  const axes = [transformedCorners, targetCorners].reduce<Vector2[]>(
    (result, corners) => result.concat(corners.map((point, index) => {
      const next = corners[(index + 1) % corners.length];

      return new Vector2(-(next.y - point.y), next.x - point.x);
    })),
    [],
  );

  return axes.every(axis => {
    const transformedProjection = transformedCorners.map(point => point.dot(axis));
    const targetProjection = targetCorners.map(point => point.dot(axis));

    return Math.max(...transformedProjection) >= Math.min(...targetProjection)
      && Math.max(...targetProjection) >= Math.min(...transformedProjection);
  });
}

/** 通过逆变换判断视图点是否位于 Box2 内。 */
export function transformedBoxContainsPoint (transform: Matrix3, point: Vector2, box: Box2 = UNIT_BOX): boolean {
  return box.containsPoint(inverseTransformBoxPoint(transform, point));
}

/**
 * 绕指定中心旋转 Box2 四角。
 * @param points 原始四角
 * @param angle 旋转弧度
 * @param center 旋转中心
 * @returns 旋转后的四角
 */
function rotateBoxCorners (points: Vector2[], angle: number, center: Vector2): Vector2[] {
  return points.map(point => point.clone().rotateAround(center, angle));
}

/**
 * 使用点集更新 Box2 的轴对齐范围。
 * @param box 目标包围盒
 * @param points 点集
 * @returns 目标包围盒
 */
export function setBoxFromPoints (box: Box2, points: Vector2[]): Box2 {
  if (points.length === 0) {
    return box.makeEmpty();
  }

  const min = points[0].clone();
  const max = points[0].clone();

  points.forEach(point => {
    min.min(point);
    max.max(point);
  });

  return box.set(min, max);
}

/**
 * 以指定锚点缩放 Box2。
 * @param box 目标包围盒
 * @param scalar 缩放比例
 * @param anchor 缩放中心，默认使用包围盒中心
 * @returns 目标包围盒
 */
export function scaleBox (box: Box2, scalar: number | Vector2, anchor: Vector2 = box.getCenter()): Box2 {
  if (box.isEmpty()) {
    return box;
  }
  const resultScalar = typeof scalar === 'number'
    ? new Vector2(scalar, scalar)
    : new Vector2(scalar.x, scalar.y);

  return setBoxFromPoints(box, [box.min, box.max].map(point => (
    point.clone().subtract(anchor).multiply(resultScalar).add(anchor)
  )));
}

/**
 * 计算 Box2 绕指定中心旋转后的轴对齐范围。
 * @param box 目标包围盒
 * @param angle 旋转角度（弧度）
 * @param center 旋转中心，默认使用包围盒中心
 * @returns 目标包围盒
 */
export function rotateBox (box: Box2, angle: number, center: Vector2 = box.getCenter()): Box2 {
  if (box.isEmpty()) {
    return box;
  }

  return setBoxFromPoints(box, rotateBoxCorners(getBoxCorners(box), angle, center));
}

/**
 * 计算二维向量相对原点的极角（弧度）。
 * @param vector 二维向量
 * @returns 弧度值
 */
export function getVector2Angle (vector: Vector2) {
  const angle = Math.atan2(-vector.y, -vector.x) + Math.PI;

  return angle;
}

/**
 * 计算由两个二维向量所成夹角（带方向，弧度）
 * @param vector1 起始向量
 * @param vector2 目标向量
 * @returns 带符号夹角弧度值
 */
export function getAngleByVectors (vector1: Vector2, vector2: Vector2) {
  const cosValue = Math.min(
    Math.max(
      vector1.dot(vector2) / vector1.length() / vector2.length(),
      -1,
    ),
    1,
  );
  let angle = Math.acos(cosValue);

  angle = vector1.x * vector2.y - vector1.y * vector2.x > 0 ? angle : -angle;

  return angle;
}

/**
 * 将归一化包围盒按原包围盒范围还原为实际包围盒
 * @param origin 原始范围包围盒
 * @param normalize 归一化包围盒
 * @returns 还原后的实际包围盒
 */
export function getBoxByNormalizeBox (origin: Box2, normalize: Box2) {
  const result = new Box2();
  const { min: originMin, max: originMax } = origin;
  const { min: normalizeMin, max: normalizeMax } = normalize;
  const min = originMin.clone().add(new Vector2().subtractVectors(originMax, originMin).multiply(normalizeMin));
  const max = originMin.clone().add(new Vector2().subtractVectors(originMax, originMin).multiply(normalizeMax));

  result.set(min, max);

  return result;
}

/**
 * 将当前包围盒在原始范围内的位置归一化为 0~1 包围盒
 * @param origin 原始范围包围盒
 * @param current 当前包围盒
 * @returns 归一化包围盒
 */
export function getNormalizeBoxByBoxes (origin: Box2, current: Box2) {
  const result = new Box2();
  const { min: originMin, max: originMax } = origin;
  const { min: currentMin, max: currentMax } = current;
  const min = new Vector2().subtractVectors(currentMin, originMin).divide(new Vector2().subtractVectors(originMax, originMin));
  const max = new Vector2().subtractVectors(currentMax, originMin).divide(new Vector2().subtractVectors(originMax, originMin));

  result.set(min, max);

  return result;
}
