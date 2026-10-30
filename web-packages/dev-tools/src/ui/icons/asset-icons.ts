import { ImGui } from '../../platform/imgui/index';
import { drawEditorIcon } from './editor-icons';

export type AssetIcon = 'folder' | 'folderOpen' | 'scene' | 'project' | 'texture' | 'material' | 'shader' | 'sprite' | 'geometry' | 'animationClip';

export const ASSET_ICON_COLORS = {
  shader: ImGui.COL32(192, 192, 192, 255), geometry: ImGui.COL32(192, 192, 192, 255), animationClip: ImGui.COL32(192, 192, 192, 255),
  folder: ImGui.COL32(182, 143, 85, 255), scene: ImGui.COL32(192, 192, 192, 255),
  project: ImGui.COL32(192, 192, 192, 255), texture: ImGui.COL32(192, 192, 192, 255), material: ImGui.COL32(192, 192, 192, 255),
  sprite: ImGui.COL32(192, 192, 192, 255),
};
export const ASSET_TYPE_COLORS = {
  shader: ImGui.COL32(140, 77, 204, 255), geometry: ImGui.COL32(51, 166, 179, 255), animationClip: ImGui.COL32(230, 128, 51, 255),
  scene: ImGui.COL32(255, 156, 0, 255), texture: ImGui.COL32(192, 64, 64, 255), material: ImGui.COL32(64, 160, 78, 255),
  sprite: ImGui.COL32(74, 169, 191, 255),
};

export function drawAssetIcon (icon: AssetIcon, x: number, y: number, size: number, color = ASSET_ICON_COLORS[icon === 'folderOpen' ? 'folder' : icon]): void {
  const tint = new ImGui.Vec4((color & 255) / 255, ((color >>> 8) & 255) / 255, ((color >>> 16) & 255) / 255, (color >>> 24) / 255);

  const glyph = icon === 'shader' ? 'shader' : icon === 'geometry' ? 'mesh' : icon === 'animationClip' ? 'sequence' : icon === 'material' ? 'materialAsset' : size >= 28 && (icon === 'folder' || icon === 'folderOpen') ? 'folderLarge' : size >= 28 && icon === 'scene' ? 'sceneLarge' : icon;

  drawEditorIcon(glyph, x, y, size, tint);
}
