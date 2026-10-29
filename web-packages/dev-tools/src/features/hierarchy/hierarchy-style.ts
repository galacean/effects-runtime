import { editorTooltip } from '../../ui/widgets/editor-tooltip';
import { ImGui } from '../../platform/imgui/index';
import type { EditorIcon } from '../../ui/icons/editor-icons';
import { toolbarButton } from '../../ui/widgets/toolbar-button';

export const HIERARCHY_SIZE = { row: 20, icon: 16, indent: 12, gutter: 24, header: 26 };
export const FOLDER_TINT = new ImGui.Vec4(182 / 255, 143 / 255, 85 / 255, 1);

export function hierarchyButton (id: string, icon: EditorIcon, hint: string, enabled = true): boolean {
  return toolbarButton(id, { icon, hint, enabled, width: 24, height: 24 });
}

export function hierarchyHint (text: string, detail?: string): void {
  editorTooltip(() => {
    ImGui.Text(text);
    if (detail) { ImGui.TextDisabled(detail); }
  });
}

export function hierarchyText (text: string, x: number, y: number, width: number, tint: ImGui.Vec4, highlight = ''): void {
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
