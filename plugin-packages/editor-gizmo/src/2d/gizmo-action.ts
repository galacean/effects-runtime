import type { RichTextInputPayload } from './rich-text/rich-text-edit-session';
import type { Gizmo } from './gizmo';
import type { ShapeDrawingActionEvent } from './gizmos/shape/geometry';
import type { FrameCreateData, ItemCreateType, TextCreateData } from './gizmos/item-create-gizmo';
import type { AutoLayoutChangeInfo } from './frame/frame-assisted-layout';
import type { TransformType } from './gizmos/resize-selection-gizmo/transform-types';
import type { RulerActionEvent } from './gizmos/ruler-gizmo';
import type { CurveActionEvent } from './gizmos/curve-gizmo';
import type { GradientActionEvent, GradientSelectionEvent } from './gizmos/gradient-gizmo';
import type { CrystalLatticeActionEvent } from './gizmos/crystal-lattice-gizmo';
import type { InputEventKey, VFXItem } from '@galacean/effects';

/** Gizmo 操作的生命周期阶段。 */
export type GizmoActionPhase = 'actionstart' | 'actionupdate' | 'actioncommit';

/** 画板元素创建信息。 */
export type GizmoFrameItemCreateInfo = {
  /** 创建类型。 */
  type: ItemCreateType.FRAME,
  /** 新元素 ID。 */
  id: string,
  /** 元素创建位置。 */
  position: [number, number],
  /** 画板创建参数。 */
  info: FrameCreateData,
};

/** 文本元素创建信息。 */
export type GizmoTextItemCreateInfo = {
  /** 创建类型。 */
  type: ItemCreateType.TEXT,
  /** 新元素 ID。 */
  id: string,
  /** 元素创建位置。 */
  position: [number, number],
  /** 文本创建参数。 */
  info?: TextCreateData,
};

/** 富文本元素创建信息。 */
export type GizmoRichTextItemCreateInfo = {
  type: ItemCreateType.RICH_TEXT,
  id: string,
  position: [number, number],
  info?: TextCreateData,
};

/** 无附加参数的元素创建信息。 */
export type GizmoSimpleItemCreateInfo = {
  /** 创建类型。 */
  type: ItemCreateType.IMAGE_GENERATOR | ItemCreateType.VIDEO_GENERATOR | ItemCreateType.NONE,
  /** 新元素 ID。 */
  id: string,
  /** 元素创建位置。 */
  position: [number, number],
  /** 简单元素不携带附加参数。 */
  info?: undefined,
};

/** 按创建类型区分的元素创建信息。 */
export type GizmoItemCreateInfo =
  | GizmoFrameItemCreateInfo
  | GizmoTextItemCreateInfo
  | GizmoRichTextItemCreateInfo
  | GizmoSimpleItemCreateInfo;

/** 所有 Gizmo 业务操作共享的基础事件。 */
export interface GizmoActionEvent {
  /** 触发事件的 Gizmo。 */
  source: Gizmo,
  /** 本次预览已经恢复起始数据；通过 actionupdate 通知，不产生提交。 */
  canceled?: boolean,
}

/** 选区变换事件。 */
export interface GizmoTransformActionEvent extends GizmoActionEvent {
  /** 变换类型。 */
  transformType: TransformType,
  /** 本次拖拽实际执行的类型。仅切换修饰键不计入；transformType 为 MIXED 时包含多项。 */
  transformTypes?: TransformType[],
  /** 本次直接变换的顶层元素 ID。 */
  itemIds?: string[],
  /** 自动布局产生的附加变更。 */
  autoLayoutChange?: AutoLayoutChangeInfo,
}

/** 选区变更事件。 */
export interface GizmoSelectionActionEvent extends GizmoActionEvent {
  /** 变更后的选中元素 ID。 */
  selectedIds: string[],
  /** 变更前的选中元素 ID。 */
  oldSelectedIds?: string[],
}

/** 元素创建事件。 */
export interface GizmoItemCreateActionEvent extends GizmoActionEvent {
  /** 元素创建信息。 */
  createInfo: GizmoItemCreateInfo,
  /** 是否取消本次创建。 */
  canceled?: boolean,
}

/** 元素移入画板事件。 */
export interface GizmoMoveInEvent extends GizmoActionEvent {
  /** 事件类型。 */
  type: 'moveIn',
  /** 待移入的元素 ID。 */
  itemIds: string[],
  /** 目标画板 ID。 */
  targetFrameId: string,
}

/** 元素移出画板事件。 */
export interface GizmoMoveOutEvent extends GizmoActionEvent {
  /** 事件类型。 */
  type: 'moveOut',
  /** 待移出的元素 ID。 */
  itemIds: string[],
  /** 原画板 ID。 */
  originalFrameId: string,
}

/** 子元素脱离组合事件。 */
export interface GizmoDetachGroupChildrenEvent extends GizmoActionEvent {
  /** 事件类型。 */
  type: 'detachGroupChildren',
  /** 原组合 ID。 */
  groupId: string,
  /** 待脱离的子元素 ID。 */
  itemIds: string[],
  /** 原画板 ID。 */
  originalFrameId: string,
}

/** 元素层级位置变更事件。 */
export type GizmoPlacementChangeEvent =
  | GizmoMoveInEvent
  | GizmoMoveOutEvent
  | GizmoDetachGroupChildrenEvent;

/** 请求刷新画板子元素的事件。 */
export interface GizmoFrameRefreshChildrenEvent extends GizmoActionEvent {
  /** 目标画板 ID。 */
  frameId: string,
}

/** 文本输入事件。 */
export interface GizmoTextInputEvent extends GizmoActionEvent {
  /** 文本元素 ID。 */
  itemId: string,
  /** 输入后的文本。 */
  text: string,
  /** 文本字体。 */
  fontFamily: string,
}

/** 富文本输入事件，独立提供源码和可见文字。 */
export interface GizmoRichTextInputEvent extends GizmoActionEvent, RichTextInputPayload {}

/** 视频播放位置变更事件。 */
export interface GizmoVideoPlayEvent extends GizmoActionEvent {
  /** 视频元素 ID。 */
  id: string,
  /** 播放时间。 */
  time: number,
}

/** 精准文字点击事件。 */
export interface GizmoSpriteTextClickEvent extends GizmoActionEvent {
  /** 命中的文字信息。 */
  info?: {
    /** 文字元素 ID。 */
    id: string,
    /** 命中的字符索引。 */
    index: number,
    /** 命中的文本内容。 */
    text: string,
  },
}

/** 可进入操作生命周期的 Gizmo 事件。 */
export type GizmoActionLifecycleEvent =
  | GizmoActionEvent
  | CurveActionEvent
  | GradientActionEvent
  | CrystalLatticeActionEvent
  | GizmoTransformActionEvent
  | GizmoSelectionActionEvent
  | GizmoItemCreateActionEvent
  | RulerActionEvent
  | ShapeDrawingActionEvent;

/** GizmoOwner 发出的事件及其参数。 */
export type GizmoOwnerEvents = {
  /** 键盘按下事件。 */
  keyDown: [InputEventKey],
  /** 键盘抬起事件。 */
  keyUp: [InputEventKey],
  /** 操作开始事件。 */
  actionstart: [GizmoActionLifecycleEvent],
  /** 操作更新事件。 */
  actionupdate: [GizmoActionLifecycleEvent],
  /** 操作提交事件。 */
  actioncommit: [GizmoActionLifecycleEvent],
  /** 渐变色标选中索引或位置百分比变化。 */
  gradientselectionchange: [GradientSelectionEvent],
  /** 元素层级位置变更事件。 */
  placementchange: [GizmoPlacementChangeEvent],
  /** 画板子元素刷新事件。 */
  framerefreshchildren: [GizmoFrameRefreshChildrenEvent],
  /** 文本输入事件。 */
  textinput: [GizmoTextInputEvent],
  /** 富文本输入或局部格式变更事件。 */
  richtextinput: [GizmoRichTextInputEvent],
  /** 视频播放事件。 */
  videoplay: [GizmoVideoPlayEvent],
  /** 精准文字点击事件。 */
  spritetextclick: [GizmoSpriteTextClickEvent],
  /** 自定义形状输入。 */
  shapeinput: [VFXItem],
};
