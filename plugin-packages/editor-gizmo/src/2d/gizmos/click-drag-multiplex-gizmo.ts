import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import {
  InputEventMouseButton,
  type InputEventMouse,
  type InputEventMouseMotion,
} from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';

/**
 * 复制鼠标按键事件，生成可独立修改的快照。
 * @param source 源鼠标按键事件。
 * @returns 事件快照。
 */
function copyMouseButton (source: InputEventMouseButton): InputEventMouseButton {
  const event = new InputEventMouseButton();

  event.device = source.device;
  event.pressed = source.pressed;
  event.canceled = source.isCanceled();
  event.commandOrControlAutoremap = source.commandOrControlAutoremap;
  event.shiftPressed = source.shiftPressed;
  event.altPressed = source.altPressed;
  event.metaPressed = source.metaPressed;
  event.ctrlPressed = source.ctrlPressed;
  event.buttonMask = source.buttonMask;
  event.position.copyFrom(source.position);
  event.globalPosition.copyFrom(source.globalPosition);
  event.factor = source.factor;
  event.buttonIndex = source.buttonIndex;
  event.doubleClick = source.doubleClick;

  return event;
}

/**
 * 根据拖拽事件创建用于取消点击候选的抬起事件。
 * @param source 当前鼠标拖拽事件。
 * @param down 原始鼠标按下事件。
 * @returns 已取消的鼠标抬起事件。
 */
function canceledReleaseFromMotion (
  source: InputEventMouseMotion,
  down: InputEventMouseButton,
): InputEventMouseButton {
  const event = copyMouseButton(down);

  event.pressed = false;
  event.canceled = true;
  event.buttonMask = source.buttonMask;
  event.position.copyFrom(source.position);
  event.shiftPressed = source.shiftPressed;
  event.altPressed = source.altPressed;
  event.metaPressed = source.metaPressed;
  event.ctrlPressed = source.ctrlPressed;

  return event;
}

/**
 * 判断当前平台的标准快捷键是否按下。
 * @param event 鼠标拖拽事件。
 * @returns 是否按下 Command 或 Ctrl。
 */
function isStandardShortcutPressed (event: InputEventMouseMotion): boolean {
  const isApplePlatform = typeof navigator !== 'undefined'
    && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  return isApplePlatform ? event.metaPressed : event.ctrlPressed;
}

/** 点击与拖拽候选的仲裁配置。 */
export type ClickDragMultiplexOptions = {
  /** 点击阶段的候选列表。 */
  clickCandidates: Gizmo[],
  /** 拖拽阶段的候选列表。 */
  dragCandidates: Gizmo[],
  /** 标准快捷键按下时优先尝试的拖拽候选。 */
  auxiliaryBehavior?: Gizmo,
};

/** 在同一指针序列中延迟仲裁点击与拖拽候选。 */
export class ClickDragMultiplexGizmo extends Gizmo {
  readonly type = 'click-drag-multiplex';

  /** 点击阶段的候选列表。 */
  private readonly clickCandidateList: readonly Gizmo[];
  /** 拖拽阶段的候选列表。 */
  private readonly dragCandidateList: readonly Gizmo[];
  /** 标准快捷键对应的辅助拖拽候选。 */
  private readonly auxiliaryBehaviorGizmo: Gizmo | undefined;
  /** 供拖拽候选重放的按下事件快照。 */
  private downSnapshot: InputEventMouseButton | undefined;
  /** 当前拖拽候选胜者。 */
  private dragWinner: Gizmo | undefined;
  /** 当前点击候选胜者。 */
  private clickWinner: Gizmo | undefined;

  /**
   * 创建点击与拖拽仲裁器。
   * @param owner Gizmo 宿主。
   * @param options 候选配置。
   */
  constructor (owner: GizmoOwner, options: ClickDragMultiplexOptions) {
    super(owner);
    this.clickCandidateList = [...options.clickCandidates];
    this.dragCandidateList = [...options.dragCandidates];
    this.auxiliaryBehaviorGizmo = options.auxiliaryBehavior;
  }

  /** @returns 点击候选的只读列表。 */
  clickCandidates (): readonly Gizmo[] {
    return this.clickCandidateList;
  }

  /** @returns 拖拽候选的只读列表。 */
  dragCandidates (): readonly Gizmo[] {
    return this.dragCandidateList;
  }

  /** @returns 标准快捷键对应的辅助拖拽候选。 */
  auxiliaryBehavior (): Gizmo | undefined {
    return this.auxiliaryBehaviorGizmo;
  }

  /**
   * 将按下事件交给点击候选并保存事件快照。
   * @param event 鼠标按下事件。
   */
  override onMouseDown (event: InputEventMouseButton): void {
    const winner = this.invokeMouseDown(this.clickCandidateList, event);

    if (winner) {
      this.clickWinner = winner;
    }
    this.downSnapshot = copyMouseButton(event);
    this.dragWinner = undefined;
  }

  /**
   * 将悬停移动事件广播给点击候选。
   * @param event 鼠标移动事件。
   */
  override onMouseMove (event: InputEventMouseMotion): void {
    for (const candidate of this.clickCandidateList) {
      this.invoke(candidate, event, 'move');
    }

    this.dragWinner = undefined;
  }

  /**
   * 解析拖拽胜者并将事件转发给它。
   * @param event 鼠标拖拽事件。
   */
  override onMouseDrag (event: InputEventMouseMotion): void {
    // 步骤 1：允许已建立会话的点击候选优先处理拖拽。
    for (const candidate of this.clickCandidateList) {
      if (this.invoke(candidate, event, 'drag')) {
        return;
      }
    }

    if (!this.downSnapshot) {
      return;
    }

    // 步骤 2：重放按下事件，按优先级解析拖拽胜者。
    if (!this.dragWinner) {
      this.downSnapshot.clearAccepted();
      if (isStandardShortcutPressed(event)) {
        this.dragWinner = this.resolveDragCandidate(this.auxiliaryBehaviorGizmo);
      }
      if (!this.dragWinner) {
        for (const candidate of this.dragCandidateList) {
          this.dragWinner = this.resolveDragCandidate(candidate);
          if (this.dragWinner) {
            break;
          }
        }
      }
      if (!this.dragWinner) {
        return;
      }

      // 步骤 3：拖拽胜出后取消所有点击会话。
      const canceledRelease = canceledReleaseFromMotion(event, this.downSnapshot);

      for (const candidate of this.clickCandidateList) {
        this.invoke(candidate, canceledRelease, 'up');
      }
    }

    this.invoke(this.dragWinner, event, 'drag');
  }

  /**
   * 将抬起事件交给当前胜者。
   * @param event 鼠标抬起事件。
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (this.clickWinner) {
      this.clickWinner = undefined;
    }
    if (this.dragWinner) {
      this.invoke(this.dragWinner, event, 'up');
      this.dragWinner = undefined;
    } else {
      for (const candidate of this.clickCandidateList) {
        if (this.invoke(candidate, event, 'up')) {
          break;
        }
      }
    }
  }

  /** 将每帧更新转发给点击和拖拽候选。 */
  override onUpdate (): void {
    for (const candidate of [...this.clickCandidateList, ...this.dragCandidateList]) {
      candidate.onUpdate();
    }
  }

  /**
   * 按候选优先级绘制所有子 Gizmo。
   * @param control 绘制控制器。
   */
  override draw (control: Control): void {
    const ordered: Gizmo[] = [...this.clickCandidateList, ...this.dragCandidateList];

    if (this.auxiliaryBehaviorGizmo) {
      ordered.push(this.auxiliaryBehaviorGizmo);
    }
    for (const candidate of ordered) {
      candidate.draw(control);
    }
  }

  /** 释放所有子 Gizmo 和交互快照。 */
  override dispose (): void {
    this.clearWinners();
    this.downSnapshot = undefined;
    for (const candidate of this.allChildren()) {
      candidate.dispose();
    }
    super.dispose();
  }

  /**
   * 顺序派发按下事件并返回首个接受者。
   * @param candidates 候选列表。
   * @param event 鼠标按下事件。
   * @returns 接受事件的候选。
   */
  private invokeMouseDown (candidates: readonly Gizmo[], event: InputEventMouseButton): Gizmo | undefined {
    for (const candidate of candidates) {
      if (this.invoke(candidate, event, 'down')) {
        return candidate;
      }
    }

    return undefined;
  }

  /**
   * 向候选重放按下事件以尝试建立拖拽会话。
   * @param candidate 待尝试的候选。
   * @returns 接受事件的拖拽候选。
   */
  private resolveDragCandidate (candidate: Gizmo | undefined): Gizmo | undefined {
    if (!candidate || !this.downSnapshot) {
      return undefined;
    }

    return this.invoke(candidate, this.downSnapshot, 'down') ? candidate : undefined;
  }

  /** @returns 所有受托管的子 Gizmo。 */
  private allChildren (): Gizmo[] {
    const children: Gizmo[] = [...this.clickCandidateList, ...this.dragCandidateList];

    if (this.auxiliaryBehaviorGizmo) {
      children.push(this.auxiliaryBehaviorGizmo);
    }

    return children;
  }

  /** 清除当前点击与拖拽胜者。 */
  private clearWinners (): void {
    this.dragWinner = undefined;
    if (this.clickWinner) {
      this.clickWinner = undefined;
    }
  }

  /**
   * 调用候选的指定鼠标阶段。
   * @param candidate 目标候选。
   * @param event 鼠标事件。
   * @param phase 事件阶段。
   * @returns 候选是否接受事件。
   */
  private invoke (
    candidate: Gizmo,
    event: InputEventMouse,
    phase: 'down' | 'move' | 'drag' | 'up',
  ): boolean {
    switch (phase) {
      case 'down':
        candidate.onMouseDown(event as InputEventMouseButton);

        break;
      case 'move':
        candidate.onMouseMove(event as InputEventMouseMotion);

        break;
      case 'drag':
        candidate.onMouseDrag(event as InputEventMouseMotion);

        break;
      case 'up':
        candidate.onMouseUp(event as InputEventMouseButton);

        break;
    }

    return event.isAccepted();
  }
}
