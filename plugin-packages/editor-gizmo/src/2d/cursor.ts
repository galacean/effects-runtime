/** Gizmo 提交给宿主的光标样式。 */
export type GestureCursorResult = {
  /** 光标类型。 */
  type: GestureCursorType,
  /** 光标旋转角度。 */
  angle: number,
  /** 圆形光标半径。 */
  radius?: number,
};

/** 内置光标类型。 */
export enum GestureCursorType {
  /** 默认光标。 */
  NORMAL = 'normal',
  /** 旋转光标。 */
  ROTATION = 'rotation',
  /** 缩放光标。 */
  SCALE = 'scale',
  /** 文本旋转光标。 */
  TEXT_ROTATION = 'text-rotation',
  /** 圆形画笔光标。 */
  CIRCLE = 'circle',
  /** 可抓取手形光标。 */
  HAND = 'hand',
  /** 抓取中的手形光标。 */
  ACTIVE_HAND = 'active-hand',
  /** 指针光标。 */
  POINTER = 'pointer',
  /** 文本编辑光标。 */
  TEXT = 'text',
  /** 文本创建光标。 */
  TEXT_CREATE = 'text-create',
  /** 画板创建光标。 */
  FRAME_CREATE = 'frame-create',
  /** 框选十字光标。 */
  BOX_SELECT = 'box-select',
}
