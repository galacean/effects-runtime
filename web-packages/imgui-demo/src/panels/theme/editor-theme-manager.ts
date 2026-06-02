import { ImGui } from '../../imgui';
import { EditorColors, EditorLayout } from './editor-style';

/**
 * 编辑器主题管理器。
 * 将语义令牌（EditorColors / EditorLayout）映射到 ImGui 全局样式。
 */
export class EditorThemeManager {
  /**
   * 在 ImGui.CreateContext() 之后、首帧之前调用一次。
   * 替代原 main.ts 中的 styleBlack()。
   */
  static apply (): void {
    const style = ImGui.GetStyle();
    const c = style.Colors;

    // ── Colors → ImGuiCol_ 映射 ────────────────────────

    // 文本
    c[ImGui.ImGuiCol.Text] = EditorColors.textPrimary;
    c[ImGui.ImGuiCol.TextDisabled] = EditorColors.textDisabled;

    // 窗口
    c[ImGui.ImGuiCol.WindowBg] = EditorColors.windowBg;
    c[ImGui.ImGuiCol.ChildBg] = EditorColors.childBg;
    c[ImGui.ImGuiCol.PopupBg] = EditorColors.popupBg;

    // 边框
    c[ImGui.ImGuiCol.Border] = EditorColors.borderStrong;
    c[ImGui.ImGuiCol.BorderShadow] = new ImGui.Vec4(0, 0, 0, 0);

    // 输入框 / Frame
    c[ImGui.ImGuiCol.FrameBg] = EditorColors.inputBg;
    c[ImGui.ImGuiCol.FrameBgHovered] = EditorColors.buttonHovered;
    c[ImGui.ImGuiCol.FrameBgActive] = EditorColors.accentActive;

    // 标题栏
    c[ImGui.ImGuiCol.TitleBg] = EditorColors.titleBarBg;
    c[ImGui.ImGuiCol.TitleBgActive] = EditorColors.titleBarBg;
    c[ImGui.ImGuiCol.TitleBgCollapsed] = EditorColors.titleBarBg;

    // 菜单栏
    c[ImGui.ImGuiCol.MenuBarBg] = EditorColors.titleBarBg;

    // 滚动条
    c[ImGui.ImGuiCol.ScrollbarBg] = EditorColors.scrollbarBg;
    c[ImGui.ImGuiCol.ScrollbarGrab] = EditorColors.scrollbarGrab;
    c[ImGui.ImGuiCol.ScrollbarGrabHovered] = EditorColors.scrollbarHovered;
    c[ImGui.ImGuiCol.ScrollbarGrabActive] = EditorColors.scrollbarActive;

    // 选择标记 / 滑块
    c[ImGui.ImGuiCol.CheckMark] = EditorColors.checkMark;
    c[ImGui.ImGuiCol.SliderGrab] = EditorColors.sliderGrab;
    c[ImGui.ImGuiCol.SliderGrabActive] = EditorColors.accentPrimary;

    // 按钮
    c[ImGui.ImGuiCol.Button] = EditorColors.button;
    c[ImGui.ImGuiCol.ButtonHovered] = EditorColors.buttonHovered;
    c[ImGui.ImGuiCol.ButtonActive] = EditorColors.buttonActive;

    // Header（TreeNode, CollapsingHeader, Selectable）
    c[ImGui.ImGuiCol.Header] = EditorColors.header;
    c[ImGui.ImGuiCol.HeaderHovered] = EditorColors.headerHovered;
    c[ImGui.ImGuiCol.HeaderActive] = EditorColors.headerActive;

    // 分隔线
    c[ImGui.ImGuiCol.Separator] = EditorColors.separator;
    c[ImGui.ImGuiCol.SeparatorHovered] = EditorColors.buttonHovered;
    c[ImGui.ImGuiCol.SeparatorActive] = EditorColors.accentPrimary;

    // 调整大小手柄
    c[ImGui.ImGuiCol.ResizeGrip] = new ImGui.Vec4(0.035, 0.376, 0.820, 0.20);
    c[ImGui.ImGuiCol.ResizeGripHovered] = new ImGui.Vec4(0.035, 0.376, 0.820, 0.60);
    c[ImGui.ImGuiCol.ResizeGripActive] = new ImGui.Vec4(0.035, 0.376, 0.820, 0.90);

    // Tab 标签页
    c[ImGui.ImGuiCol.Tab] = EditorColors.tab;
    c[ImGui.ImGuiCol.TabHovered] = EditorColors.tabHovered;
    c[ImGui.ImGuiCol.TabActive] = EditorColors.tabActive;
    c[ImGui.ImGuiCol.TabUnfocused] = EditorColors.tab;
    c[ImGui.ImGuiCol.TabUnfocusedActive] = EditorColors.childBg;

    // 图表
    c[ImGui.ImGuiCol.PlotLines] = new ImGui.Vec4(0.30, 0.60, 1.00, 0.75);
    c[ImGui.ImGuiCol.PlotLinesHovered] = new ImGui.Vec4(0.09, 0.09, 0.09, 1.00);
    c[ImGui.ImGuiCol.PlotHistogram] = new ImGui.Vec4(0.85, 0.65, 0.00, 1.00);
    c[ImGui.ImGuiCol.PlotHistogramHovered] = new ImGui.Vec4(1.00, 0.70, 0.00, 1.00);

    // 文本选中
    c[ImGui.ImGuiCol.TextSelectedBg] = EditorColors.accentDim;

    // 拖放
    c[ImGui.ImGuiCol.DragDropTarget] = new ImGui.Vec4(1.0, 1.0, 0.0, 0.90);

    // 导航
    c[ImGui.ImGuiCol.NavHighlight] = EditorColors.accentPrimary;
    c[ImGui.ImGuiCol.NavWindowingHighlight] = new ImGui.Vec4(1.0, 1.0, 1.0, 0.70);
    c[ImGui.ImGuiCol.NavWindowingDimBg] = new ImGui.Vec4(0.8, 0.8, 0.8, 0.20);
    c[ImGui.ImGuiCol.ModalWindowDimBg] = new ImGui.Vec4(0.8, 0.8, 0.8, 0.35);

    // ── Layout → Style 属性 ────────────────────────────

    style.WindowRounding = EditorLayout.windowRounding;
    style.ChildRounding = EditorLayout.childRounding;
    style.FrameRounding = EditorLayout.frameRounding;
    style.PopupRounding = EditorLayout.popupRounding;
    style.ScrollbarRounding = EditorLayout.scrollbarRounding;
    style.GrabRounding = EditorLayout.grabRounding;

    style.FramePadding.x = EditorLayout.framePadding.x;
    style.FramePadding.y = EditorLayout.framePadding.y;
    style.ItemSpacing.x = EditorLayout.itemSpacing.x;
    style.ItemSpacing.y = EditorLayout.itemSpacing.y;
    style.ItemInnerSpacing.x = EditorLayout.itemInnerSpacing.x;
    style.ItemInnerSpacing.y = EditorLayout.itemInnerSpacing.y;
    style.IndentSpacing = EditorLayout.indentSpacing;

    style.ScrollbarSize = EditorLayout.scrollbarSize;
    style.GrabMinSize = EditorLayout.grabMinSize;

    style.WindowBorderSize = EditorLayout.windowBorderSize;
    style.ChildBorderSize = EditorLayout.childBorderSize;
    style.FrameBorderSize = EditorLayout.frameBorderSize;
    style.TabBorderSize = EditorLayout.tabBorderSize;
  }
}
