import { ImGui } from '../imgui';

const headingColor = new ImGui.Vec4(1, 1, 1, 0.25);

export function editorMenuSection (label: string, separated = false): void {
  if (separated) {
    ImGui.Spacing(); ImGui.Separator(); ImGui.Spacing();
  }
  const position = ImGui.GetCursorScreenPos();
  const size = Math.max(12, ImGui.GetFontSize() * 0.78);
  const scale = size / ImGui.GetFontSize();
  const spacing = size * 0.12;
  const color = ImGui.GetColorU32(headingColor);
  const dl = ImGui.GetWindowDrawList();
  let x = position.x;

  for (const character of label.toUpperCase()) {
    dl.AddText(ImGui.GetFont(), size, new ImGui.Vec2(Math.round(x), position.y + 6), color, character);
    x += ImGui.CalcTextSize(character).x * scale + spacing;
  }
  ImGui.Dummy(new ImGui.Vec2(Math.max(0, x - position.x - spacing), Math.ceil(size + 12)));
}
