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
  const frameHeight = Math.max(ImGui.GetFrameHeight(), 22);
  const frameRounding = 4;
  const leftPadding = 8;
  const iconSize = 12;
  const iconSpacing = 8;
  const clearButtonSize = 16;
  const rightPadding = 6;
  const drawList = ImGui.GetWindowDrawList();
  const cursorLocalPos = ImGui.GetCursorPos();
  const cursorScreenPos = ImGui.GetCursorScreenPos();
  const frameMin = cursorScreenPos;
  const frameMax = new ImGui.Vec2(cursorScreenPos.x + availWidth, cursorScreenPos.y + frameHeight);
  const textLineHeight = ImGui.GetTextLineHeight();
  const inputPaddingY = Math.max(2, Math.floor((frameHeight - textLineHeight) * 0.5));

  let filterText = '';

  if (typeof buffer === 'function') {
    filterText = (buffer as () => string)();
  } else if (Array.isArray(buffer)) {
    filterText = (buffer as string[])[0] ?? '';
  }

  const hasClearButton = showClearButton && filterText.length > 0;
  const textStartX = frameMin.x + leftPadding + iconSize + iconSpacing;
  const textWidth = availWidth - (textStartX - frameMin.x) - (hasClearButton ? clearButtonSize + rightPadding + 4 : rightPadding + 2);

  drawList.ChannelsSplit(3);
  drawList.ChannelsSetCurrent(1);

  ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FramePadding, new ImGui.Vec2(0, inputPaddingY));
  ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FrameBorderSize, 0);
  ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FrameRounding, 0);
  ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBg, new ImGui.Vec4(0, 0, 0, 0));
  ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBgHovered, new ImGui.Vec4(0, 0, 0, 0));
  ImGui.PushStyleColor(ImGui.ImGuiCol.FrameBgActive, new ImGui.Vec4(0, 0, 0, 0));
  ImGui.PushStyleColor(ImGui.ImGuiCol.Border, new ImGui.Vec4(0, 0, 0, 0));
  ImGui.PushStyleColor(ImGui.ImGuiCol.TextSelectedBg, EditorColors.accentDim);

  ImGui.SetCursorScreenPos(new ImGui.Vec2(textStartX, frameMin.y));
  ImGui.PushItemWidth(Math.max(32, textWidth));
  ImGui.SetNextItemAllowOverlap();
  const changed = ImGui.InputTextWithHint(id, 'Search', buffer, bufferSize);
  const inputHovered = ImGui.IsItemHovered();
  const inputActive = ImGui.IsItemActive() || ImGui.IsItemFocused();

  ImGui.PopItemWidth();

  ImGui.PopStyleColor(5);
  ImGui.PopStyleVar(3);

  const isFrameHovered = inputHovered || ImGui.IsMouseHoveringRect(frameMin, frameMax, false);
  const backgroundColor = inputActive
    ? new ImGui.Vec4(0.082, 0.082, 0.086, 1.0)
    : isFrameHovered
      ? new ImGui.Vec4(0.075, 0.075, 0.079, 1.0)
      : new ImGui.Vec4(0.067, 0.067, 0.071, 1.0);
  const borderColor = inputActive
    ? new ImGui.Vec4(0.23, 0.43, 0.72, 0.65)
    : isFrameHovered
      ? new ImGui.Vec4(0.24, 0.24, 0.25, 1.0)
      : new ImGui.Vec4(0.16, 0.16, 0.17, 1.0);
  const iconColor = ImGui.GetColorU32(inputActive
    ? new ImGui.Vec4(0.78, 0.82, 0.86, 1.0)
    : new ImGui.Vec4(0.60, 0.65, 0.70, 1.0));

  drawList.ChannelsSetCurrent(0);
  drawList.AddRectFilled(frameMin, frameMax, ImGui.GetColorU32(backgroundColor), frameRounding);
  drawList.AddRect(frameMin, frameMax, ImGui.GetColorU32(borderColor), frameRounding, 0, 1.0);

  drawList.ChannelsSetCurrent(2);

  // ── 放大镜图标 ──
  const circleCenter = new ImGui.Vec2(
    frameMin.x + leftPadding + iconSize * 0.5,
    frameMin.y + frameHeight * 0.5,
  );
  const lensRadius = iconSize * 0.34;
  const strokeThickness = 1.75;
  const handleStart = new ImGui.Vec2(
    circleCenter.x + lensRadius * 0.62,
    circleCenter.y + lensRadius * 0.62,
  );
  const handleEnd = new ImGui.Vec2(
    circleCenter.x + lensRadius * 1.7,
    circleCenter.y + lensRadius * 1.7,
  );

  drawList.AddCircle(circleCenter, lensRadius, iconColor, 20, strokeThickness);
  drawList.AddLine(handleStart, handleEnd, iconColor, strokeThickness);

  // ── 清除按钮 ──
  if (hasClearButton) {
    const btnX = frameMax.x - clearButtonSize - rightPadding;
    const btnY = frameMin.y + (frameHeight - clearButtonSize) * 0.5;

    ImGui.SetCursorScreenPos(new ImGui.Vec2(btnX, btnY));

    if (ImGui.InvisibleButton(`${id}_Clear`, new ImGui.Vec2(clearButtonSize, clearButtonSize))) {
      if (typeof buffer === 'object' && Array.isArray(buffer)) {
        (buffer as string[])[0] = '';
      } else if (typeof buffer === 'function') {
        (buffer as (v: string) => void)('');
      }
      drawList.ChannelsMerge();
      ImGui.SetCursorPos(cursorLocalPos);
      ImGui.Dummy(new ImGui.Vec2(availWidth, frameHeight));

      return true;
    }

    const isHovered = ImGui.IsItemHovered();

    if (isHovered) {
      ImGui.SetMouseCursor(ImGui.ImGuiMouseCursor.Arrow);
      drawList.AddRectFilled(
        new ImGui.Vec2(btnX, btnY),
        new ImGui.Vec2(btnX + clearButtonSize, btnY + clearButtonSize),
        ImGui.GetColorU32(new ImGui.Vec4(1, 1, 1, 0.08)),
        3,
      );
    }

    const pad = 4.5;
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
  }

  drawList.ChannelsMerge();
  ImGui.SetCursorPos(cursorLocalPos);
  ImGui.Dummy(new ImGui.Vec2(availWidth, frameHeight));

  return changed;
}
