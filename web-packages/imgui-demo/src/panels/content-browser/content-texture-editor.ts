import { contentLibrary } from '../../core/content-library/content-library';
import { ImGui } from '../../imgui';
import { checkerboard, CONTENT_COLORS as C, contentText, contentWindowBackground } from './content-style';
import type { ContentThumbnails } from './content-thumbnails';

export class ContentTextureEditor {
  private asset?: string;
  private opened = false;
  private fit = true;
  private zoom = 1;
  private offset = new ImGui.Vec2();
  private pan?: { mouse: ImGui.Vec2, offset: ImGui.Vec2 };

  constructor (private readonly thumbnails: ContentThumbnails) { }

  open (id: string): void { this.asset = id; this.opened = true; this.fit = true; this.offset = new ImGui.Vec2(); }
  close (): void { this.opened = false; this.asset = undefined; this.pan = undefined; }

  draw (): void {
    const entry = this.asset ? contentLibrary.entry(this.asset) : undefined;

    if (!this.opened || !entry || entry.deletedAt) { return; }
    ImGui.SetNextWindowSize(new ImGui.Vec2(850, 560), ImGui.Cond.FirstUseEver);
    if (ImGui.Begin(entry.name + ' — Texture Editor###ContentTextureEditor', value => {
      if (value !== undefined) { this.opened = value; }

      return this.opened;
    }, ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse)) {
      contentWindowBackground();
      ImGui.SetCursorPosX(ImGui.GetCursorPosX() + 8); ImGui.SetCursorPosY(ImGui.GetCursorPosY() + 5);
      if (ImGui.Button('Fit', new ImGui.Vec2(54, 26))) { this.fit = true; }
      ImGui.SameLine();
      if (ImGui.Button('1:1', new ImGui.Vec2(54, 26))) { this.zoom = 1; this.fit = false; this.offset = new ImGui.Vec2(); }
      ImGui.SameLine(); ImGui.TextDisabled(Math.round(this.zoom * 100) + '%');
      ImGui.Separator();
      const available = ImGui.GetContentRegionAvail(), side = available.x > 520 ? 222 : 0;

      ImGui.BeginChild('##TextureViewport', new ImGui.Vec2(Math.max(30, available.x - side), Math.max(30, available.y)), ImGui.ChildFlags.None, ImGui.WindowFlags.NoScrollbar | ImGui.WindowFlags.NoScrollWithMouse);
      const origin = ImGui.GetCursorScreenPos(), size = ImGui.GetContentRegionAvail(), image = this.thumbnails.get(entry.id, true);
      const draw = ImGui.GetWindowDrawList();

      draw.AddRectFilled(origin, new ImGui.Vec2(origin.x + size.x, origin.y + size.y), C.recessed);
      ImGui.InvisibleButton('##TextureCanvas', size, ImGui.ButtonFlags.MouseButtonLeft | ImGui.ButtonFlags.MouseButtonMiddle | ImGui.ButtonFlags.MouseButtonRight);
      const hovered = ImGui.IsItemHovered(), io = ImGui.GetIO(), mouse = ImGui.GetMousePos();

      if (image) {
        if (this.fit) { this.zoom = Math.max(0.01, Math.min((size.x - 48) / image.width, (size.y - 48) / image.height, 1)); this.offset = new ImGui.Vec2(); }
        if (hovered && io.MouseWheel) {
          this.fit = false;
          const zoom = Math.max(0.01, Math.min(32, this.zoom * Math.pow(1.18, io.MouseWheel)));
          const x = mouse.x - origin.x - size.x / 2, y = mouse.y - origin.y - size.y / 2;

          this.offset.x = x - (x - this.offset.x) * zoom / this.zoom;
          this.offset.y = y - (y - this.offset.y) * zoom / this.zoom;
          this.zoom = zoom;
        }
        if (hovered && (ImGui.IsMouseClicked(ImGui.MouseButton.Middle) || ImGui.IsMouseClicked(ImGui.MouseButton.Right))) {
          this.fit = false;
          this.pan = { mouse: new ImGui.Vec2(mouse.x, mouse.y), offset: new ImGui.Vec2(this.offset.x, this.offset.y) };
        }
        if (this.pan) {
          if (ImGui.IsMouseDown(ImGui.MouseButton.Middle) || ImGui.IsMouseDown(ImGui.MouseButton.Right)) {
            this.offset.x = this.pan.offset.x + mouse.x - this.pan.mouse.x; this.offset.y = this.pan.offset.y + mouse.y - this.pan.mouse.y;
            ImGui.SetMouseCursor(ImGui.MouseCursor.ResizeAll);
          } else { this.pan = undefined; }
        }
        if (hovered && ImGui.IsMouseDoubleClicked(ImGui.MouseButton.Left)) { this.fit = true; }
        const w = image.width * this.zoom, h = image.height * this.zoom;
        const x = origin.x + (size.x - w) / 2 + this.offset.x, y = origin.y + (size.y - h) / 2 + this.offset.y;

        draw.PushClipRect(origin, new ImGui.Vec2(origin.x + size.x, origin.y + size.y), true);
        checkerboard(Math.max(origin.x, x), Math.max(origin.y, y), Math.max(0, Math.min(origin.x + size.x, x + w) - Math.max(origin.x, x)), Math.max(0, Math.min(origin.y + size.y, y + h) - Math.max(origin.y, y)), 12);
        draw.AddImage(image.texture, new ImGui.Vec2(x, y), new ImGui.Vec2(x + w, y + h)); draw.PopClipRect();
      } else { contentText('Loading texture...', origin.x + 20, origin.y + 20, C.muted); }
      ImGui.EndChild();
      if (side) {
        ImGui.SameLine(0, 0); ImGui.BeginChild('##TextureDetails', new ImGui.Vec2(0, available.y));
        ImGui.SetCursorPos(new ImGui.Vec2(12, 10)); ImGui.Text('Details'); ImGui.Separator();
        for (const [label, value] of [['Name', entry.name], ['Dimensions', entry.width + ' × ' + entry.height], ['Format', entry.mime?.replace('image/', '').toUpperCase() ?? 'Image'], ['Source', entry.sourceName ?? entry.name]]) {
          ImGui.Spacing(); ImGui.SetCursorPosX(12); ImGui.TextDisabled(label);
          ImGui.SetCursorPosX(12); ImGui.PushTextWrapPos(ImGui.GetWindowWidth() - 12); ImGui.TextWrapped(value); ImGui.PopTextWrapPos();
        }
        ImGui.EndChild();
      }
    }
    ImGui.End();
  }
}
