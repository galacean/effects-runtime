import { editorTooltip } from './editor-tooltip';
import { ImGui } from '../../platform/imgui';
import type { EditorIcon } from '../icons/editor-icons';
import { drawEditorIcon } from '../icons/editor-icons';
import { editorButtonColors, InteractionColors as I } from '../theme/editor-interaction';
import { drawEditorChevron } from './editor-arrow';

export interface ToolbarButtonOptions {
  icon?: EditorIcon,
  drawIcon?: (x: number, y: number, size: number, tint: ImGui.Vec4) => void,
  label?: string,
  width?: number,
  height?: number,
  iconSize?: number,
  iconLeft?: number,
  labelLeft?: number,
  checked?: boolean,
  enabled?: boolean,
  dropdown?: boolean,
  appearance?: 'plain' | 'filled' | 'toggle',
  tint?: ImGui.Vec4,
  checkedTint?: ImGui.Vec4,
  colors?: [ImGui.Vec4, ImGui.Vec4, ImGui.Vec4],
  hint?: string,
}

export function toolbarButton (id: string, options: ToolbarButtonOptions = {}): boolean {
  const height = options.height ?? 26, size = options.iconSize ?? 16;
  const hasIcon = !!options.icon || !!options.drawIcon;
  const width = options.width ?? (options.label ? ImGui.CalcTextSize(options.label).x + (hasIcon ? 34 : 16) + (options.dropdown ? 18 : 0) : height + (options.dropdown ? 14 : 0));
  const enabled = options.enabled !== false, checked = !!options.checked;
  const filled = options.appearance === 'toggle' && checked;
  const colors = options.colors ?? (options.appearance === 'filled' ? [I.secondary, I.hover, I.header] : editorButtonColors(checked, filled));

  ImGui.BeginDisabled(!enabled);
  colors.forEach((color, index) => ImGui.PushStyleColor([ImGui.Col.Button, ImGui.Col.ButtonHovered, ImGui.Col.ButtonActive][index], color));
  const clicked = ImGui.Button(id.startsWith('##') ? id : '##' + id, new ImGui.Vec2(width, height));
  const p = ImGui.GetItemRectMin(), hovered = ImGui.IsItemHovered();
  const tint = !enabled ? I.muted : filled ? I.foregroundHover : checked ? options.checkedTint ?? I.primaryHover : hovered ? I.foregroundHover : options.tint ?? I.foreground;
  const iconX = p.x + (options.iconLeft ?? (options.label || options.dropdown ? 6 : (width - size) / 2));
  const iconY = p.y + (height - size) / 2;

  if (options.drawIcon) { options.drawIcon(iconX, iconY, size, tint); } else if (options.icon) { drawEditorIcon(options.icon, iconX, iconY, size, tint); }
  if (options.label) { ImGui.GetWindowDrawList().AddText(new ImGui.Vec2(p.x + (options.labelLeft ?? (hasIcon ? 28 : 8)), p.y + (height - ImGui.GetTextLineHeight()) / 2), ImGui.GetColorU32(tint), options.label); }
  if (options.dropdown) { drawEditorChevron(p.x + width - 18, p.y + (height - 16) / 2, 16, tint); }
  if (options.hint && ImGui.IsItemHovered(ImGui.HoveredFlags.AllowWhenDisabled)) { editorTooltip(options.hint); }
  ImGui.PopStyleColor(3); ImGui.EndDisabled();

  return clicked;
}

export function toolbarSeparator (height: number, spacing = 5): void {
  ImGui.SameLine(0, spacing);
  const p = ImGui.GetCursorScreenPos();

  ImGui.GetWindowDrawList().AddLine(new ImGui.Vec2(p.x, p.y + 3), new ImGui.Vec2(p.x, p.y + height - 3), ImGui.GetColorU32(I.outline));
  ImGui.Dummy(new ImGui.Vec2(1, height)); ImGui.SameLine(0, spacing);
}
