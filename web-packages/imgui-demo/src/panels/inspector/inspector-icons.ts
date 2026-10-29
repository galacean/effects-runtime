import { ImGui } from '../../imgui';
import { PROPERTY_COLORS as C } from '../../widgets/property-grid';
import { drawEditorIcon } from '../../widgets/editor-icons';

export type InspectorIcon = 'object' | 'component' | 'lock' | 'unlock' | 'settings' | 'material' | 'transform';

export function drawInspectorIcon (icon: InspectorIcon, x: number, y: number, size: number, tint = C.text): void {
  drawEditorIcon(icon, x, y, size, tint);
}

export function inspectorIconButton (id: string, icon: InspectorIcon, hint: string): boolean {
  const origin = ImGui.GetCursorScreenPos();
  const clicked = ImGui.InvisibleButton(id, new ImGui.Vec2(28, 26));

  if (ImGui.IsItemHovered()) {
    ImGui.GetWindowDrawList().AddRectFilled(origin, new ImGui.Vec2(origin.x + 28, origin.y + 26), ImGui.GetColorU32(C.hover), 3);
    ImGui.SetTooltip(hint);
  }
  drawInspectorIcon(icon, origin.x + 6, origin.y + 5, 16);

  return clicked;
}
