import {
  MouseButton,
  spec,
  type InputEventMouseButton,
  type InputEventMouseMotion,
  type VFXItem,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import { Box2 } from '@galacean/effects-math/es/extension/index';
import { Vector2, getTransformedBoxCorners, transformedBoxIntersectsBox } from '../math';
import { drawBox, fillBox, toColor } from '../drawing';
import { getFramePlayerItemAncestors, getItemViewTransform, isFramePlayerItem, isPlayerItemVisible } from '../items';
import type { SelectionPreviewConfig } from '../configs/types';
import { selectionPreviewConfig } from '../configs/builtin-configs';

/** 框选区域的绘制状态。 */
type SelectionOverlay = {
  /** 当前绘制内容。 */
  type: 'none' | 'region',
  /** 框选区域。 */
  box: Box2,
};

/** 通过拖拽矩形更新选区并绘制框选区域。 */
export class BoxSelectionGizmo extends Gizmo {
  readonly type = 'box-selection';
  private readonly overlay: SelectionOverlay = { type: 'none', box: new Box2() };
  private readonly cursorPoint = new Vector2();
  private readonly startPoint = new Vector2();
  private isBoxSelecting = false;
  private mouseGrabbed = false;

  /**
   * 创建框选交互。
   * @param owner Gizmo 宿主。
   * @param deferToHitTarget 命中已有对象时是否将交互让给其他候选。
   */
  constructor (
    owner: GizmoOwner,
    private readonly deferToHitTarget = true,
  ) {
    super(owner);
  }

  /** 框选预览配置。 */
  get config (): Readonly<SelectionPreviewConfig> {
    return this._owner.getConfigManager().get(selectionPreviewConfig);
  }

  /** 当前选区。 */
  private get selection () {
    return this._owner.getSelection();
  }

  /**
   * 忽略尚未进入拖拽阶段的移动事件。
   * @param _event 鼠标移动事件。
   */
  override onMouseMove (_event: InputEventMouseMotion): void {
    // 框选仅在拖拽阶段更新。
  }

  /**
   * 更新已开始的框选交互。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.mouseGrabbed) {
      return;
    }
    if (this.isBoxSelecting) {
      this.updateGrab(event);
    } else {
      event.accept();
    }
  }

  /**
   * 在空白区域按下主键时开始框选。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }

    const regionIds = this.selection.filterSelectedItems(
      this.selection.hitTest(new Vector2(event.position.x, event.position.y)),
    );

    if (this.deferToHitTarget && regionIds.length > 0) {
      return;
    }

    if (!event.shiftPressed) {
      this.selection.commitSelectedItems([]);
    }
    this.startPoint.copyFrom(event.position);
    this.cursorPoint.set(event.position.x, event.position.y);
    this.isBoxSelecting = true;

    this.mouseGrabbed = true;
    this._owner.emit('actionstart', {
      source: this,
      selectedIds: [...this.selection.getSelectedIds()],
    });
    event.accept();
  }

  /**
   * 结束框选并提交选择变更。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.mouseGrabbed) {
      return;
    }
    const wasBoxSelecting = this.isBoxSelecting;

    this.mouseGrabbed = false;
    this.isBoxSelecting = false;
    this.overlay.type = 'none';

    this.emitMouseUpIfChanged(wasBoxSelecting);
    event.accept();
  }

  /**
   * 绘制当前框选区域。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    const config = this.config;

    if (this.isBoxSelecting && this.overlay.type === 'region' && !this.overlay.box.isEmpty()) {
      drawBox(control, this.overlay.box, toColor(config.regionWireframeColor, config.regionWireframeAlpha), config.regionWireframeWidth);
      fillBox(control, this.overlay.box, toColor(config.regionBoxColor, config.regionBoxAlpha));
    }
  }

  /**
   * 根据当前指针更新框选区域与候选选区。
   * @param event 鼠标拖拽事件。
   */
  private updateGrab (event: InputEventMouseMotion): void {
    if (!this.isBoxSelecting) {
      return;
    }

    // 步骤 1：计算并保存当前框选矩形。
    const endPoint = new Vector2().addVectors(
      this.cursorPoint,
      new Vector2().subtractVectors(new Vector2(event.position.x, event.position.y), this.startPoint),
    );
    const size = new Vector2().subtractVectors(this.cursorPoint, endPoint);
    const center = new Vector2().addVectors(this.cursorPoint, endPoint).multiply(0.5);

    size.x = Math.abs(size.x);
    size.y = Math.abs(size.y);
    const box = new Box2().setFromCenterAndSize(center, size);

    this.overlay.type = 'region';
    this.overlay.box = box;

    // 步骤 2：收集与框选矩形接触的可选对象
    const candidates: string[] = [];

    if (size.length() > 0) {
      const composition = this._owner.getEngine().sceneServer.compositions[0];
      const selectableItems = new Map<string, VFXItem>();

      // GE Composition.items 已是 sceneRoot 的全量后代，不再额外递归 children。
      if (composition) {
        for (const item of composition.items) {
          if (!isPlayerItemVisible(item)) {
            continue;
          }
          // 默认归并 Effects 子树；进入 EffectsEditMode 后只展开当前特效内部元素。
          const selectableItem = this.selection.resolveMarqueeSelectableItem(item);

          if (!selectableItem) {
            continue;
          }
          selectableItems.set(selectableItem.getInstanceId(), selectableItem);
        }
      }

      const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
      const itemTransforms = new Map<string, ReturnType<typeof getItemViewTransform>>();
      const containedFrameIds = new Set<string>();

      // Frame 只在被框选区域完整包住时才入选。
      for (const item of selectableItems.values()) {
        if (this.selection.ignoreIds.includes(item.getInstanceId()) || this.selection.ignoreNames.includes(item.name) || item.type === spec.ItemType.composition) {
          continue;
        }
        const id = item.getInstanceId();
        const transform = getItemViewTransform(item, containerSize);

        itemTransforms.set(id, transform);
        if (transform && isFramePlayerItem(item) && getTransformedBoxCorners(transform).every(point => box.containsPoint(point))) {
          containedFrameIds.add(id);
        }
      }

      for (const item of selectableItems.values()) {
        const id = item.getInstanceId();
        const transform = itemTransforms.get(id);

        if (!transform) {
          continue;
        }

        const frameAncestors = getFramePlayerItemAncestors(item);

        // 整个 Frame 入选时只保留 Frame，不再同时选中其后代。
        if (frameAncestors.some(frame => containedFrameIds.has(frame.getInstanceId()))) {
          continue;
        }
        if (isFramePlayerItem(item)) {
          if (containedFrameIds.has(id)) {
            candidates.push(id);
          }
          continue;
        }
        if (!transformedBoxIntersectsBox(transform, box)) {
          continue;
        }

        // Frame 以外被裁剪的子元素不参与框选；框选区域进入 Frame 后即可选内部元素。
        const intersectsEveryFrame = frameAncestors.every(frame => {
          const frameTransform = itemTransforms.get(frame.getInstanceId());

          return !!frameTransform && transformedBoxIntersectsBox(frameTransform, box);
        });

        if (intersectsEveryFrame) {
          candidates.push(id);
        }
      }
    }

    // 步骤 3：结合修饰键提交最终选区。
    const regionIds = this.selection.filterSelectedItems(candidates);
    const nextSelectedIds = event.shiftPressed
      ? Array.from(new Set([...this.selection.interactionStartSelectedIds, ...regionIds]))
      : regionIds;

    this.selection.commitSelectedItems(nextSelectedIds);
    event.accept();
  }

  /**
   * 在选区发生变化时提交操作事件。
   * @param force 是否强制提交。
   */
  private emitMouseUpIfChanged (force = false): void {
    if (!force && this.sameIds(this.selection.getSelectedIds(), this.selection.interactionStartSelectedIds)) {
      return;
    }
    this._owner.emit('actioncommit', {
      source: this,
      selectedIds: [...this.selection.getSelectedIds()],
      oldSelectedIds: [...this.selection.interactionStartSelectedIds],
    });
  }

  /**
   * 判断两个 ID 列表是否按顺序相等。
   * @param left 左侧 ID 列表。
   * @param right 右侧 ID 列表。
   * @returns 是否相等。
   */
  private sameIds (left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }
}
