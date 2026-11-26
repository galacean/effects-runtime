import { spec, type InputEventMouseButton } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import type { Control } from '@galacean/effects-plugin-gui';
import { Gizmo } from '../gizmo';
import type { GizmoOwner } from '../gizmo-owner';
import { GizmoType } from '../gizmo-type';
import { getItemViewTransform } from '../items';
import { getTransformedBoxCorners, type Matrix3 } from '../../math';
import { drawCorners, toColor } from '../drawing';
import type { RichTextEditSession } from '../rich-text/rich-text-edit-session';
import type { RichTextViewport } from '../rich-text/rich-text-geometry';
import { GizmoViewportUtils } from '../viewport/viewport-utils';

/** 富文本专用的排版同步、编辑框和事件投影。 */
export class RichTextGizmo extends Gizmo {
  readonly type = GizmoType.RICH_TEXT;
  private transform: Matrix3 | undefined;
  private viewport: RichTextViewport | undefined;

  constructor (owner: GizmoOwner, private readonly session: RichTextEditSession) {
    super(owner);
    session.attachProjection(this, {
      readViewport: () => {
        this.onUpdate();

        return this.viewport;
      },
      forwardInput: payload => owner.emit('richtextinput', { source: this, ...payload }),
    });
  }

  get textAreaElement (): HTMLTextAreaElement { return this.session.textAreaElement; }
  get isEditing (): boolean { return this.session.isEditing; }

  override onUpdate (): void {
    const item = this.session.editingItem;

    this.transform = undefined;
    this.viewport = undefined;
    if (item?.type !== spec.ItemType.richtext || !item.isVisible) { return; }
    this.session.prepareLayout();
    const containerSize = GizmoViewportUtils.getContainerSize(this._owner.getEngine().canvas.parentElement!);

    this.transform = getItemViewTransform(item, containerSize);
    if (!this.transform) { return; }
    const [topLeft, topRight, , bottomLeft] = getTransformedBoxCorners(this.transform);
    const component = item.getComponent(RichTextComponent);

    if (!component) { return; }
    const width = Math.max(1, component.textLayout.width);
    const height = Math.max(1, component.textLayout.height);

    this.viewport = {
      width, height,
      transform: {
        a: (topRight.x - topLeft.x) / width, b: (topRight.y - topLeft.y) / width,
        c: (bottomLeft.x - topLeft.x) / height, d: (bottomLeft.y - topLeft.y) / height,
        e: topLeft.x, f: topLeft.y,
      },
    };
  }

  override draw (control?: Control): void {
    if (control && this.transform) {
      drawCorners(control, getTransformedBoxCorners(this.transform), toColor(0x3b82f6ff), 2);
    }
    this.session.syncViewport(this.viewport);
  }

  override onMouseUp (event: InputEventMouseButton): void {
    if (this.isEditing) { event.accept(); }
  }

  selectAllText (): boolean { return this.session.selectAllText(); }

  override dispose (): void {
    this.session.detachProjection(this);
    super.dispose();
  }
}
