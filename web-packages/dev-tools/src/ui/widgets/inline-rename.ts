import { ImGui } from '../../platform/imgui';

export interface InlineRenameResult { committed: boolean, cancelled: boolean }

export function inlineRename (id: string, buffer: [string], width: number, focus: boolean, ownerFocused: boolean): InlineRenameResult {
  ImGui.SetNextItemWidth(Math.max(30, width));
  if (focus) { ImGui.SetKeyboardFocusHere(); }
  const enter = ImGui.InputText(id, buffer, undefined, ImGui.InputTextFlags.EnterReturnsTrue | ImGui.InputTextFlags.AutoSelectAll);
  const cancelled = ImGui.IsKeyPressed(ImGui.Key.Escape, false);
  const committed = !cancelled && (enter || ImGui.IsItemDeactivated() || !focus && !ImGui.IsItemActive() && (!ownerFocused || ImGui.IsMouseClicked(ImGui.MouseButton.Left)));

  return { committed, cancelled };
}
