import { ImGui } from '../imgui';
import { EditorColors } from '../panels/theme';
import { ScopedColor, ScopedVar } from './scoped-style';

export type SplitterOptions = {
  /** 分割方向 */
  direction?: 'horizontal' | 'vertical',
  /** 分割条宽度（像素） */
  thickness?: number,
  /** 最小值 */
  min?: number,
  /** 最大值 */
  max?: number,
  /** 是否反转拖拽方向 */
  invert?: boolean,
  /** 自定义颜色（默认使用 EditorColors.splitter*） */
  colors?: {
    normal?: ImGui.Vec4,
    hovered?: ImGui.Vec4,
    active?: ImGui.Vec4,
  },
};

/**
 * 可拖拽分割条。
 *
 * @param id     唯一 ID（推荐 ##xxx 格式）
 * @param value  当前分割值（宽度/高度）
 * @param opts   配置项
 * @returns      拖拽后的新值
 *
 * @example
 * ImGui.BeginChild('Left', new ImGui.Vec2(leftWidth, 0));
 * // ...
 * ImGui.EndChild();
 * ImGui.SameLine();
 * leftWidth = splitter('##Splitter', leftWidth, { min: 150, max: 600 });
 * ImGui.SameLine();
 * ImGui.BeginChild('Right', new ImGui.Vec2(0, 0));
 */
export function splitter (id: string, value: number, opts: SplitterOptions = {}): number {
  const {
    direction = 'horizontal',
    thickness = 2,
    min = 50,
    max = 600,
    invert = false,
    colors,
  } = opts;

  const isHorizontal = direction === 'horizontal';
  const size = isHorizontal
    ? new ImGui.Vec2(thickness, ImGui.GetContentRegionAvail().y)
    : new ImGui.Vec2(ImGui.GetContentRegionAvail().x, thickness);

  const normalColor = colors?.normal ?? EditorColors.splitterNormal;
  const hoveredColor = colors?.hovered ?? EditorColors.splitterHovered;
  const activeColor = colors?.active ?? EditorColors.splitterActive;

  const sc = new ScopedColor(
    [ImGui.ImGuiCol.Button, normalColor],
    [ImGui.ImGuiCol.ButtonHovered, hoveredColor],
    [ImGui.ImGuiCol.ButtonActive, activeColor],
  );
  const sv = new ScopedVar(
    [ImGui.StyleVar.FrameRounding, 0.0],
  );

  ImGui.Button(id, size);

  sv.pop();
  sc.pop();

  if (ImGui.IsItemHovered()) {
    ImGui.SetMouseCursor(
      isHorizontal ? ImGui.MouseCursor.ResizeEW : ImGui.MouseCursor.ResizeNS,
    );
  }

  let result = value;

  if (ImGui.IsItemActive()) {
    const delta = isHorizontal
      ? ImGui.GetIO().MouseDelta.x
      : ImGui.GetIO().MouseDelta.y;

    result += invert ? -delta : delta;
    result = Math.max(min, Math.min(max, result));
  }

  return result;
}
