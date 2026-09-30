/** 内置 Gizmo 的稳定类型标识。 */
export enum GizmoType {
  /** 空类型。 */
  NULL = 'null',
  /** 视口平移工具。 */
  HAND = 'hand',
  /** 选区切换工具。 */
  CHANGE_SELECTION = 'change-selection',
  /** 选区移动工具。 */
  MOVE_SELECTION = 'move-selection',
  /** 框选工具。 */
  BOX_SELECTION = 'box-selection',
  /** 点击与拖拽仲裁工具。 */
  CLICK_DRAG_MULTIPLEX = 'click-drag-multiplex',
  /** 角点旋转工具。 */
  CORNER_ROTATION = 'corner-rotation',
  /** 选区缩放工具。 */
  RESIZE_SELECTION = 'resize-selection',
  /** 视口覆盖层。 */
  VIEWPORT_OVERLAY = 'viewport-overlay',
  /** 图片裁切工具。 */
  IMAGE_CUT = 'image-cut',
  /** 文本编辑工具。 */
  TEXT = 'text',
  /** 蒙版编辑工具。 */
  MASK = 'mask',
  /** 加载状态工具。 */
  LOADING = 'loading',
  /** 图片扩边工具。 */
  IMAGE_EXPAND = 'image-expand',
  /** 精准文字编辑工具。 */
  SPRITE_TEXT_EDIT = 'sprite-text-edit',
  /** 媒体图标工具。 */
  ICON = 'icon',
  /** 元素创建工具。 */
  ITEM_CREATE = 'item-create',
}
