import { ImGui } from '../../platform/imgui/index';
import { assetText, assetWrappedText, checkerboard as drawCheckerboard } from '../../ui/asset-view/asset-view';
import { ASSET_ICON_COLORS, ASSET_TYPE_COLORS } from '../../ui/icons/asset-icons';
import type { EditorIcon } from '../../ui/icons/editor-icons';
import { drawEditorIcon } from '../../ui/icons/editor-icons';
import { InteractionColors as I, editorColorU32 } from '../../ui/theme/editor-interaction';
import { toolbarButton } from '../../ui/widgets/toolbar-button';

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
  const width = options.width ?? (label ? ImGui.CalcTextSize(label).x + 34 + (options.dropdown ? 14 : 0) : 26);
  const green = new ImGui.Vec4(42 / 255, 112 / 255, 48 / 255, 1), hover = new ImGui.Vec4(53 / 255, 134 / 255, 60 / 255, 1);

  return toolbarButton(id, { icon: CONTENT_ICONS[icon], label, width, height: 26, checked: options.active,
    enabled: !options.disabled, dropdown: options.dropdown, hint: options.hint, tint: options.green ? I.foregroundHover : I.foreground,
    colors: options.green ? [green, hover, green] : undefined });
}

export function contentText (text: string, x: number, y: number, color = CONTENT_COLORS.text, maxWidth = Infinity, size = ImGui.GetFontSize()): void {
  assetText(text, x, y, color, maxWidth, size);
}

export function contentWrappedText (text: string, x: number, y: number, width: number, lines: number, color: number, centered = false): void {
  assetWrappedText(text, x, y, width, lines, color, centered);
}

export function checkerboard (x: number, y: number, width: number, height: number, cell = 10): void { drawCheckerboard(x, y, width, height, cell); }
