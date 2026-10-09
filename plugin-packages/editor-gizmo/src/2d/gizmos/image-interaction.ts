import type { Box2 } from '@galacean/effects-math/es/extension/index';
import type { Vector2 } from '../math';

/** 图片裁切和扩边的交互类型。 */
export enum ImageInteractionType {
  /** 无交互。 */
  NONE = 'none',
  /** 角点双轴缩放。 */
  SCALE = 'scale',
  /** 边中点单轴缩放。 */
  DIRECTION_SCALE = 'direction-scale',
  /** 移动交互框。 */
  MOVE = 'move',
}

/** 无图片交互参数。 */
export type ImageNoneParam = {
  /** 交互类型。 */
  type: ImageInteractionType.NONE,
};

/** 图片单轴缩放参数。 */
export type ImageDirectionScaleParam = {
  /** 交互类型。 */
  type: ImageInteractionType.DIRECTION_SCALE,
  /** 交互开始时的归一化 Box2。 */
  box: Box2,
  /** 被拖拽边的索引。 */
  index: number,
  /** 交互开始时的归一化鼠标位置。 */
  startMouse: Vector2,
  /** 锁定的宽高比。 */
  lockedAspect?: number,
};

/** 图片交互框移动参数。 */
export type ImageMoveParam = {
  /** 交互类型。 */
  type: ImageInteractionType.MOVE,
  /** 交互开始时的归一化 Box2。 */
  box: Box2,
  /** 交互开始时的归一化鼠标位置。 */
  startMouse: Vector2,
};
