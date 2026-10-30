import type { AssetIcon } from '../../../ui/icons/asset-icons';
import { ASSET_ICON_COLORS, ASSET_TYPE_COLORS } from '../../../ui/icons/asset-icons';
import type { EditorIcon } from '../../../ui/icons/editor-icons';
import type { AssetKind } from '../model/asset-types';

export const ASSET_PRESENTATION: Record<AssetKind, { label: string, icon: AssetIcon, menuIcon: EditorIcon, accent: number }> = {
  folder: { label: 'Folder', icon: 'folder', menuIcon: 'folder', accent: ASSET_ICON_COLORS.folder },
  scene: { label: 'Scene', icon: 'scene', menuIcon: 'scene', accent: ASSET_TYPE_COLORS.scene },
  texture: { label: 'Texture', icon: 'texture', menuIcon: 'texture', accent: ASSET_TYPE_COLORS.texture },
  material: { label: 'Material', icon: 'material', menuIcon: 'materialAsset', accent: ASSET_TYPE_COLORS.material },
  shader: { label: 'Shader', icon: 'shader', menuIcon: 'shader', accent: ASSET_TYPE_COLORS.shader },
  sprite: { label: 'Sprite', icon: 'sprite', menuIcon: 'sprite', accent: ASSET_TYPE_COLORS.sprite },
};
