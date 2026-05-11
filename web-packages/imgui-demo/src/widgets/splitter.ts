import { ImGui } from '../imgui';
import { EditorColors } from '../panels/theme';

type SplitterDragState = {
  startMouseAxis: number,
  startValue: number,
};

const splitterDragStates = new Map<number, SplitterDragState>();

export type SplitterOptions = {
  /** 分割方向 */
  direction?: 'horizontal' | 'vertical',
  /** 分割条宽度（像素） */
  thickness?: number,
  /** 分割条可视长度；不传时使用当前内容区剩余长度 */
  length?: number,
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
    length,
    min = 50,
    max = 600,
    invert = false,
    colors,
  } = opts;

  const isHorizontal = direction === 'horizontal';
  const dragKey = ImGui.GetID(id);
  const clampedMax = Math.max(min, max);
  const splitterLength = length ?? (isHorizontal
    ? ImGui.GetContentRegionAvail().y
    : ImGui.GetContentRegionAvail().x);
  const size = isHorizontal
    ? new ImGui.Vec2(thickness, splitterLength)
    : new ImGui.Vec2(splitterLength, thickness);

  const normalColor = colors?.normal ?? EditorColors.separator;
  const hoveredColor = colors?.hovered ?? EditorColors.buttonHovered;
  const activeColor = colors?.active ?? EditorColors.accentPrimary;
  const drawList = ImGui.GetWindowDrawList();
  const foregroundDrawList = ImGui.GetForegroundDrawList();
  const mousePos = ImGui.GetMousePos();
  const currentMouseAxis = isHorizontal ? mousePos.x : mousePos.y;

  ImGui.InvisibleButton(id, size);

  const itemMin = ImGui.GetItemRectMin();
  const itemMax = ImGui.GetItemRectMax();
  const isHovered = ImGui.IsItemHovered();
  const isActive = ImGui.IsItemActive();

  if (ImGui.IsItemActivated()) {
    splitterDragStates.set(dragKey, {
      startMouseAxis: currentMouseAxis,
      startValue: value,
    });
  }

  if (isHovered || isActive) {
    ImGui.SetMouseCursor(
      isHorizontal ? ImGui.MouseCursor.ResizeEW : ImGui.MouseCursor.ResizeNS,
    );
  }

  let result = value;
  const dragState = splitterDragStates.get(dragKey);

  if (isActive && dragState) {
    const delta = currentMouseAxis - dragState.startMouseAxis;
    const proposedValue = dragState.startValue + (invert ? -delta : delta);

    result = Math.max(min, Math.min(clampedMax, proposedValue));
  }

  if (ImGui.IsItemDeactivated()) {
    splitterDragStates.delete(dragKey);
  }

  const visibleColor = isActive
    ? activeColor
    : isHovered
      ? hoveredColor
      : normalColor;
  const visibleColorU32 = ImGui.GetColorU32(visibleColor);

  if (isActive) {
    const baseAxis = isHorizontal
      ? Math.floor((itemMin.x + itemMax.x) * 0.5) + 0.5
      : Math.floor((itemMin.y + itemMax.y) * 0.5) + 0.5;
    const directionSign = invert ? -1 : 1;
    const actualAxis = Math.floor(baseAxis + (result - value) * directionSign) + 0.5;

    if (isHorizontal) {
      foregroundDrawList.AddLine(
        new ImGui.Vec2(actualAxis, itemMin.y),
        new ImGui.Vec2(actualAxis, itemMax.y),
        visibleColorU32,
        1,
      );
    } else {
      foregroundDrawList.AddLine(
        new ImGui.Vec2(itemMin.x, actualAxis),
        new ImGui.Vec2(itemMax.x, actualAxis),
        visibleColorU32,
        1,
      );
    }
  } else if (isHorizontal) {
    const lineX = Math.floor((itemMin.x + itemMax.x) * 0.5) + 0.5;

    drawList.AddLine(
      new ImGui.Vec2(lineX, itemMin.y),
      new ImGui.Vec2(lineX, itemMax.y),
      visibleColorU32,
      1,
    );
  } else {
    const lineY = Math.floor((itemMin.y + itemMax.y) * 0.5) + 0.5;

    drawList.AddLine(
      new ImGui.Vec2(itemMin.x, lineY),
      new ImGui.Vec2(itemMax.x, lineY),
      visibleColorU32,
      1,
    );
  }

  return result;
}
