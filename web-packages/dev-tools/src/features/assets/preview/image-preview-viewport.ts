import { ImGui } from '../../../platform/imgui';
import type { ImGuiTextureDisplay } from '../../../platform/imgui/texture-binding';
import { ImGuiTextureBinding, isImGuiTexturePremultiplied, resolveImGuiTexture } from '../../../platform/imgui/texture-binding';
import { assetText, checkerboard } from '../../../ui/asset-view/asset-view';
import { InteractionColors as C } from '../../../ui/theme/editor-interaction';
import { beginEditorPopup, editorMenuItem, editorMenuSection, endEditorPopup } from '../../../ui/widgets/editor-menu';
import { toolbarButton, toolbarSeparator } from '../../../ui/widgets/toolbar-button';
import { drawTexturePreview, type TexturePreview } from './texture-preview';

export interface PreviewImage { preview: TexturePreview, width: number, height: number }
export interface ImagePreviewRect { x: number, y: number, width: number, height: number }

export class ImagePreviewViewport {
  fit = true;
  zoom = 1;
  offset = new ImGui.Vec2();
  readonly display: ImGuiTextureDisplay = { channels: [1, 1, 1, 1], desaturate: false };
  background: 'checker' | 'dark' | 'light' = 'checker';
  border = true;
  private pan?: { button: ImGui.MouseButton, mouse: ImGui.Vec2, offset: ImGui.Vec2 };

  reset (): void { this.fit = true; this.offset = new ImGui.Vec2(); this.pan = undefined; }

  draw (image?: PreviewImage, overlay?: (rect: ImagePreviewRect) => void): void {
    this.toolbar();
    const origin = ImGui.GetCursorScreenPos(), available = ImGui.GetContentRegionAvail();
    const size = new ImGui.Vec2(Math.max(1, available.x), Math.max(1, available.y)), max = new ImGui.Vec2(origin.x + size.x, origin.y + size.y);
    const draw = ImGui.GetWindowDrawList();

    draw.AddRectFilled(origin, max, ImGui.GetColorU32(C.background));
    ImGui.InvisibleButton('##ImageViewportCanvas', size, ImGui.ButtonFlags.MouseButtonLeft | ImGui.ButtonFlags.MouseButtonMiddle | ImGui.ButtonFlags.MouseButtonRight);
    const hovered = ImGui.IsItemHovered(), io = ImGui.GetIO(), mouse = ImGui.GetMousePos();

    if (!image) {
      assetText('Loading image...', origin.x + 16, origin.y + 16);

      return;
    }
    if (this.fit) { this.zoom = Math.max(0.01, Math.min((size.x - 48) / image.width, (size.y - 48) / image.height)); this.offset = new ImGui.Vec2(); }
    if (hovered && io.MouseWheel) {
      const zoom = Math.max(0.01, Math.min(32, this.zoom * Math.pow(1.18, io.MouseWheel)));
      const x = mouse.x - origin.x - size.x / 2, y = mouse.y - origin.y - size.y / 2;

      this.offset.x = x - (x - this.offset.x) * zoom / this.zoom;
      this.offset.y = y - (y - this.offset.y) * zoom / this.zoom;
      this.zoom = zoom; this.fit = false;
    }
    for (const button of [ImGui.MouseButton.Middle, ImGui.MouseButton.Right]) {
      if (hovered && ImGui.IsMouseClicked(button)) { this.pan = { button, mouse: new ImGui.Vec2(mouse.x, mouse.y), offset: new ImGui.Vec2(this.offset.x, this.offset.y) }; this.fit = false; }
    }
    if (this.pan && ImGui.IsMouseDown(this.pan.button)) {
      this.offset.x = this.pan.offset.x + mouse.x - this.pan.mouse.x; this.offset.y = this.pan.offset.y + mouse.y - this.pan.mouse.y;
      ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeAll);
    } else { this.pan = undefined; }
    if (hovered && (ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left) || ImGui.IsKeyPressed(ImGui.Key.F, false))) { this.reset(); }
    const width = image.width * this.zoom, height = image.height * this.zoom;
    const x = origin.x + (size.x - width) / 2 + this.offset.x, y = origin.y + (size.y - height) / 2 + this.offset.y;
    const min = new ImGui.Vec2(x, y), end = new ImGui.Vec2(x + width, y + height);

    draw.PushClipRect(origin, max, true);
    if (this.background === 'checker') {
      checkerboard(Math.max(origin.x, x), Math.max(origin.y, y), Math.max(0, Math.min(max.x, end.x) - Math.max(origin.x, x)), Math.max(0, Math.min(max.y, end.y) - Math.max(origin.y, y)), 12);
    } else { draw.AddRectFilled(min, end, this.background === 'light' ? ImGui.COL32(180, 180, 180, 255) : ImGui.COL32(20, 20, 20, 255)); }
    const texture = image.preview.tex;
    const filtered = new ImGuiTextureBinding(() => resolveImGuiTexture(texture), () => isImGuiTexturePremultiplied(texture), () => this.display);

    drawTexturePreview({ ...image.preview, tex: filtered }, min, end);
    if (this.border) { draw.AddRect(min, end, ImGui.GetColorU32(C.foreground)); }
    overlay?.({ x, y, width, height });
    draw.PopClipRect();
  }

  private toolbar (): void {
    const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;

    ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + 36), ImGui.GetColorU32(C.panel));
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x + 6, p.y + 4));
    const colors = [new ImGui.Vec4(0.92, 0.32, 0.28, 1), new ImGui.Vec4(0.42, 0.72, 0.22, 1), new ImGui.Vec4(0.3, 0.6, 0.95, 1), C.foreground];

    for (let channel = 0; channel < 4; channel++) {
      if (channel) { ImGui.SameLine(0, 1); }
      if (toolbarButton('##Channel' + channel, { label: 'RGBA'[channel], width: 29, height: 28, checked: this.display.channels[channel] === 1,
        checkedTint: colors[channel], tint: C.muted, hint: 'Show ' + ['red', 'green', 'blue', 'alpha'][channel] + ' channel' })) {
        this.display.channels[channel] = this.display.channels[channel] ? 0 : 1;
      }
    }
    toolbarSeparator(28, 7);
    if (toolbarButton('##ImageZoom', { label: this.fit ? 'Fit' : Math.round(this.zoom * 100) + '%', dropdown: true, height: 28, width: 88 })) { ImGui.OpenPopup('##ImageZoomOptions'); }
    if (beginEditorPopup('##ImageZoomOptions')) {
      editorMenuSection('Zoom');
      if (editorMenuItem('Fit', 'F', this.fit)) { this.reset(); }
      for (const percent of [25, 50, 100, 200, 400]) {
        if (editorMenuItem(percent + '%', '', !this.fit && Math.abs(this.zoom * 100 - percent) < 0.1)) { this.fit = false; this.zoom = percent / 100; this.offset = new ImGui.Vec2(); }
      }
      endEditorPopup();
    }
    ImGui.SameLine(0, 3);
    if (toolbarButton('##ImageFit', { icon: 'fit', height: 28, hint: 'Fit image (F)' })) { this.reset(); }
    if (width > 340) {
      ImGui.SameLine(0, 6);
      if (toolbarButton('##ImageView', { label: 'View', dropdown: true, height: 28 })) { ImGui.OpenPopup('##ImageViewOptions'); }
      if (beginEditorPopup('##ImageViewOptions')) {
        editorMenuSection('Display');
        if (editorMenuItem('Desaturate', '', this.display.desaturate)) { this.display.desaturate = !this.display.desaturate; }
        if (editorMenuItem('Draw Border', '', this.border)) { this.border = !this.border; }
        editorMenuSection('Background', true);
        for (const [value, label] of [['checker', 'Checkered'], ['dark', 'Dark'], ['light', 'Light']] as const) {
          if (editorMenuItem(label, '', this.background === value)) { this.background = value; }
        }
        endEditorPopup();
      }
    }
    ImGui.SetCursorScreenPos(new ImGui.Vec2(p.x, p.y + 36)); ImGui.Dummy(new ImGui.Vec2(width, 0));
  }
}
