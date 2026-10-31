import { math } from '@galacean/effects';
import type { Engine } from '@galacean/effects';
import { Container, Control, MouseFilter, CursorShape } from '@galacean/effects-plugin-gui';
import type { AssetViewItem } from '../asset-view/asset-view';
import { drawAssetIcon } from '../icons/asset-icons';
import { paintIcon } from '../icons/control-icons';
import type { EditorIcon } from '../icons/control-icons';
import { editorBox, editorColors as C, EDITOR_FONT, EDITOR_FONT_SIZE, EDITOR_SMALL_FONT_SIZE } from '../theme/control-theme';
import { TexturePresentation } from '../../features/assets/preview/texture-preview';

interface DragPresentation { label: string, icon?: EditorIcon, count?: number, asset?: AssetViewItem }
const presentations = new WeakMap<object, DragPresentation>();

export function withDragPresentation<T> (data: T, presentation: DragPresentation): T {
  if (data && typeof data === 'object') { presentations.set(data, presentation); }

  return data;
}

export class EditorDragFeedback extends Control {
  private descriptor?: DragPresentation;
  private readonly image: TexturePresentation;
  private aspect = 1;
  private hasImage = false;
  private readonly background = editorBox(C.dropdown, 0, 4, C.dropdownOutline);

  constructor (engine: Engine) { super(engine); this.mouseFilter = MouseFilter.Ignore; this.image = new TexturePresentation(engine); }
  override update (delta: number): void {
    const root = this.root, data = root?.guiGetDragData();

    this.descriptor = root?.guiIsDragging() && data && typeof data === 'object' ? presentations.get(data) : undefined;
    const preview = this.descriptor?.asset?.preview?.(false);

    this.image.update(preview?.preview, undefined, 128); this.hasImage = !!preview; this.aspect = preview ? preview.width / Math.max(1, preview.height) : 1;
    if (root && this.descriptor) {
      const mouse = root.getMousePosition(), width = Math.min(320, this.measureText(this.descriptor.label, EDITOR_FONT_SIZE, EDITOR_FONT).width + (this.descriptor.asset ? 88 : 42));
      const height = this.descriptor.asset ? 76 : (this.descriptor.count ?? 1) > 1 ? 48 : 32;

      this.setRect({ position: new math.Vector2(Math.max(0, Math.min(root.width - width, mouse.x + 12)), Math.max(0, Math.min(root.height - height, mouse.y + 16))), size: new math.Vector2(width, height) });
    }
    super.update(delta);
  }
  override draw (): void {
    const descriptor = this.descriptor;

    if (!descriptor) { return; }
    this.drawStyleBox(this.background, 0, 0, this.width, this.height);
    const asset = descriptor.asset;

    if (asset) {
      this.fillRect(5, 5, 64, 64, C.recessed);
      if (this.hasImage) {
        const width = Math.min(64, 64 * this.aspect), height = width / this.aspect;

        this.image.draw(this, 5 + (64 - width) / 2, 5 + (64 - height) / 2, width, height);
      } else { drawAssetIcon(this, asset.icon, 9, 9, 56); }
      this.fillRect(5, 67, 64, 3, asset.accent);
    } else { paintIcon(this, descriptor.icon ?? 'object', 8, 8, 16); }
    const x = asset ? 78 : 30, text = descriptor.label;

    this.engine.renderingServer.graphics.pushClipRect(x, 0, this.width - x - 8, this.height);
    this.drawText(x, asset ? 14 : (descriptor.count ?? 1) > 1 ? 6 : (this.height - this.measureText(text, EDITOR_FONT_SIZE, EDITOR_FONT).lineHeight) / 2, text, EDITOR_FONT_SIZE, C.foreground, EDITOR_FONT);
    if (asset || (descriptor.count ?? 1) > 1) { this.drawText(x, asset ? 40 : 27, (descriptor.count ?? 1) + ((descriptor.count ?? 1) > 1 ? ' items' : ' item'), EDITOR_SMALL_FONT_SIZE, C.muted, EDITOR_FONT); }
    this.engine.renderingServer.graphics.popClipRect();
  }
  override onDestroy (): void { this.image.dispose(); super.onDestroy(); }
}

/** Compatible references remain visible throughout a drag; the hovered target adds a dashed border. */
export class EditorDropTarget extends Container {
  protected recognizesDrop (data: unknown): boolean { return !!data && typeof (data as { type?: unknown }).type === 'string'; }
  override getCursorShape (position: math.Vector2): ReturnType<Control['getCursorShape']> {
    const data = this.root?.guiGetDragData();

    return this.root?.guiIsDragging() && this.recognizesDrop(data) ? this.invokeCanDropData(position, data) ? CursorShape.CanDrop : CursorShape.Forbidden : super.getCursorShape(position);
  }
  protected override drawChildren (): void {
    super.drawChildren();
    if (!this.root?.guiIsDragging() || !this.enabledInHierarchy) { return; }
    const data = this.root.guiGetDragData(), point = this.getLocalMousePosition(), hovered = this.hasPoint(point);
    const valid = this.invokeCanDropData(point, data);

    if (!valid && !(hovered && this.recognizesDrop(data))) { return; }
    const tint = valid ? C.dropTarget : C.error;

    this.fillRect(0, 0, this.width, this.height, new math.Color(tint.r, tint.g, tint.b, hovered ? .18 : .08));
    if (hovered) {
      for (let x = 0; x < this.width; x += 10) {
        const width = Math.min(6, this.width - x);

        this.fillRect(x, 0, width, 1, tint); this.fillRect(x, this.height - 1, width, 1, tint);
      }
      for (let y = 0; y < this.height; y += 10) {
        const height = Math.min(6, this.height - y);

        this.fillRect(0, y, 1, height, tint); this.fillRect(this.width - 1, y, 1, height, tint);
      }
    }
  }
}
