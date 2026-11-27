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

/** 从四个视图角点建立归一化 Box2 到视图坐标的投影变换。 */
export function boxTransformFromCorners (points: Vector2[]): Matrix3 | undefined {
  if (points.length !== 4 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return undefined;
  }

  const [leftTop, rightTop, rightBottom, leftBottom] = points;
  const dx = leftTop.x - rightTop.x + rightBottom.x - leftBottom.x;
  const dy = leftTop.y - rightTop.y + rightBottom.y - leftBottom.y;
  let perspectiveX = 0;
  let perspectiveY = 0;

  // 绕 X/Y 轴旋转后的透视投影不再是平行四边形，需要保留第四个角点。
  if (Math.abs(dx) > MATRIX_EPSILON || Math.abs(dy) > MATRIX_EPSILON) {
    const topX = rightTop.x - rightBottom.x;
    const topY = rightTop.y - rightBottom.y;
    const leftX = leftBottom.x - rightBottom.x;
    const leftY = leftBottom.y - rightBottom.y;
    const denominator = topX * leftY - leftX * topY;

    if (Math.abs(denominator) <= MATRIX_EPSILON) {
      return undefined;
    }
    perspectiveX = (dx * leftY - leftX * dy) / denominator;
    perspectiveY = (topX * dy - dx * topY) / denominator;
  }
  // 齐次坐标在盒内不能为零或变号，否则投影会穿过无穷远点。
  if (Math.min(1 + perspectiveX, 1 + perspectiveY, 1 + perspectiveX + perspectiveY) <= MATRIX_EPSILON) {
    return undefined;
  }
  const transform = new Matrix3().setFromRowMajorData(
    rightTop.x - leftTop.x + perspectiveX * rightTop.x,
    leftBottom.x - leftTop.x + perspectiveY * leftBottom.x,
    leftTop.x,
    rightTop.y - leftTop.y + perspectiveX * rightTop.y,
    leftBottom.y - leftTop.y + perspectiveY * leftBottom.y,
    leftTop.y,
    perspectiveX,
    perspectiveY,
    1,
  );

  return transform.elements.every(Number.isFinite) ? transform : undefined;
}

/** 具有二维面积的选框可以将视图坐标反算到局部。 */
export function hasBoxArea (transform: Matrix3): boolean {
  const area = Math.abs(transform.determinant());

  return Number.isFinite(area) && area > MATRIX_EPSILON;
}

/** 从四个视图角点取得可逆的矩形变换。 */
export function getBoxTransform (points: Vector2[]): Matrix3 | undefined {
  if (points.length !== 4) {
    return undefined;
  }
  const transform = boxTransformFromCorners(points);

  return transform && hasBoxArea(transform) ? transform : undefined;
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

  return new Vector2(result.x / result.z, result.y / result.z);
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
  const [topLeft, topRight, bottomRight, bottomLeft] = transformedCorners;
  const minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
  const minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);
  const maxX = Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
  const maxY = Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);

  if (maxX < target.min.x || maxY < target.min.y || minX > target.max.x || minY > target.max.y) {
    return false;
  }
  if (minX >= target.min.x && minY >= target.min.y && maxX <= target.max.x && maxY <= target.max.y) {
    return true;
  }
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

/** 判断视图点是否落在选框内，也支持退化为线段或点的选框。 */
export function transformedBoxContainsPoint (transform: Matrix3, point: Vector2, box: Box2 = UNIT_BOX): boolean {
  if (!hasBoxArea(transform)) {
    // A straight path's zero-width or zero-height box has no inverse.
    return transformedBoxIntersectsBox(transform, new Box2(point, point), box);
  }

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
