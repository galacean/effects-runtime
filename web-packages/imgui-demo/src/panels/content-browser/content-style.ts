import { ImGui } from '../../imgui';
import { ASSET_ICON_COLORS, ASSET_TYPE_COLORS } from '../../widgets/asset-icons';
import { drawEditorIcon } from '../../widgets/editor-icons';
import type { EditorIcon } from '../../widgets/editor-icons';
import { editorButtonColors, editorColorU32, InteractionColors as I } from '../theme/editor-interaction';

export const CONTENT_COLORS = {
  panel: editorColorU32(I.recessed), toolbar: editorColorU32(I.panel), recessed: editorColorU32(I.input),
  secondary: editorColorU32(I.secondary), hover: editorColorU32(I.hover), border: editorColorU32(I.input),
  text: editorColorU32(I.foreground), white: editorColorU32(I.foregroundHover), muted: editorColorU32(I.muted),
  faint: ImGui.COL32(80, 80, 80, 255), selection: editorColorU32(I.primary), selectionInactive: editorColorU32(I.selectedInactive),
  selectionHover: editorColorU32(I.primaryHover), selectionInactiveHover: editorColorU32(I.selectedInactive), scene: ASSET_TYPE_COLORS.scene,
  green: ImGui.COL32(42, 112, 48, 255), greenHover: ImGui.COL32(53, 134, 60, 255), texture: ImGui.COL32(192, 64, 64, 255),
  folder: ASSET_ICON_COLORS.folder, danger: ImGui.COL32(210, 72, 72, 255), drop: ImGui.COL32(25, 132, 245, 255),
};

export type ContentIcon = 'add' | 'import' | 'save' | 'back' | 'forward' | 'down' | 'right' | 'folder' | 'folderOpen' | 'scene' |
'sources' | 'sourcesOpen' | 'search' | 'filter' | 'settings' | 'star' | 'collection' | 'texture' | 'project' | 'close' | 'check' | 'sort' | 'tiles' | 'list' | 'columns';

export function contentWindowBackground (): void {
  const origin = ImGui.GetCursorScreenPos(), position = ImGui.GetWindowPos(), size = ImGui.GetWindowSize();
  const draw = ImGui.GetWindowDrawList(), top = Math.min(origin.y, position.y + ImGui.GetFontSize());
  const min = new ImGui.Vec2(position.x, top), max = new ImGui.Vec2(position.x + size.x, position.y + size.y);

  draw.PushClipRect(min, max, false);
  draw.AddRectFilled(min, max, CONTENT_COLORS.panel); draw.PopClipRect();
}

const CONTENT_ICONS: Record<ContentIcon, EditorIcon> = {
  add: 'plus', import: 'import', save: 'save', back: 'historyBack', forward: 'historyForward', down: 'caretDown', right: 'caretRight',
  folder: 'folder', folderOpen: 'folderOpen', scene: 'scene', project: 'project', sources: 'sources', sourcesOpen: 'sourcesOpen', search: 'search', filter: 'filter',
  settings: 'settings', star: 'star', collection: 'collection', texture: 'texture', close: 'close', check: 'check', sort: 'sort', tiles: 'tiles', list: 'list', columns: 'columns',
};

export function contentIcon (icon: ContentIcon, x: number, y: number, size = 16, color = CONTENT_COLORS.text): void {
  const tint = new ImGui.Vec4((color & 255) / 255, ((color >>> 8) & 255) / 255, ((color >>> 16) & 255) / 255, (color >>> 24) / 255);

  const glyph = size >= 28 && (icon === 'folder' || icon === 'folderOpen') ? 'folderLarge' : size >= 28 && icon === 'scene' ? 'sceneLarge' : CONTENT_ICONS[icon];

  drawEditorIcon(glyph, x, y, size, tint);
}

export function contentButton (id: string, icon: ContentIcon, label = '', options: { width?: number, active?: boolean, disabled?: boolean, green?: boolean, dropdown?: boolean, hint?: string } = {}): boolean {
  const height = 26, size = ImGui.CalcTextSize(label), width = options.width ?? (label ? size.x + 34 + (options.dropdown ? 14 : 0) : 26);
  const p = ImGui.GetCursorScreenPos();

  ImGui.BeginDisabled(!!options.disabled);
  const clicked = ImGui.InvisibleButton(id, new ImGui.Vec2(width, height));
  const hovered = ImGui.IsItemHovered(), draw = ImGui.GetWindowDrawList();
  const [, hoverColor, pressColor] = editorButtonColors();
  const background = options.green ? hovered ? CONTENT_COLORS.greenHover : CONTENT_COLORS.green : ImGui.IsItemActive() ? ImGui.GetColorU32(pressColor) : hovered ? ImGui.GetColorU32(hoverColor) : 0;

  if (background) { draw.AddRectFilled(p, new ImGui.Vec2(p.x + width, p.y + height), options.disabled ? ((background & 0xffffff) | 0x60000000) >>> 0 : background, 3); }
  const color = options.disabled ? CONTENT_COLORS.faint : options.green ? CONTENT_COLORS.white : CONTENT_COLORS.text;

  contentIcon(icon, p.x + (label ? 7 : 5), p.y + 5, 16, options.active && !options.disabled ? CONTENT_COLORS.selectionHover : color);
  if (label) { draw.AddText(new ImGui.Vec2(p.x + 28, p.y + (height - size.y) / 2), color, label); }
  if (options.dropdown) { contentIcon('down', p.x + width - 16, p.y + 5, 14, color); }
  if (options.hint && ImGui.IsItemHovered(ImGui.HoveredFlags.AllowWhenDisabled | ImGui.HoveredFlags.DelayNormal)) { ImGui.SetTooltip(options.hint); }
  ImGui.EndDisabled();

  return clicked;
}

export function contentText (text: string, x: number, y: number, color = CONTENT_COLORS.text, maxWidth = Infinity, size = ImGui.GetFontSize()): void {
  const scale = size / ImGui.GetFontSize();
  let value = text;

  if (ImGui.CalcTextSize(value).x * scale > maxWidth) {
    while (value && ImGui.CalcTextSize(value + '…').x * scale > maxWidth) { value = value.slice(0, -1); }
    value += '…';
  }
  ImGui.GetWindowDrawList().AddText(ImGui.GetFont(), size, new ImGui.Vec2(Math.round(x), Math.round(y)), color, value);
}

export function contentWrappedText (text: string, x: number, y: number, width: number, lines: number, color: number, centered = false): void {
  const characters = Array.from(text), lineHeight = ImGui.GetTextLineHeight();

  for (let row = 0; row < lines && characters.length; row++) {
    let count = 0;

    while (count < characters.length && ImGui.CalcTextSize(characters.slice(0, count + 1).join('')).x <= width) { count++; }
    count = Math.max(1, count);
    if (row === lines - 1) { count = characters.length; } else if (count < characters.length) {
      const space = characters.slice(0, count).lastIndexOf(' ');

      if (space > count / 2) { count = space; }
    }
    const value = characters.splice(0, count).join('').trim();

    while (characters[0] === ' ') { characters.shift(); }
    const offset = centered ? Math.max(0, (width - ImGui.CalcTextSize(value).x) / 2) : 0;

    contentText(value, x + offset, y + row * lineHeight, color, width);
  }
}

export function checkerboard (x: number, y: number, width: number, height: number, cell = 10): void {
  const draw = ImGui.GetWindowDrawList();

  draw.PushClipRect(new ImGui.Vec2(x, y), new ImGui.Vec2(x + width, y + height), true);
  for (let row = 0; row < Math.ceil(height / cell); row++) {
    for (let col = 0; col < Math.ceil(width / cell); col++) {
      draw.AddRectFilled(new ImGui.Vec2(x + col * cell, y + row * cell), new ImGui.Vec2(x + (col + 1) * cell, y + (row + 1) * cell), (row + col) % 2 ? ImGui.COL32(50, 50, 50, 255) : ImGui.COL32(39, 39, 39, 255));
    }
  }
  draw.PopClipRect();
}
