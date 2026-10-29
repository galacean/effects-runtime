import { ImGui } from '../../platform/imgui/index';
import { drawEditorIcon } from '../icons/editor-icons';
import { InteractionColors as I } from '../theme/editor-interaction';
import { EditorColors } from '../theme/index';

export type SearchBarOptions = {
  /** 指定输入栏宽度，默认填满当前内容区域。 */
  width?: number,
  /** 输入为空时的提示文字，空字符串只显示搜索图标。 */
  hint?: string,
  /** 是否显示清除按钮（默认 true） */
  showClearButton?: boolean,
  /** 缓冲区大小（默认 256） */
  bufferSize?: number,
  rounding?: number,
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

  const availWidth = Math.min(opts.width ?? ImGui.GetContentRegionAvail().x, ImGui.GetContentRegionAvail().x);
  const frameHeight = Math.max(ImGui.GetFrameHeight(), 22);
  const frameRounding = opts.rounding ?? 4;
  const leftPadding = 4;
  const iconSize = 14;
  const iconSpacing = 4;
  const clearButtonSize = 14;
  const rightPadding = 4;
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
  const changed = ImGui.InputTextWithHint(id, opts.hint ?? 'Search', buffer, bufferSize);
  const inputHovered = ImGui.IsItemHovered();
  const inputActive = ImGui.IsItemActive() || ImGui.IsItemFocused();

  ImGui.PopItemWidth();

  ImGui.PopStyleColor(5);
  ImGui.PopStyleVar(3);

  const isFrameHovered = inputHovered || ImGui.IsMouseHoveringRect(frameMin, frameMax, false);
  const borderColor = inputActive ? I.primary : isFrameHovered ? I.hover : I.secondary;
  const iconTint = inputActive ? I.foregroundHover : I.foreground;

  drawList.ChannelsSetCurrent(0);
  drawList.AddRectFilled(frameMin, frameMax, ImGui.GetColorU32(I.input), frameRounding);
  drawList.AddRect(frameMin, frameMax, ImGui.GetColorU32(borderColor), frameRounding, 0, 1.0);

  drawList.ChannelsSetCurrent(2);

  drawEditorIcon('search', frameMin.x + leftPadding, frameMin.y + (frameHeight - iconSize) / 2, iconSize, iconTint);

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

    drawEditorIcon('searchClear', btnX, btnY, clearButtonSize, isHovered ? I.foregroundHover : I.foreground);
  }

  drawList.ChannelsMerge();
  ImGui.SetCursorPos(cursorLocalPos);
  ImGui.Dummy(new ImGui.Vec2(availWidth, frameHeight));

  return changed;
}
