import { ImGui } from '../imgui';
import { EditorColors } from '../panels/theme';

/**
 * 开始一个可折叠面板。
 * 内部使用 BeginChild + CollapsingHeader 组合，自动管理 Push/Pop。
 * 必须与 endCollapsiblePanel() 配对调用。
 *
 * @param label         面板标题（同时用作 ID）
 * @param initiallyOpen 初始是否展开（默认 true）
 * @returns             面板内容是否可见（用于条件绘制内部控件）
 *
 * @example
 * if (beginCollapsiblePanel('Transform')) {
 *   // 绘制内容...
 * }
 * endCollapsiblePanel();
 */
export function beginCollapsiblePanel (label: string, initiallyOpen = true): boolean {
  ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, EditorColors.childBg);
  ImGui.PushStyleVar(ImGui.StyleVar.ChildRounding, 0);

  const visible = ImGui.BeginChild(
    label,
    new ImGui.Vec2(0, 0),
    ImGui.ChildFlags.Borders | ImGui.ChildFlags.AlwaysUseWindowPadding,
    ImGui.WindowFlags.AlwaysAutoResize,
  );

  ImGui.PopStyleVar();
  ImGui.PopStyleColor();

  if (visible) {
    // Header 区域使用与 childBg 相同的颜色，消除高亮干扰
    ImGui.PushStyleColor(ImGui.ImGuiCol.Header, EditorColors.childBg);
    ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, EditorColors.childBg);
    ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, EditorColors.childBg);
    ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(2, 4));
    ImGui.SetNextItemOpen(initiallyOpen, ImGui.ImGuiCond.FirstUseEver);

    const contentVisible = ImGui.CollapsingHeader(label);

    ImGui.PopStyleVar();
    ImGui.PopStyleColor(3);

    return contentVisible;
  }

  return false;
}

/**
 * 结束可折叠面板。
 */
export function endCollapsiblePanel (): void {
  ImGui.EndChild();
}
