import { spec, type InputEventMouseButton } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import { GizmoViewportUtils } from '../viewport/viewport-utils';
import type { GizmoOwner } from '../gizmo-owner';
import { GizmoType } from '../gizmo-type';
import { getItemViewBox, getItemViewTransform } from '../items';
import { drawCorners, toColor } from '../drawing';
import type { TextEditSession, TextInteractionParam, TextResult } from '../text/text-edit-session';
import { getTransformedBoxCorners } from '../math';

export type {
  TextEmptyResult,
  TextInteractionParam,
  TextResult,
  TextValidResult,
} from '../text/text-edit-session';

/** 文本编辑态包围盒线色。 */
export const TEXT_EDIT_BOX_LINE_COLOR = 0x3b82f6;
/** 文本编辑态包围盒线宽。 */
export const TEXT_EDIT_BOX_LINE_WIDTH = 2;

/** 将文本编辑会话投影到画布并绘制编辑框。 */
export class TextGizmo extends Gizmo {
  readonly type = GizmoType.TEXT;

  result: TextResult = { type: 'empty' };
  private readonly session: TextEditSession;
  private readonly projectionToken = {};
  /**
   * 转发文本输入事件。
   * @param payload 文本输入结果。
   */
  private readonly forwardTextInput = (payload: {
    /** 文本元素 ID。 */
    itemId: string,
    /** 输入后的文本。 */
    text: string,
    /** 当前字体。 */
    fontFamily: string,
  }): void => {
    this._owner.emit('textinput', { source: this, ...payload });
  };

  /**
   * @param owner Gizmo 宿主
   * @param session 文本编辑会话
   */
  constructor (owner: GizmoOwner, session: TextEditSession) {
    super(owner);
    this.session = session;
    this.session.attachProjection(this.projectionToken);
    this.session.on('textInput', this.forwardTextInput);
  }

  /** 文本编辑使用的 DOM 输入框。 */
  get textAreaElement (): HTMLTextAreaElement {
    return this.session.textAreaElement;
  }

  /** 当前文本交互状态。 */
  get interactionParam (): TextInteractionParam {
    return this.session.interactionParam;
  }

  /** 是否正在编辑文本。 */
  get isEditing (): boolean {
    return this.session.isEditing;
  }

  /** 当前视口缩放。 */
  get viewScale (): number {
    const viewportMatrix = this._owner.getEngine().sceneServer.compositions[0].camera.getViewportMatrix();

    return viewportMatrix.elements[0];
  }

  /**
   * 保留文本编辑会话的鼠标按下入口。
   * @param _event 鼠标按下事件
   */
  override onMouseDown (_event: InputEventMouseButton): void {
    // 文本指针选择由 SelectTextGizmo 处理。
  }

  /**
   * 编辑中接收鼠标抬起事件。
   * @param event 鼠标抬起事件
   */
  override onMouseUp (event: InputEventMouseButton): void {
    if (this.isEditing) {
      event.accept();
    }
  }

  /** 更新文本元素的视图包围盒。 */
  override onUpdate (): void {
    const item = this.session.editingItem;

    if (item?.type !== spec.ItemType.text || !item.isVisible) {
      this.result = { type: 'empty' };
      this.textAreaElement.style.display = 'none';

      return;
    }

    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);
    const box = getItemViewBox(item, containerSize);
    const transform = getItemViewTransform(item, containerSize);

    this.result = !transform || box.isEmpty()
      ? { type: 'empty' }
      : { type: 'valid', box, transform };
  }

  /**
   * 绘制文本编辑框并同步 DOM 输入框。
   * @param control 绘制控制器
   */
  override draw (control?: Control): void {
    this.drawEditBox(control);
    this.session.syncTextArea(this.result, this.viewScale);
  }

  /**
   * 选中当前编辑文本的全部内容，并将焦点交给输入框。
   * @returns 当前存在可编辑文本时返回 true
   */
  selectAllText (): boolean {
    return this.session.selectAllText();
  }

  /** 脱离文本编辑会话投影。 */
  override dispose (): void {
    this.session.off('textInput', this.forwardTextInput);
    this.session.detachProjection(this.projectionToken);
    super.dispose();
  }

  /**
   * 绘制文本编辑包围盒。
   * @param control 绘制控制器
   */
  private drawEditBox (control?: Control): void {
    if (!control || this.result.type !== 'valid') {
      return;
    }
    drawCorners(
      control,
      getTransformedBoxCorners(this.result.transform),
      toColor(TEXT_EDIT_BOX_LINE_COLOR, 1),
      TEXT_EDIT_BOX_LINE_WIDTH,
    );
  }
}
