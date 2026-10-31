import { math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { paintIcon } from './control-icons';

export type AssetIcon = 'folder' | 'folderOpen' | 'scene' | 'project' | 'texture' | 'material' | 'shader' | 'sprite' | 'geometry' | 'animationClip';

export const ASSET_ICON_COLORS = {
  shader: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255), geometry: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255), animationClip: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255),
  folder: new math.Color(182 / 255, 143 / 255, 85 / 255, 255 / 255), scene: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255),
  project: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255), texture: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255), material: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255),
  sprite: new math.Color(192 / 255, 192 / 255, 192 / 255, 255 / 255),
};
export const ASSET_TYPE_COLORS = {
  shader: new math.Color(140 / 255, 77 / 255, 204 / 255, 255 / 255), geometry: new math.Color(51 / 255, 166 / 255, 179 / 255, 255 / 255), animationClip: new math.Color(230 / 255, 128 / 255, 51 / 255, 255 / 255),
  scene: new math.Color(255 / 255, 156 / 255, 0 / 255, 255 / 255), texture: new math.Color(192 / 255, 64 / 255, 64 / 255, 255 / 255), material: new math.Color(64 / 255, 192 / 255, 64 / 255, 255 / 255),
  sprite: new math.Color(74 / 255, 169 / 255, 191 / 255, 255 / 255),
};

export function drawAssetIcon (control: Control, icon: AssetIcon, x: number, y: number, size: number, color = ASSET_ICON_COLORS[icon === 'folderOpen' ? 'folder' : icon]): void {
  const glyph = icon === 'shader' ? size >= 28 ? 'shaderAsset' : 'shader' : icon === 'geometry' ? 'mesh' : icon === 'animationClip' ? 'sequence' : icon === 'material' ? 'materialAsset' : size >= 28 && (icon === 'folder' || icon === 'folderOpen') ? 'folderLarge' : size >= 28 && icon === 'scene' ? 'sceneLarge' : icon;

  paintIcon(control, glyph, x, y, size, color);
}
