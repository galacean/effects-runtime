import { type Engine, type VFXItem } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import type { GizmoOwner } from '../gizmo-owner';
import { drawCorners, toColor } from '../drawing';
import {
  getItemChildren,
  getItemViewBox,
  getPlayerItemById,
  isEffectsPlayerItem,
  isFramePlayerItem,
  isGroupPlayerItem,
} from '../items';
import {
  calculateAutoLayoutIndicatorLine,
  calculateAutoLayoutPositionByMouse,
  calculateInsertPositionFromLayout,
  type AutoLayoutIndicator,
} from './layout-calculations';
import { FrameLayoutMode, type FrameInfo } from './types';
import type { Box2 } from '@galacean/effects-math/es/extension/index';
import { Line2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getBoxCorners } from '../math';
import { GizmoViewportUtils } from '../viewport';

/** 选区拖拽产生的层级位置变更。 */
export type SelectionPlacementChange =
  | {
    /** 移入画板。 */
    type: 'moveIn',
    /** 待移入元素 ID。 */
    itemIds: string[],
    /** 目标画板 ID。 */
    targetFrameId: string,
  }
  | {
    /** 移出画板。 */
    type: 'moveOut',
    /** 待移出元素 ID。 */
    itemIds: string[],
    /** 原画板 ID。 */
    originalFrameId: string,
  }
  | {
    /** 子元素脱离组合。 */
    type: 'detachGroupChildren',
    /** 原组合 ID。 */
    groupId: string,
    /** 待脱离的子元素 ID。 */
    itemIds: string[],
    /** 原画板 ID。 */
    originalFrameId: string,
  };

/** 自动布局重排的起止位置。 */
export type AutoLayoutChangeInfo = {
  /** 画板 ID。 */
  frameId: string,
  /** 被拖拽元素 ID。 */
  draggedItemId: string,
  /** 原行号。 */
  fromRow: number,
  /** 原列号。 */
  fromColumn: number,
  /** 目标行号。 */
  toRow: number,
  /** 目标列号。 */
  toColumn: number,
};

/** 辅助布局交互的提交结果。 */
export type AssistedLayoutFinishResult = {
  /** 层级位置变更。 */
  placementChanges: SelectionPlacementChange[],
  /** 自动布局重排信息。 */
  autoLayoutChange?: AutoLayoutChangeInfo,
};

/** 自动布局中的兄弟元素信息。 */
type AutoLayoutSibling = {
  /** 元素 ID。 */
  id: string,
  /** 视图包围盒。 */
  box: Box2,
  /** 包围盒中心。 */
  center: Vector2,
  /** 包围盒中心 X 坐标。 */
  centerX: number,
  /** 当前布局位置。 */
  layoutInfo: {
    /** 行号。 */
    row: number,
    /** 列号。 */
    column: number,
  },
  /** 行号。 */
  row: number,
  /** 列号。 */
  column: number,
};

/** 待提交的组合子元素脱离信息。 */
type PendingGroupDetach = {
  /** 组合 ID。 */
  groupId: string,
  /** 目标画板 ID。 */
  frameId: string,
  /** 位于目标画板外的子元素 ID。 */
  childrenOutOfFrame: string[],
};

/** 计算选区拖拽期间的画板归属、自动布局位置和视觉提示。 */
export class AssistedLayout {
  private readonly owner: GizmoOwner;
  private readonly engine: Engine;
  private selectedItems: VFXItem[] = [];
  private readonly selectedFrameIds = new Set<string>();
  private readonly currentFrameIds = new Map<string, string | undefined>();
  private readonly pendingGroupDetaches = new Map<string, PendingGroupDetach>();
  private targetFrameId: string | undefined;
  private autoLayoutIndicator: AutoLayoutIndicator = null;
  private autoLayoutDragOriginalPosition: { row: number, column: number } | null = null;
  private autoLayoutDragFrameId: string | null = null;
  private autoLayoutDragItemId: string | null = null;
  private pendingLayoutPosition: { row: number, column: number } | null = null;

  /**
   * @param owner Gizmo 宿主
   */
  constructor (owner: GizmoOwner) {
    this.owner = owner;
    this.engine = owner.getEngine();
  }

  /**
   * 开始辅助布局会话并记录元素原画板。
   * @param selectedItems 当前选中元素
   */
  begin (selectedItems: readonly VFXItem[]): void {
    this.cancel();
    this.selectedItems = [...selectedItems];
    for (const item of selectedItems) {
      const id = item.getInstanceId();

      if (isFramePlayerItem(item)) {
        this.selectedFrameIds.add(id);
      }
      const frameId = this.owner.getFrameManager().getParentFrame(id)?.id;

      this.currentFrameIds.set(id, frameId);
    }
  }

  /**
   * 根据当前指针计算元素移入或移出画板的变更。
   * @param pointer 当前指针视图坐标
   * @returns 本帧需要应用的层级位置变更
   */
  resolveReparent (pointer: Vector2): SelectionPlacementChange[] {
    const frameManager = this.owner.getFrameManager();

    frameManager.updateViewBoxes();
    const frameInfos = frameManager.getViewInfos();
    const containerSize = GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!);
    const changes: SelectionPlacementChange[] = [];
    let lastTargetFrameId: string | undefined;

    for (const item of this.selectedItems) {
      const result = this.resolveItemReparent(item, pointer, frameInfos, containerSize);

      if (result.change) {
        changes.push(result.change);
      }
      if (result.targetFrameId !== undefined) {
        lastTargetFrameId = result.targetFrameId;
      }
    }
    this.targetFrameId = lastTargetFrameId;

    return changes;
  }

  /**
   * 更新自动布局目标位置和插入指示器。
   * @param pointer 当前指针视图坐标
   */
  updateAutoLayout (pointer: Vector2): void {
    // 1. 校验单选元素及指针所在的自动布局画板。
    const item = this.selectedItems.length === 1 ? this.selectedItems[0] : undefined;

    if (!item || isFramePlayerItem(item) || isEffectsPlayerItem(item)) {
      this.clearAutoLayoutVisualState();

      return;
    }

    const parentFrameInfo = this.owner.getFrameManager().findFrameAt(pointer);

    if (parentFrameInfo?.layoutMode !== FrameLayoutMode.AUTO) {
      this.clearAutoLayoutVisualState();

      return;
    }

    // 2. 首次进入画板时记录元素原始行列位置。
    const frameId = parentFrameInfo.id;
    const draggedItemId = item.getInstanceId();

    if (
      this.autoLayoutDragOriginalPosition === null
      || this.autoLayoutDragFrameId !== frameId
      || this.autoLayoutDragItemId !== draggedItemId
    ) {
      const originalLayoutInfo = parentFrameInfo.layoutInfos?.[draggedItemId];

      this.autoLayoutDragOriginalPosition = {
        row: originalLayoutInfo?.row ?? 0,
        column: originalLayoutInfo?.column ?? 0,
      };
      this.autoLayoutDragFrameId = frameId;
      this.autoLayoutDragItemId = draggedItemId;
    }

    // 3. 收集目标画板中其余可见兄弟元素的布局几何。
    const containerSize = GizmoViewportUtils.getContainerSize(this.engine.canvas.parentElement!);
    const composition = this.engine.sceneServer.compositions[0];
    const siblings = parentFrameInfo.children.reduce<AutoLayoutSibling[]>((result, childId) => {
      if (childId === draggedItemId) {
        return result;
      }
      const playerItem = getPlayerItemById(composition, childId);

      if (!playerItem) {
        return result;
      }
      const box = getItemViewBox(playerItem, containerSize);

      if (box.isEmpty()) {
        return result;
      }
      const layoutInfo = parentFrameInfo.layoutInfos?.[childId] ?? { row: 0, column: 0 };

      result.push({
        id: childId,
        box,
        center: box.getCenter(),
        centerX: box.getCenter().x,
        layoutInfo,
        row: layoutInfo.row,
        column: layoutInfo.column,
      });

      return result;
    }, []);

    // 4. 计算目标行列、插入索引和指示线。
    const layoutPosition = calculateAutoLayoutPositionByMouse(pointer, siblings);

    if (!layoutPosition) {
      this.autoLayoutIndicator = null;
      this.pendingLayoutPosition = null;

      return;
    }

    this.pendingLayoutPosition = { ...layoutPosition };
    const insertPosition = calculateInsertPositionFromLayout(
      pointer,
      siblings,
      parentFrameInfo.children,
      this.autoLayoutDragOriginalPosition.row,
    );
    const line = insertPosition.siblingId
      ? calculateAutoLayoutIndicatorLine(insertPosition)
      : this.createFallbackIndicatorLine(parentFrameInfo.box, layoutPosition);

    this.autoLayoutIndicator = {
      frameId,
      insertIndex: insertPosition.siblingId ? insertPosition.index : parentFrameInfo.children.length,
      insertDirection: insertPosition.siblingId ? insertPosition.direction : 'after',
      targetSiblingId: insertPosition.siblingId,
      line,
      targetRow: layoutPosition.row,
      targetColumn: layoutPosition.column,
    };
  }

  /** @returns 当前会话需要提交的层级和自动布局变更。 */
  finish (): AssistedLayoutFinishResult {
    const placementChanges: SelectionPlacementChange[] = [];

    for (const pending of this.pendingGroupDetaches.values()) {
      if (pending.childrenOutOfFrame.length > 0) {
        placementChanges.push({
          type: 'detachGroupChildren',
          groupId: pending.groupId,
          itemIds: [...pending.childrenOutOfFrame],
          originalFrameId: pending.frameId,
        });
      }
    }

    let autoLayoutChange: AutoLayoutChangeInfo | undefined;

    if (
      this.autoLayoutDragFrameId
      && this.autoLayoutDragItemId
      && this.autoLayoutDragOriginalPosition
      && this.pendingLayoutPosition
    ) {
      autoLayoutChange = {
        frameId: this.autoLayoutDragFrameId,
        draggedItemId: this.autoLayoutDragItemId,
        fromRow: this.autoLayoutDragOriginalPosition.row,
        fromColumn: this.autoLayoutDragOriginalPosition.column,
        toRow: this.pendingLayoutPosition.row,
        toColumn: this.pendingLayoutPosition.column,
      };
    }

    return { placementChanges, autoLayoutChange };
  }

  /**
   * 绘制目标画板和自动布局插入指示器。
   * @param control 绘制控制器
   */
  draw (control: Control): void {
    if (this.targetFrameId) {
      const targetFrameInfo = this.owner.getFrameManager().getViewInfo(this.targetFrameId);

      if (targetFrameInfo?.box && !targetFrameInfo.box.isEmpty()) {
        drawCorners(control, getBoxCorners(targetFrameInfo.box), toColor(0xFF0000, 1), 1);
      }
    }

    const indicator = this.autoLayoutIndicator;

    if (!indicator || indicator.line.distanceSq() === 0) {
      return;
    }
    const lineColor = toColor(0x3b82f6, 1);
    const { start, end } = indicator.line;

    control.drawLine(start.x, start.y, end.x, end.y, lineColor, 2);
    control.fillCircle(start.x, start.y, 3, lineColor);
    control.fillCircle(end.x, end.y, 3, lineColor);
  }

  /** 取消会话并清空全部辅助布局状态。 */
  cancel (): void {
    this.selectedItems = [];
    this.selectedFrameIds.clear();
    this.currentFrameIds.clear();
    this.pendingGroupDetaches.clear();
    this.targetFrameId = undefined;
    this.clearAutoLayoutState();
  }

  /**
   * 计算单个元素相对画板的层级位置变更。
   * @param item 被拖拽元素
   * @param pointer 当前指针视图坐标
   * @param frameInfos 当前画板视图信息
   * @param containerSize 画布容器尺寸
   * @returns 目标画板和可选的层级位置变更
   */
  private resolveItemReparent (
    item: VFXItem,
    pointer: Vector2,
    frameInfos: readonly FrameInfo[],
    containerSize: Vector2,
  ): { targetFrameId?: string, change?: SelectionPlacementChange } {
    // 1. 排除不能移入画板的元素，并解析原画板与目标画板。
    if (isFramePlayerItem(item) || isEffectsPlayerItem(item)) {
      return {};
    }

    const itemId = item.getInstanceId();
    const currentFrameId = this.currentFrameIds.get(itemId);
    const currentFrame = frameInfos.find(frame => frame.id === currentFrameId);
    // 被选中的 Frame 会和其他选中项一起移动，不能再作为这些元素的放置容器。
    const targetFrame = frameInfos.find(frame => (
      !this.selectedFrameIds.has(frame.id) && frame.box.containsPoint(pointer)
    ));

    // 2. 指针离开原画板时生成移出变更。
    if (!targetFrame && currentFrame) {
      const itemIds = [itemId];

      if (isGroupPlayerItem(item)) {
        itemIds.push(...getItemChildren(item).map(child => child.getInstanceId()));
      }
      this.pendingGroupDetaches.delete(itemId);
      this.currentFrameIds.set(itemId, undefined);

      return {
        change: {
          type: 'moveOut',
          itemIds,
          originalFrameId: currentFrame.id,
        },
      };
    }

    if (!targetFrame || currentFrame?.id === targetFrame.id) {
      return { targetFrameId: targetFrame?.id };
    }

    // 3. 移入新画板时检查组合子元素与目标画板的相交关系。
    const itemIds = [itemId];

    if (isGroupPlayerItem(item)) {
      const children = getItemChildren(item);

      itemIds.push(...children.map(child => child.getInstanceId()));
      if (children.length > 0) {
        const childrenInFrame: string[] = [];
        const childrenOutOfFrame: string[] = [];

        for (const child of children) {
          const childBox = getItemViewBox(child, containerSize);

          if (!childBox.isEmpty() && targetFrame.box.intersectsBox(childBox)) {
            childrenInFrame.push(child.getInstanceId());
          } else {
            childrenOutOfFrame.push(child.getInstanceId());
          }
        }
        if (childrenInFrame.length === 0) {
          this.pendingGroupDetaches.delete(itemId);

          return {};
        }
        if (childrenOutOfFrame.length > 0) {
          this.pendingGroupDetaches.set(itemId, {
            groupId: itemId,
            frameId: targetFrame.id,
            childrenOutOfFrame,
          });
        } else {
          this.pendingGroupDetaches.delete(itemId);
        }
      }
    }

    // 4. 记录新画板并生成移入变更。
    this.currentFrameIds.set(itemId, targetFrame.id);

    return {
      targetFrameId: targetFrame.id,
      change: {
        type: 'moveIn',
        itemIds,
        targetFrameId: targetFrame.id,
      },
    };
  }

  /** 清空自动布局指示器和待提交位置。 */
  private clearAutoLayoutVisualState (): void {
    this.autoLayoutIndicator = null;
    this.pendingLayoutPosition = null;
  }

  /** 清空自动布局会话状态。 */
  private clearAutoLayoutState (): void {
    this.clearAutoLayoutVisualState();
    this.autoLayoutDragOriginalPosition = null;
    this.autoLayoutDragFrameId = null;
    this.autoLayoutDragItemId = null;
  }

  /**
   * 为没有参考元素的位置创建画板边缘指示线。
   * @param frameBox 画板视图包围盒
   * @param layoutPosition 目标行列位置
   * @returns 插入指示线
   */
  private createFallbackIndicatorLine (
    frameBox: Box2,
    layoutPosition: { row: number, column: number },
  ): Line2 {
    if (frameBox.isEmpty()) {
      return new Line2();
    }
    const inset = 10;
    const minX = Math.min(frameBox.min.x + inset, frameBox.max.x);
    const maxX = Math.max(frameBox.max.x - inset, frameBox.min.x);
    const minY = Math.min(frameBox.min.y + inset, frameBox.max.y);
    const maxY = Math.max(frameBox.max.y - inset, frameBox.min.y);

    if (layoutPosition.row < 0) {
      return new Line2(new Vector2(minX, minY), new Vector2(maxX, minY));
    }
    if (layoutPosition.row > 0 && layoutPosition.column === 0) {
      return new Line2(new Vector2(minX, maxY), new Vector2(maxX, maxY));
    }
    const x = layoutPosition.column <= 0 ? minX : maxX;

    return new Line2(new Vector2(x, minY), new Vector2(x, maxY));
  }
}
