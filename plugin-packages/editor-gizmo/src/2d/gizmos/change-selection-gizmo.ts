import { SceneServer } from '@galacean/effects';
import { Gizmo } from '../gizmo';
import {
  MouseButton,
  type InputEventMouseButton,
  type InputEventMouseMotion,
} from '@galacean/effects';
import { Vector2 } from '../math';
import type { SelectionHitSnapshot } from '../selection';
import {
  getItemChildren,
  getPlayerItemById,
} from '../items';

/** 单次按下选择交互的状态。 */
type SelectionPressSession = {
  /** 交互开始前的选中项 ID。 */
  initialSelectedIds: string[],
  /** 按下位置的命中快照。 */
  pressHit: SelectionHitSnapshot,
  /** 按下时最上层的命中项。 */
  pressTarget?: string,
  /** 等待抬起确认的选择目标。 */
  deferredTarget?: string,
  /** 当前选择提交方式。 */
  mode: 'immediate' | 'deferred' | 'none',
  /** 按下时是否启用追加选择。 */
  shiftKey: boolean,
};

/** 处理单击、双击和右键选择，并协调与拖拽候选的选择时机。 */
export class ChangeSelectionGizmo extends Gizmo {
  readonly type = 'change-selection';
  private session: SelectionPressSession | undefined;
  private hoverItemId: string | undefined;

  /**
   * 更新悬停目标。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    const selection = this._owner.getSelection();

    selection.commitHoverTarget(new Vector2(event.position.x, event.position.y));
    this.hoverItemId = selection.preSelectedId;
    event.accept();
  }

  /**
   * 忽略拖拽阶段的悬停更新。
   * @param _event 鼠标拖拽事件。
   */
  override onMouseDrag (_event: InputEventMouseMotion): void {
    // 拖拽阶段不更新选择悬停。
  }

  /**
   * 根据鼠标按键和命中结果开始选择交互。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    // 步骤 1：保留按下前的悬停目标并处理右键选择。
    this._owner.getSelection().setHoverOverlayTarget(this.hoverItemId);

    if (event.buttonIndex === MouseButton.Right) {
      const oldSelectedIds = [...this._owner.getSelection().getSelectedIds()];

      if (this.resolveContextSelection(event)) {
        const selectedIds = [...this._owner.getSelection().getSelectedIds()];

        this._owner.emit('actionstart', { source: this, selectedIds });
        this._owner.emit('actioncommit', {
          source: this,
          selectedIds,
          oldSelectedIds,
        });
      }

      return;
    }
    // 步骤 2：为主键点击记录命中快照与初始选区。
    if (event.buttonIndex !== MouseButton.Left) {
      return;
    }

    const selection = this._owner.getSelection();
    const point = new Vector2(event.position.x, event.position.y);
    const pressHit = selection.createHitSnapshot(point);
    const initialSelectedIds = [...selection.getSelectedIds()];

    selection.interactionStartSelectedIds = [...initialSelectedIds];

    const session: SelectionPressSession = {
      initialSelectedIds,
      pressHit,
      pressTarget: pressHit.topmostId,
      mode: 'none',
      shiftKey: event.shiftPressed,
    };

    // 步骤 3：解析立即提交或延迟到抬起的选择结果。
    const nextSelectedIds = this.resolvePressSelection(event, session);

    if (nextSelectedIds) {
      session.mode = 'immediate';
      selection.commitSelectedItems(nextSelectedIds);
    }

    // 步骤 4：保存会话并通知宿主交互开始。
    this.session = session;
    this._owner.emit('actionstart', {
      source: this,
      selectedIds: [...this._owner.getSelection().getSelectedIds()],
    });
    event.accept();
  }

  /**
   * 完成或取消当前选择交互。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    const session = this.session;
    const selection = this._owner.getSelection();

    if (event.isCanceled()) {
      this.resetSession();
      if (session) {
        event.accept();
      }

      return;
    }
    if (!session) {
      return;
    }
    event.accept();

    const releasePoint = new Vector2(event.position.x, event.position.y);

    if (session.mode === 'deferred' && session.deferredTarget) {
      const releaseHit = selection.createHitSnapshot(releasePoint);
      const targetStillExists = !!getPlayerItemById(
        this._owner.getEngine().getServer(SceneServer).compositions[0],
        session.deferredTarget,
      );

      if (targetStillExists && releaseHit.topmostId === session.deferredTarget) {
        selection.commitSelectedItems([session.deferredTarget]);
      }
    } else if (
      session.mode === 'none'
      && !session.shiftKey
      && session.pressHit.drillTargetId
      && session.pressHit.drillTargetId !== session.pressTarget
    ) {
      const releaseHit = selection.createHitSnapshot(releasePoint);
      const drillTargetId = session.pressHit.drillTargetId;
      const targetStillExists = !!getPlayerItemById(
        this._owner.getEngine().getServer(SceneServer).compositions[0],
        drillTargetId,
      );

      if (targetStillExists && releaseHit.drillTargetId === drillTargetId) {
        selection.commitSelectedItems([drillTargetId]);
      }
    } else if (
      !session.pressTarget
      && !session.shiftKey
      && selection.getFocusedGroupId()
      && !selection.isPointInFocusedGroup(releasePoint)
    ) {
      selection.setFocusedGroup(null);
    }

    this.resetSession();
    this._owner.emit('actioncommit', {
      source: this,
      selectedIds: [...this._owner.getSelection().getSelectedIds()],
      oldSelectedIds: session.initialSelectedIds,
    });
  }

  /** 释放选择交互状态。 */
  override dispose (): void {
    this.hoverItemId = undefined;
    this.resetSession();
    super.dispose();
  }

  /**
   * 解析按下阶段应提交的选区。
   * @param event 鼠标按下事件。
   * @param session 当前按下会话。
   * @returns 立即提交的选中项 ID；需要延迟或保持选区时返回 undefined。
   */
  private resolvePressSelection (
    event: InputEventMouseButton,
    session: SelectionPressSession,
  ): string[] | undefined {
    const selection = this._owner.getSelection();
    const selectedIds = session.initialSelectedIds;
    const target = session.pressTarget;

    // 步骤 1：双击按已选父组继续向内下钻一层。
    if (event.doubleClick && !event.shiftPressed && session.pressHit.drillTargetId) {
      return [session.pressHit.drillTargetId];
    }

    // 步骤 2：Shift 单击切换目标的选中状态。
    if (event.shiftPressed) {
      if (!target) {
        return undefined;
      }

      return selectedIds.includes(target)
        ? selectedIds.filter(id => id !== target)
        : [...selectedIds, target];
    }

    // 步骤 3：空白点击或已选范围内点击保持既有拖拽语义。
    if (!target) {
      return this._owner.getSelection().isPointInSelectedViewBox(session.pressHit.point) ? undefined : [];
    }

    if (session.pressHit.selectedScopeHitIds.includes(target)) {
      if (!selection.isItemSelected(target)) {
        session.mode = 'deferred';
        session.deferredTarget = target;
      }

      return undefined;
    }

    // 步骤 4：重叠未选目标延迟到抬起时确认。
    if (session.pressHit.selectedScopeHitIds.length > 0) {
      if (!selection.isItemSelected(target)) {
        session.mode = 'deferred';
        session.deferredTarget = target;
      }

      return undefined;
    }

    return [target];
  }

  /**
   * 根据右键命中结果更新上下文选区。
   * @param event 鼠标按下事件。
   * @returns 选区是否发生变化。
   */
  private resolveContextSelection (event: InputEventMouseButton): boolean {
    const selection = this._owner.getSelection();
    const hitId = selection.createHitSnapshot(
      new Vector2(event.position.x, event.position.y),
    ).topmostId;
    const selectedIds = [...selection.getSelectedIds()];
    const selectedScopeIds = new Set([
      ...selectedIds,
      ...selectedIds.flatMap(id => {
        const item = getPlayerItemById(this._owner.getEngine().getServer(SceneServer).compositions[0], id);

        return item ? getItemChildren(item).map(child => child.getInstanceId()) : [];
      }),
    ]);

    if (hitId && !selectedScopeIds.has(hitId)) {
      return selection.commitSelectedItems(
        event.shiftPressed ? [...selectedIds, hitId] : [hitId],
      );
    }

    return false;
  }

  /** 清除当前按下会话。 */
  private resetSession (): void {
    this.session = undefined;
  }

}
