import { ImGui } from '../imgui';
import { EditorColors } from '../panels/theme';

export type SearchBarOptions = {
  /** 是否显示清除按钮（默认 true） */
  showClearButton?: boolean,
  /** 缓冲区大小（默认 256） */
  bufferSize?: number,
};

/**
 * 统一搜索栏控件：放大镜图标 + InputText + 可选清除按钮。
 *
 * @param id      唯一 ID（如 '##HierarchySearch'）
 * @param buffer  ImGui.ImStringBuffer 或字符串访问器
 * @param opts    配置项
 * @returns       filter 文本是否发生变化
 */
export function searchBar (
  id: string,
  buffer: ImGui.ImStringBuffer | ImGui.Bind.ImAccess<string> | ImGui.Bind.ImScalar<string>,
  opts: SearchBarOptions = {},
): boolean {
  const { showClearButton = true, bufferSize = 256 } = opts;

  const availWidth = ImGui.GetContentRegionAvail().x;
  const iconSize = 16;
  const iconPadding = 4;
  const clearButtonSize = 18;
  const frameHeight = ImGui.GetFrameHeight();
  const drawList = ImGui.GetWindowDrawList();
  const cursorPos = ImGui.GetCursorScreenPos();
  const iconColor = ImGui.GetColorU32(EditorColors.iconDefault);

  // ── 放大镜图标 ──
  const circleCenter = new ImGui.Vec2(
    cursorPos.x + iconSize * 0.4,
    cursorPos.y + frameHeight * 0.4,
  );
  const circleRadius = iconSize * 0.28;

  drawList.AddCircle(circleCenter, circleRadius, iconColor, 12, 1.5);

  const handleStart = new ImGui.Vec2(
    circleCenter.x + circleRadius * 0.7,
    circleCenter.y + circleRadius * 0.7,
  );
  const handleEnd = new ImGui.Vec2(
    circleCenter.x + circleRadius * 1.8,
    circleCenter.y + circleRadius * 1.8,
  );

  drawList.AddLine(handleStart, handleEnd, iconColor, 1.5);

  // ── 输入框 ──
  const inputStartX = ImGui.GetCursorPosX() + iconSize + iconPadding;

  ImGui.SetCursorPosX(inputStartX);
  ImGui.PushItemWidth(availWidth - iconSize - iconPadding);

  const changed = ImGui.InputText(id, buffer, bufferSize);

  ImGui.SetItemAllowOverlap();

  const inputRectMin = ImGui.GetItemRectMin();
  const inputRectMax = ImGui.GetItemRectMax();
  const postInputCursor = ImGui.GetCursorPos();

  ImGui.PopItemWidth();

  // ── 清除按钮 ──
  let filterText = '';

  if (typeof buffer === 'function') {
    filterText = (buffer as () => string)();
  } else if (Array.isArray(buffer)) {
    filterText = (buffer as string[])[0] ?? '';
  }
  const hasClearButton = showClearButton && filterText.length > 0;

  if (hasClearButton) {
    const btnX = inputRectMax.x - clearButtonSize - 2;
    const btnY = inputRectMin.y + (frameHeight - clearButtonSize) / 2;

    ImGui.SetCursorScreenPos(new ImGui.Vec2(btnX, btnY));

    if (ImGui.InvisibleButton(`${id}_Clear`, new ImGui.Vec2(clearButtonSize, clearButtonSize))) {
      // 清空 buffer
      if (typeof buffer === 'object' && Array.isArray(buffer)) {
        (buffer as string[])[0] = '';
      } else if (typeof buffer === 'function') {
        (buffer as (v: string) => void)('');
      }
      ImGui.SetCursorPos(postInputCursor);

      return true;
    }

    const isHovered = ImGui.IsItemHovered();

    if (isHovered) {
      ImGui.SetMouseCursor(ImGui.ImGuiMouseCursor.Arrow);
      drawList.AddRectFilled(
        new ImGui.Vec2(btnX, btnY),
        new ImGui.Vec2(btnX + clearButtonSize, btnY + clearButtonSize),
        ImGui.GetColorU32(new ImGui.ImVec4(0.5, 0.5, 0.5, 0.3)),
        3,
      );
    }

    // 绘制 X 号
    const pad = 5;
    const crossColor = ImGui.GetColorU32(isHovered ? EditorColors.iconActive : EditorColors.iconDefault);

    drawList.AddLine(
      new ImGui.Vec2(btnX + pad, btnY + pad),
      new ImGui.Vec2(btnX + clearButtonSize - pad, btnY + clearButtonSize - pad),
      crossColor, 1.5,
    );
    drawList.AddLine(
      new ImGui.Vec2(btnX + clearButtonSize - pad, btnY + pad),
      new ImGui.Vec2(btnX + pad, btnY + clearButtonSize - pad),
      crossColor, 1.5,
    );

    ImGui.SetCursorPos(postInputCursor);
  }

  return changed;
}
