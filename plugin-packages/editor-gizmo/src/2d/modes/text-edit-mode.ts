import type { VFXItem } from '@galacean/effects';
import type { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import type { GizmoTool } from '../gizmo-tool';
import { HandGizmoTool } from '../gizmo-tools/hand-gizmo-tool';
import { MoveGizmoTool } from '../gizmo-tools/move-gizmo-tool';
import { LeaveTextEditGizmo } from '../gizmos/leave-text-edit-gizmo';
import { SelectTextGizmo } from '../gizmos/select-text-gizmo';
import { TextGizmo } from '../gizmos/text-gizmo';
import { TextEditSession } from '../text/text-edit-session';
import type { TextEditActivation } from '../text/text-edit-session';
import type { EditMode } from './edit-mode';

/** 管理行内文本编辑会话和对应 Gizmo 图的编辑模式。 */
export class TextEditMode implements EditMode {
  readonly id = 'text-edit';
  private readonly session: TextEditSession;

  /**
   * @param owner Gizmo 宿主
   * @param target 入口已校验的待编辑文本元素
   * @param activation 文本框激活方式
   */
  constructor (
    private readonly owner: GizmoOwner,
    private readonly target: VFXItem,
    private readonly activation: TextEditActivation = 'focus',
  ) {
    this.session = new TextEditSession(owner);
  }

  /** 当前会话正在编辑的文本元素，随文本选择交互更新。 */
  get editingItem (): VFXItem | undefined {
    return this.session.editingItem;
  }

  /**
   * 判断目标工具是否可复用文本编辑会话。
   * @param tool 目标工具
   * @returns 是否保持当前模式
   */
  canRemainActiveForTool (tool: GizmoTool): boolean {
    return tool instanceof MoveGizmoTool || tool instanceof HandGizmoTool;
  }

  /** 使用入口确定的目标进入文本编辑，避免旧模式退出时改变选区。 */
  onEnter (): void {
    if (this.session.retarget(this.target, this.activation)) {
      this.owner.getSelection().commitSelectedItems([this.target.getInstanceId()]);
    }
  }

  /** 结束文本编辑会话。 */
  onExit (): void {
    this.session.dispose();
  }

  /** @returns 文本编辑交互的 Gizmo 图。 */
  createGizmos (): Gizmo[] {
    return [
      new TextGizmo(this.owner, this.session),
      new SelectTextGizmo(this.owner, this.session),
      new LeaveTextEditGizmo(this.owner),
    ];
  }
}
