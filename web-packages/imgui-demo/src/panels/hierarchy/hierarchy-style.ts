import { ImGui } from '../../imgui';
import { drawEditorIcon } from '../../widgets/editor-icons';
import type { EditorIcon } from '../../widgets/editor-icons';
import { editorButtonColors, InteractionColors as I } from '../theme/editor-interaction';

export const OUTLINER_SIZE = { row: 20, icon: 16, indent: 12, gutter: 24, header: 26 };
export const FOLDER_TINT = new ImGui.Vec4(182 / 255, 143 / 255, 85 / 255, 1);

export function outlinerButton (id: string, icon: EditorIcon, hint: string, enabled = true): boolean {
  const p = ImGui.GetCursorScreenPos();

  ImGui.BeginDisabled(!enabled);
  const clicked = ImGui.InvisibleButton(id, new ImGui.Vec2(24, 24));
  const hovered = ImGui.IsItemHovered(), [, hover, active] = editorButtonColors();

  if (hovered || ImGui.IsItemActive()) { ImGui.GetWindowDrawList().AddRectFilled(p, new ImGui.Vec2(p.x + 24, p.y + 24), ImGui.GetColorU32(ImGui.IsItemActive() ? active : hover), 3); }
  drawEditorIcon(icon, p.x + 4, p.y + 4, 16, enabled ? hovered ? I.foregroundHover : I.foreground : I.muted);
  if (hovered) { outlinerHint(hint); }
  ImGui.EndDisabled();

  return clicked;
}

export function outlinerHint (text: string, detail?: string): void {
  ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(8, 6));
  ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 2));
  ImGui.BeginTooltip();
  ImGui.Text(text);
  if (detail) { ImGui.TextDisabled(detail); }
  ImGui.EndTooltip();
  ImGui.PopStyleVar(2);
}

export function outlinerText (text: string, x: number, y: number, width: number, tint: ImGui.Vec4, highlight = ''): void {
  if (width <= 0) { return; }
  let caption = text;

  if (ImGui.CalcTextSize(caption).x > width) {
    while (caption && ImGui.CalcTextSize(caption + '…').x > width) { caption = caption.slice(0, -1); }
    caption += '…';
  }
  const draw = ImGui.GetWindowDrawList();

  draw.PushClipRect(new ImGui.Vec2(x, y), new ImGui.Vec2(x + width, y + ImGui.GetTextLineHeight()), true);
  const term = highlight.trim().match(/^(?:name:|label:)?(?:"([^"]+)"|([^\s+\-:]+))$/i);
  const match = (term?.[1] ?? term?.[2] ?? '').toLocaleLowerCase();
  const start = match ? caption.toLocaleLowerCase().indexOf(match) : -1;

  if (start >= 0) {
    const left = x + ImGui.CalcTextSize(caption.slice(0, start)).x;
    const right = left + ImGui.CalcTextSize(caption.slice(start, start + match.length)).x;

    draw.AddRectFilled(new ImGui.Vec2(left, y), new ImGui.Vec2(right, y + ImGui.GetTextLineHeight()), ImGui.COL32(144, 108, 30, 160), 1);
  }
  draw.AddText(new ImGui.Vec2(Math.round(x), Math.round(y)), ImGui.GetColorU32(tint), caption);
  draw.PopClipRect();
}
