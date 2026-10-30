import { ImGui } from '../../platform/imgui';
import type { AssetIcon } from '../icons/asset-icons';
import { drawAssetIcon } from '../icons/asset-icons';
import { editorColorU32, editorTileColor, InteractionColors as I } from '../theme/editor-interaction';

export interface AssetViewRect { x: number, y: number, width: number, height: number }
export interface AssetViewItem {
  id: string,
  name: string,
  type: string,
  icon: AssetIcon,
  accent: number,
  preview?: (rect: AssetViewRect) => void,
}
export interface AssetViewState { selected?: boolean, hovered?: boolean, focused?: boolean, dropTarget?: boolean }

export function assetTileHeight (width: number, nameLines: number): number { return width - 8 + nameLines * ImGui.GetTextLineHeight() + 28; }

export function assetText (text: string, x: number, y: number, color = editorColorU32(I.foreground), width = Infinity, size = ImGui.GetFontSize()): void {
  let value = text;
  const scale = size / ImGui.GetFontSize();

  if (ImGui.CalcTextSize(value).x * scale > width) {
    while (value && ImGui.CalcTextSize(value + '…').x * scale > width) { value = value.slice(0, -1); }
    value += '…';
  }
  ImGui.GetWindowDrawList().AddText(ImGui.GetFont(), size, new ImGui.Vec2(Math.round(x), Math.round(y)), color, value);
}

export function assetWrappedText (text: string, x: number, y: number, width: number, lines: number, color: number, centered = false): void {
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
    assetText(value, x + (centered ? Math.max(0, (width - ImGui.CalcTextSize(value).x) / 2) : 0), y + row * lineHeight, color, width);
  }
}

export function checkerboard (x: number, y: number, width: number, height: number, cell = 10): void {
  const draw = ImGui.GetWindowDrawList();

  draw.PushClipRect(new ImGui.Vec2(x, y), new ImGui.Vec2(x + width, y + height), true);
  for (let row = 0; row < Math.ceil(height / cell); row++) {
    for (let column = 0; column < Math.ceil(width / cell); column++) {
      draw.AddRectFilled(new ImGui.Vec2(x + column * cell, y + row * cell), new ImGui.Vec2(x + (column + 1) * cell, y + (row + 1) * cell), (row + column) % 2 ? ImGui.COL32(50, 50, 50, 255) : ImGui.COL32(39, 39, 39, 255));
    }
  }
  draw.PopClipRect();
}

export function paintAssetPreview (item: AssetViewItem, rect: AssetViewRect): void {
  if (item.preview) { item.preview(rect); } else {
    const size = Math.min(rect.width, rect.height) * (item.icon === 'folder' || item.icon === 'folderOpen' ? 0.7 : item.icon === 'scene' || item.icon === 'project' ? 1 : 0.72);

    drawAssetIcon(item.icon, rect.x + (rect.width - size) / 2, rect.y + (rect.height - size) / 2, size);
  }
}

export function paintAssetTile (item: AssetViewItem, rect: AssetViewRect, state: AssetViewState, nameLines = 2): void {
  const draw = ImGui.GetWindowDrawList(), thumbnailHeight = rect.width - 8;
  const background = editorColorU32(state.dropTarget ? I.selectedInactive : editorTileColor(!!state.selected, !!state.hovered, state.focused));
  const min = new ImGui.Vec2(rect.x, rect.y), max = new ImGui.Vec2(rect.x + rect.width, rect.y + rect.height);
  const folder = item.icon === 'folder' || item.icon === 'folderOpen';
  const text = editorColorU32(state.selected || state.hovered ? I.foregroundHover : I.foreground);

  if (!folder || state.selected || state.hovered) { draw.AddRectFilled(min, max, background, 4); }
  if (!folder) {
    draw.AddRectFilled(new ImGui.Vec2(rect.x + 2, rect.y + 2), new ImGui.Vec2(rect.x + rect.width - 2, rect.y + thumbnailHeight), editorColorU32(I.input), 3);
  }
  paintAssetPreview(item, { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: thumbnailHeight - 4 });
  if (!folder) { draw.AddRectFilled(new ImGui.Vec2(rect.x + 2, rect.y + thumbnailHeight - 3), new ImGui.Vec2(rect.x + rect.width - 2, rect.y + thumbnailHeight), item.accent); }
  if (state.selected || state.hovered || state.dropTarget) { draw.AddRect(min, max, state.dropTarget ? editorColorU32(I.primaryHover) : background, 4, 0, 2); }
  assetWrappedText(item.name, rect.x + 7, rect.y + thumbnailHeight + 7, rect.width - 14, nameLines, text, folder);
  if (!folder) { assetText(item.type, rect.x + 7, rect.y + rect.height - 19, editorColorU32(state.selected ? I.foreground : I.muted), rect.width - 14, ImGui.GetFontSize() * 0.85); }
}

export function paintAssetRow (item: AssetViewItem, rect: AssetViewRect, state: AssetViewState, spanColumns = false): void {
  const background = editorColorU32(state.dropTarget ? I.selectedInactive : state.selected ? editorTileColor(true, !!state.hovered, state.focused) : I.hover);

  if (state.selected || state.hovered || state.dropTarget) {
    if (spanColumns) { ImGui.TableSetBgColor(ImGui.TableBgTarget.RowBg1, background); } else {
      ImGui.GetWindowDrawList().AddRectFilled(new ImGui.Vec2(rect.x, rect.y), new ImGui.Vec2(rect.x + rect.width, rect.y + rect.height), background, 2);
    }
  }
  paintAssetPreview(item, { x: rect.x + 4, y: rect.y + 4, width: rect.height - 8, height: rect.height - 8 });
  const color = editorColorU32(state.selected || state.hovered ? I.foregroundHover : I.foreground);
  const detailed = rect.height > 28 && item.icon !== 'folder';

  assetText(item.name, rect.x + rect.height + 3, rect.y + (detailed ? 6 : (rect.height - ImGui.GetFontSize()) / 2), color, rect.width - rect.height - 8);
  if (detailed) { assetText(item.type, rect.x + rect.height + 3, rect.y + 28, editorColorU32(state.selected ? I.foregroundHover : I.muted), rect.width - rect.height - 8, ImGui.GetFontSize() * 0.85); }
}

export function assetDragPreview (item: AssetViewItem, count: number): void {
  const p = ImGui.GetCursorScreenPos();

  paintAssetPreview(item, { x: p.x, y: p.y, width: 42, height: 42 });
  assetText(item.name, p.x + 50, p.y + 3, editorColorU32(I.foregroundHover), 260);
  assetText(count > 1 ? count + ' assets' : item.type, p.x + 50, p.y + 24, editorColorU32(I.muted), 260);
  ImGui.Dummy(new ImGui.Vec2(Math.min(320, ImGui.CalcTextSize(item.name).x + 58), 46));
}
