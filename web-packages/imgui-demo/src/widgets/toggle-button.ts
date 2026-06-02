import { ImGui } from '../imgui';
import { EditorColors } from '../panels/theme';
import { ScopedColor, ScopedVar } from './scoped-style';

export type ToggleButtonOptions = {
  /** 按钮尺寸（默认自动） */
  size?: ImGui.Vec2,
  /** 自定义颜色 */
  colors?: {
    active?: ImGui.Vec4,
    activeHovered?: ImGui.Vec4,
    normal?: ImGui.Vec4,
    normalHovered?: ImGui.Vec4,
  },
};

/**
 * 切换按钮，根据 active 状态显示不同样式。
 *
 * @param label  按钮标签
 * @param active 当前状态
 * @param opts   配置项
 * @returns      点击后切换的新状态
 *
 * @example
 * this.is2DMode = toggleButton('2D', this.is2DMode, { size: new ImGui.Vec2(32, 20) });
 */
export function toggleButton (label: string, active: boolean, opts: ToggleButtonOptions = {}): boolean {
  const { size, colors } = opts;

  const activeColor = colors?.active ?? EditorColors.buttonActive;
  const activeHoveredColor = colors?.activeHovered ?? EditorColors.accentPrimary;
  const normalColor = colors?.normal ?? EditorColors.button;
  const normalHoveredColor = colors?.normalHovered ?? EditorColors.buttonHovered;

  const sc = new ScopedColor(
    [ImGui.ImGuiCol.Button, active ? activeColor : normalColor],
    [ImGui.ImGuiCol.ButtonHovered, active ? activeHoveredColor : normalHoveredColor],
    [ImGui.ImGuiCol.ButtonActive, activeColor],
  );
  const sv = new ScopedVar(
    [ImGui.StyleVar.FrameRounding, 2.0],
    [ImGui.StyleVar.FramePadding, new ImGui.Vec2(8, 2)],
  );

  let result = active;

  if (ImGui.Button(label, size ?? new ImGui.Vec2(0, 0))) {
    result = !active;
  }

  sv.pop();
  sc.pop();

  return result;
}
