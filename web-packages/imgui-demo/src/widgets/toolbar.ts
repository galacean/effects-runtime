import { ImGui } from '../imgui';
import { EditorColors, EditorLayout } from '../panels/theme';

/**
 * 开始绘制工具栏区域。
 * 自动绘制背景色，内部可放置 Button / ToggleButton 等控件。
 * 必须与 endToolbar() 配对。
 *
 * @param id     唯一 ID
 * @param height 工具栏高度（默认 EditorLayout.toolbarHeight）
 * @returns      是否可见（始终为 true，保持 API 一致性）
 */
export function beginToolbar (id: string, height?: number): boolean {
  const h = height ?? EditorLayout.toolbarHeight;
  const drawList = ImGui.GetWindowDrawList();
  const cursorPos = ImGui.GetCursorScreenPos();
  const availWidth = ImGui.GetContentRegionAvail().x;

  // 绘制工具栏背景
  drawList.AddRectFilled(
    cursorPos,
    new ImGui.Vec2(cursorPos.x + availWidth, cursorPos.y + h),
    ImGui.GetColorU32(EditorColors.toolbarBg),
  );

  // 微调内部内容位置
  ImGui.SetCursorPosY(ImGui.GetCursorPosY() + 1);
  ImGui.SetCursorPosX(ImGui.GetCursorPosX() + 4);
  ImGui.PushID(id);

  return true;
}

/**
 * 结束工具栏区域。
 * 恢复光标到工具栏底部。
 */
export function endToolbar (): void {
  ImGui.PopID();
  ImGui.SetCursorPosY(ImGui.GetCursorPosY() - 2);
  ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(0, 0));
  ImGui.Dummy(new ImGui.Vec2(0, 0));
  ImGui.PopStyleVar();
}
