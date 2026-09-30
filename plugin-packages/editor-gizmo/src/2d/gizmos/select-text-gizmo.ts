import {
  MouseButton,
  MouseButtonMask,
  spec,
  TextComponent,
  type InputEventMouse,
  type InputEventMouseButton,
  type InputEventMouseMotion,
  type VFXItem,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { GestureCursorType } from '../cursor';
import { drawDashedCorners, toColor } from '../drawing';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import { getItemViewTransform, getPlayerItemById } from '../items';
import { Vector2, getTransformedBoxCorners } from '../math';
import type { TextEditSession } from '../text/text-edit-session';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import { TEXT_EDIT_BOX_LINE_COLOR } from './text-gizmo';

/** 在文本编辑模式下悬停、选择并切换文本对象。 */
export class SelectTextGizmo extends Gizmo {

  readonly type = 'select-text';
  private static readonly HOVER_HIT_RADIUS = 4;
  private static readonly HOVER_LINE_WIDTH = 1;
  private static readonly HOVER_DASH_LENGTH = 4;
  private static readonly HOVER_GAP_LENGTH = 4;
  private _hoverTextId: string | undefined;
  private pointerSelecting = false;

  /**
   * 创建文本选择交互。
   * @param owner Gizmo 宿主。
   * @param session 文本编辑会话。
   */
  constructor (
    owner: GizmoOwner,
    private readonly session: TextEditSession,
  ) {
    super(owner);
  }

  /** 当前悬停文本的 ID。 */
  get hoverTextId (): string | undefined {
    return this._hoverTextId;
  }

  /**
   * 更新文本悬停或拖拽选区。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    if (this.pointerSelecting && (event.buttonMask & MouseButtonMask.Left) !== 0) {
      this.session.updatePointerSelection({
        x: event.position.x,
        y: event.position.y,
      });
      this.setTextCursor(event);
      event.accept();

      return;
    }

    const target = this.resolveTextTarget(
      new Vector2(event.position.x, event.position.y),
      true,
    );

    if (!target) {
      this.clearHover();

      return;
    }

    this._hoverTextId = target.getInstanceId();
    this.setTextCursor(event);
    event.accept();
  }

  /**
   * 切换到命中的文本并开始指针选区。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }

    // 按下仅使用精确命中，避免悬停容差误选相邻文本。
    const target = this.resolveTextTarget(
      new Vector2(event.position.x, event.position.y),
      false,
      false,
    );

    if (!target || !this.session.retarget(target, 'focus')) {
      return;
    }

    this._hoverTextId = undefined;
    this.pointerSelecting = true;
    this.session.beginPointerSelection({
      x: event.position.x,
      y: event.position.y,
    });
    this._owner.getSelection().commitSelectedItems([target.getInstanceId()]);
    this.setTextCursor(event);
    event.accept();
  }

  /**
   * 更新文本指针选区。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    if (!this.pointerSelecting) {
      return;
    }
    this.session.updatePointerSelection({
      x: event.position.x,
      y: event.position.y,
    });
    this.setTextCursor(event);
    event.accept();
  }

  /**
   * 完成文本指针选区。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (!this.pointerSelecting) {
      return;
    }
    this.session.finishPointerSelection({
      x: event.position.x,
      y: event.position.y,
    });
    this.pointerSelecting = false;
    this._hoverTextId = undefined;
    this.setTextCursor(event);
    event.accept();
  }

  /** 清除离开视口后的文本悬停状态。 */
  override onMouseLeave (): void {
    this.clearHover();
    this._owner.setCursor({ type: GestureCursorType.NORMAL, angle: 0 });
  }

  /** 在每帧更新时校验悬停文本是否仍可编辑。 */
  override onUpdate (): void {
    if (!this._hoverTextId) {
      return;
    }

    const item = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], this._hoverTextId);

    if (!this.isTextCandidate(item, true)) {
      this.clearHover();
    }
  }

  /**
   * 绘制悬停文本的轮廓。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    if (!this._hoverTextId) {
      return;
    }

    const item = getPlayerItemById(this._owner.getEngine().sceneServer.compositions[0], this._hoverTextId);

    if (!this.isTextCandidate(item, true)) {
      return;
    }

    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const transform = getItemViewTransform(item, containerSize);

    if (!transform) {
      return;
    }

    drawDashedCorners(
      control,
      getTransformedBoxCorners(transform),
      toColor(TEXT_EDIT_BOX_LINE_COLOR, 1),
      SelectTextGizmo.HOVER_LINE_WIDTH,
      SelectTextGizmo.HOVER_DASH_LENGTH,
      SelectTextGizmo.HOVER_GAP_LENGTH,
    );
  }

  /** 释放文本选择交互状态。 */
  override dispose (): void {
    this.pointerSelecting = false;
    this.session.cancelPointerSelection();
    this.clearHover();
    super.dispose();
  }

  /**
   * 查找指定位置可编辑的文本对象。
   * @param point 视口坐标。
   * @param excludeEditingItem 是否排除当前编辑对象。
   * @param includeNearby 是否使用悬停命中容差。
   * @returns 命中的文本对象。
   */
  private resolveTextTarget (
    point: Vector2,
    excludeEditingItem: boolean,
    includeNearby = true,
  ): VFXItem | undefined {
    const radius = SelectTextGizmo.HOVER_HIT_RADIUS;
    const diagonal = radius / Math.SQRT2;
    const offsets = includeNearby
      ? [
        [0, 0],
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
        [diagonal, diagonal],
        [diagonal, -diagonal],
        [-diagonal, diagonal],
        [-diagonal, -diagonal],
      ]
      : [[0, 0]];
    const composition = this._owner.getEngine().sceneServer.compositions[0];

    for (const [x, y] of offsets) {
      const hitPoint = new Vector2(point.x + x, point.y + y);
      const target = this._owner.getSelection().hitTest(hitPoint)
        .map(id => getPlayerItemById(composition, id))
        .find(item => this.isTextCandidate(item, excludeEditingItem));

      if (target) {
        return target;
      }
    }

    return undefined;
  }

  /**
   * 判断对象是否可作为文本选择目标。
   * @param item 待检查对象。
   * @param excludeEditingItem 是否排除当前编辑对象。
   * @returns 是否为可选文本对象。
   */
  private isTextCandidate (
    item: VFXItem | undefined,
    excludeEditingItem: boolean,
  ): item is VFXItem {
    return !!item
      && item.isVisible
      && item.type === spec.ItemType.text
      && !!item.getComponent(TextComponent)
      && (!excludeEditingItem || item !== this.session.editingItem);
  }

  /** 清除文本悬停目标。 */
  private clearHover (): void {
    this._hoverTextId = undefined;
  }

  /**
   * 设置文本编辑光标。
   * @param _event 当前鼠标事件。
   */
  private setTextCursor (_event: InputEventMouse): void {
    this._owner.setCursor({ type: GestureCursorType.TEXT, angle: 0 });
  }
}
