import { ImGui } from '../imgui';
import { editorColor, InteractionColors as I } from '../panels/theme/editor-interaction';
import { drawEditorIcon } from './editor-icons';
import type { EditorIcon } from './editor-icons';

const headingColor = new ImGui.Vec4(1, 1, 1, 0.25);
const menuBorder = editorColor('4C4C4C');
const menuFrames: boolean[] = [];

function pushMenuStyle (): void {
  ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(12, 6));
  ImGui.PushStyleVar(ImGui.StyleVar.ItemSpacing, new ImGui.Vec2(8, 4));
  ImGui.PushStyleVar(ImGui.StyleVar.FramePadding, new ImGui.Vec2(4, 2));
  ImGui.PushStyleVar(ImGui.StyleVar.PopupRounding, 0);
  ImGui.PushStyleVar(ImGui.StyleVar.PopupBorderSize, 1);
  ImGui.PushStyleColor(ImGui.Col.PopupBg, I.secondary);
  ImGui.PushStyleColor(ImGui.Col.Border, menuBorder);
  ImGui.PushStyleColor(ImGui.Col.Separator, headingColor);
  ImGui.PushStyleColor(ImGui.Col.HeaderHovered, I.primary);
  ImGui.PushStyleColor(ImGui.Col.HeaderActive, I.primary);
  ImGui.PushStyleColor(ImGui.Col.Header, I.primary);
  ImGui.PushStyleColor(ImGui.Col.Text, I.foreground);
  ImGui.PushStyleColor(ImGui.Col.TextDisabled, I.muted);
  ImGui.PushStyleColor(ImGui.Col.CheckMark, I.foreground);
}

function popMenuStyle (): void { ImGui.PopStyleColor(9); ImGui.PopStyleVar(5); }

export function withEditorMenuStyle (draw: () => void): void {
  pushMenuStyle();
  try { draw(); } finally { popMenuStyle(); }
}

function beginPopup (begin: () => boolean): boolean {
  pushMenuStyle();
  if (begin()) { return true; }
  popMenuStyle();

  return false;
}

export function beginEditorPopup (id: string, flags = ImGui.WindowFlags.None): boolean {
  return beginPopup(() => ImGui.BeginPopup(id, flags));
}

export function beginEditorContextItem (id?: string, flags = ImGui.PopupFlags.MouseButtonRight): boolean {
  return beginPopup(() => ImGui.BeginPopupContextItem(id, flags));
}

export function beginEditorContextWindow (id?: string, flags = ImGui.PopupFlags.MouseButtonRight): boolean {
  return beginPopup(() => ImGui.BeginPopupContextWindow(id, flags));
}

export function endEditorPopup (): void { ImGui.EndPopup(); popMenuStyle(); }

export function beginEditorMenu (label: string, enabled = true, menuBar = false): boolean {
  pushMenuStyle();
  const p = ImGui.GetCursorScreenPos(), parentDraw = ImGui.GetWindowDrawList();
  const wasOpened = ImGui.IsPopupOpen(label);

  if (menuBar) {
    const size = ImGui.CalcTextSize(label);
    const hovered = ImGui.IsMouseHoveringRect(p, new ImGui.Vec2(p.x + size.x + 16, p.y + ImGui.GetFrameHeight()));

    ImGui.PushStyleColor(ImGui.Col.Header, I.primary);
    ImGui.PushStyleColor(ImGui.Col.HeaderHovered, wasOpened ? I.primary : I.hover);
    ImGui.PushStyleColor(ImGui.Col.HeaderActive, I.primary);
    ImGui.PushStyleColor(ImGui.Col.Text, hovered || wasOpened ? I.foregroundHover : I.foreground);
  }
  const opened = ImGui.BeginMenu(label, enabled);

  if (!menuBar) {
    const min = ImGui.GetItemRectMin(), max = ImGui.GetItemRectMax();
    const highlighted = enabled && (wasOpened || opened || ImGui.IsItemHovered());

    parentDraw.AddRectFilled(new ImGui.Vec2(max.x - 24, min.y), max, ImGui.GetColorU32(highlighted ? I.primary : I.secondary));
    drawEditorIcon('chevronRight', max.x - 20, p.y + (ImGui.GetTextLineHeight() - 16) / 2, 16, enabled ? I.foreground : I.muted, parentDraw);
  }
  if (!opened) {
    if (menuBar) { ImGui.PopStyleColor(4); }
    popMenuStyle();

    return false;
  }
  if (menuBar) {
    ImGui.PushStyleColor(ImGui.Col.Header, I.primary);
    ImGui.PushStyleColor(ImGui.Col.HeaderHovered, I.primary);
    ImGui.PushStyleColor(ImGui.Col.HeaderActive, I.primary);
    ImGui.PushStyleColor(ImGui.Col.Text, I.foreground);
  }
  menuFrames.push(menuBar);

  return true;
}

export function endEditorMenu (): void {
  const menuBar = menuFrames.pop();

  if (menuBar) { ImGui.PopStyleColor(4); }
  ImGui.EndMenu();
  if (menuBar) { ImGui.PopStyleColor(4); }
  popMenuStyle();
}

export function editorMainMenuBar (draw: () => void): void {
  withEditorMenuStyle(() => {
    ImGui.PushStyleColor(ImGui.Col.MenuBarBg, I.panel);
    if (ImGui.BeginMainMenuBar()) {
      try { draw(); } finally { ImGui.EndMainMenuBar(); }
    }
    ImGui.PopStyleColor();
  });
}

export function editorPopup (id: string, draw: () => void): void {
  if (beginEditorPopup(id)) { try { draw(); } finally { endEditorPopup(); } }
}

export function editorIconMenuItem (label: string, icon: EditorIcon, enabled = true): boolean {
  const p = ImGui.GetCursorScreenPos();
  const gap = ' '.repeat(Math.ceil(22 / Math.max(1, ImGui.CalcTextSize(' ').x)));
  const clicked = editorMenuItem(gap + label, '', false, enabled);

  drawEditorIcon(icon, p.x, p.y + (ImGui.GetTextLineHeight() - 16) / 2, 16, enabled ? I.foreground : I.muted);

  return clicked;
}

export function editorMenuItem (label: string, shortcut?: string | null,
  selected: boolean | ImGui.Bind.ImScalar<boolean> | ImGui.Bind.ImAccess<boolean> | null = false, enabled = true): boolean {
  const p = ImGui.GetCursorScreenPos(), width = ImGui.GetContentRegionAvail().x;
  const hovered = enabled && ImGui.IsMouseHoveringRect(new ImGui.Vec2(p.x, p.y - 2), new ImGui.Vec2(p.x + width, p.y + ImGui.GetTextLineHeight() + 2));
  const checked = typeof selected === 'function' ? selected() : Array.isArray(selected) ? selected[0] : !!selected;

  ImGui.PushStyleColor(ImGui.Col.Text, hovered ? I.foregroundHover : I.foreground);
  const clicked = ImGui.MenuItem(label, shortcut ?? null, false, enabled);

  ImGui.PopStyleColor();
  if (checked) {
    const max = ImGui.GetItemRectMax();

    drawEditorIcon('check', max.x - 18, p.y + (ImGui.GetTextLineHeight() - 16) / 2, 16, enabled ? I.foregroundHover : I.muted);
  }
  if (clicked) {
    if (typeof selected === 'function') { selected(!checked); } else if (Array.isArray(selected)) { selected[0] = !checked; }
  }

  return clicked;
}

export function editorMenuSection (label: string, separated = false): void {
  if (separated) {
    ImGui.Spacing(); ImGui.Separator(); ImGui.Spacing();
  }
  const position = ImGui.GetCursorScreenPos();
  const size = Math.max(12, ImGui.GetFontSize() * 0.78);
  const scale = size / ImGui.GetFontSize();
  const spacing = size * 0.12;
  const color = ImGui.GetColorU32(headingColor);
  const dl = ImGui.GetWindowDrawList();
  let x = position.x;

  for (const character of label.toUpperCase()) {
    dl.AddText(ImGui.GetFont(), size, new ImGui.Vec2(Math.round(x), position.y + 6), color, character);
    x += ImGui.CalcTextSize(character).x * scale + spacing;
  }
  ImGui.Dummy(new ImGui.Vec2(Math.max(0, x - position.x - spacing), Math.ceil(size + 12)));
}
