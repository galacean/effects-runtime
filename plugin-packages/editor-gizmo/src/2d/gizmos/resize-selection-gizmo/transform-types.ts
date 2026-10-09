import type { Vector2, Vector3 } from '../../math';

/** 选区变换的语义类型；由移动、缩放与角旋转行为共同用于命令事务。 */
export enum TransformType {
  /** 无变换。 */
  NULL = 'null',
  /** 位移。 */
  TRANSLATION = 'translation',
  /** 旋转。 */
  ROTATION = 'rotation',
  /** 双轴缩放。 */
  SCALE = 'scale',
  /** 文本宽度缩放。 */
  WIDTH_SCALE = 'width-scale',
}

/** 选区缩放会话数据。 */
export type ScaleParam = {
  /** 变换中心。 */
  center: Vector3,
  /** 当前手柄位置。 */
  corner: Vector3,
  /** 指针相对位移。 */
  shift: Vector3,
  /** 上一帧缩放量。 */
  lastScalar: Vector3,
  /** 距中心最远的角点。 */
  farthestCorner: Vector2,
};
