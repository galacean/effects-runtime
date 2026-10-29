import { ImGui } from '../../platform/imgui/index';

export function editorColor (hex: string, alpha = 1): ImGui.Vec4 {
  return new ImGui.Vec4(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, alpha);
}

export function editorColorU32 (color: ImGui.Vec4): number { return ImGui.COL32(Math.round(color.x * 255), Math.round(color.y * 255), Math.round(color.z * 255), Math.round(color.w * 255)); }

export const InteractionColors = {
  background: editorColor('151515'), recessed: editorColor('1A1A1A'), panel: editorColor('242424'),
  header: editorColor('2F2F2F'), parentHover: editorColor('434343'), secondary: editorColor('383838'),
  input: editorColor('0F0F0F'), outline: editorColor('383838'), hover: editorColor('575757'),
  primary: editorColor('0070E0'), primaryHover: editorColor('0E86FF'), primaryPress: editorColor('0050A0'),
  selectedInactive: editorColor('40576F'), selectedParent: editorColor('2C323A'),
  foreground: editorColor('C0C0C0'), foregroundHover: editorColor('FFFFFF'), muted: editorColor('808080'),
  transparent: editorColor('000000', 0),
};

export interface RowInteraction {
  selected?: boolean,
  hovered?: boolean,
  focused?: boolean,
  parent?: boolean,
  parentHighlighted?: boolean,
  alternate?: boolean,
}

export function editorRowColors (state: RowInteraction): { background: ImGui.Vec4, foreground: ImGui.Vec4 } {
  const c = InteractionColors;
  const background = state.selected ? state.focused === false ? c.selectedInactive : c.primary :
    state.hovered ? state.parent ? c.parentHover : c.panel : state.parentHighlighted ? c.selectedParent :
      state.parent ? c.header : state.alternate ? c.background : c.recessed;

  return { background, foreground: state.selected ? c.foregroundHover : c.foreground };
}

export function editorTileColor (selected: boolean, hovered: boolean, focused = true): ImGui.Vec4 {
  const c = InteractionColors;

  return selected ? focused ? hovered ? c.primaryHover : c.primary : c.selectedInactive : hovered ? c.hover : c.secondary;
}

export function editorButtonColors (active = false, filled = false): [ImGui.Vec4, ImGui.Vec4, ImGui.Vec4] {
  const c = InteractionColors;

  return filled && active ? [c.primary, c.primaryHover, c.primaryPress] : [c.transparent, c.hover, c.secondary];
}

export function editorColumnTint (hovered: boolean, rowHovered: boolean, active = false): ImGui.Vec4 {
  return active ? InteractionColors.foregroundHover : new ImGui.Vec4(1, 1, 1, hovered ? 0.8 : rowHovered ? 0.25 : 0.1);
}
