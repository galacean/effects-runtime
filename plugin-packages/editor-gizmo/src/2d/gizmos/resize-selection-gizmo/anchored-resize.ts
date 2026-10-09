import type { Matrix4 } from '../../math';
import { Vector3, isEqual } from '../../math';

/** 一次锚定缩放在 pointer down 时冻结的几何。 */
export type AnchoredResizeGeometry = {
  /** 初始被拖手柄位置（世界坐标）。 */
  initialHandle: Vector3,
  /** 始终保持不动的对边中点或对角点（世界坐标）。 */
  fixedPoint: Vector3,
  /** 属性变化实际围绕的原点（transform scale 用 anchor，内容 size 用几何中心）。 */
  resizeOrigin: Vector3,
  /** 世界向量到元素局部缩放轴的旋转矩阵（无平移）。 */
  worldToLocalRotation: Matrix4,
};

/** 锚定缩放约束。 */
export type AnchoredResizeOptions = {
  /** 边只控制一个轴；角点同时控制两个轴。 */
  handleKind: 'edge' | 'corner',
  /** 是否锁定宽高比。 */
  lockAspectRatio: boolean,
  /** 强制保持不变的局部缩放轴。 */
  lockedAxis?: 'x' | 'y',
};

/** 锚定缩放的绝对变换结果。 */
export type AnchoredResizeResult = {
  /** 相对 pointer down 快照的总缩放，而非相对上一帧的增量。 */
  totalScalar: Vector3,
  /** 相对 pointer down 快照的总世界位移。 */
  totalTranslation: Vector3,
};

/**
 * 由初始快照计算当前边或角点缩放的绝对结果。
 *
 * 当前指针决定“固定点 → 手柄”的有符号比例；属性绕其真实 resizeOrigin 变化，
 * 再反算位移使 fixedPoint 回到原坐标。
 * @param geometry 交互开始时冻结的几何
 * @param pointer 当前指针世界坐标
 * @param options 手柄类型和比例约束
 * @returns 相对交互起点的绝对缩放和位移
 */
export function calculateAnchoredResize (
  geometry: AnchoredResizeGeometry,
  pointer: Vector3,
  options: AnchoredResizeOptions,
): AnchoredResizeResult {
  // 1. 将初始手柄和当前指针转换到元素局部缩放轴。
  const { initialHandle, fixedPoint, resizeOrigin, worldToLocalRotation } = geometry;
  const { handleKind, lockAspectRatio, lockedAxis } = options;
  const initialVector = new Vector3().subtractVectors(initialHandle, fixedPoint).applyMatrix(worldToLocalRotation);
  const pointerVector = new Vector3().subtractVectors(pointer, fixedPoint).applyMatrix(worldToLocalRotation);
  let totalScalar: Vector3;

  // 2. 根据边或角点计算各轴总缩放量。
  if (handleKind === 'edge') {
    const axisIndex: 0 | 1 = Math.abs(initialVector.x) >= Math.abs(initialVector.y) ? 0 : 1;
    const initialLength = initialVector.toArray()[axisIndex];
    const pointerLength = pointerVector.toArray()[axisIndex];
    const primaryScalar = isEqual(initialLength, 0)
      ? 1
      : pointerLength / initialLength;

    totalScalar = lockAspectRatio
      ? axisIndex === 0
        ? new Vector3(primaryScalar, Math.abs(primaryScalar), Math.abs(primaryScalar))
        : new Vector3(Math.abs(primaryScalar), primaryScalar, Math.abs(primaryScalar))
      : axisIndex === 0
        ? new Vector3(primaryScalar, 1, 1)
        : new Vector3(1, primaryScalar, 1);
  } else {
    const scaleX = isEqual(initialVector.x, 0) ? 1 : pointerVector.x / initialVector.x;
    const scaleY = isEqual(initialVector.y, 0) ? 1 : pointerVector.y / initialVector.y;

    totalScalar = new Vector3(scaleX, scaleY, 1);
    if (lockAspectRatio) {
      if (Math.abs(scaleX) > Math.abs(scaleY)) {
        totalScalar.y = Math.abs(scaleX) * (scaleY < 0 ? -1 : 1);
      } else {
        totalScalar.x = Math.abs(scaleY) * (scaleX < 0 ? -1 : 1);
      }
      totalScalar.z = Math.max(Math.abs(totalScalar.x), Math.abs(totalScalar.y));
    }
  }

  if (lockedAxis === 'x') {
    totalScalar.x = 1;
  } else if (lockedAxis === 'y') {
    totalScalar.y = 1;
  }

  // 3. 反算固定点缩放后的偏移，得到位置补偿量。
  const fixedOffsetLocal = new Vector3()
    .subtractVectors(fixedPoint, resizeOrigin)
    .applyMatrix(worldToLocalRotation)
    .multiply(totalScalar);
  const scaledFixedPoint = resizeOrigin.clone().add(
    fixedOffsetLocal.applyMatrix(worldToLocalRotation.clone().invert()),
  );

  return {
    totalScalar,
    totalTranslation: fixedPoint.clone().subtract(scaledFixedPoint),
  };
}
