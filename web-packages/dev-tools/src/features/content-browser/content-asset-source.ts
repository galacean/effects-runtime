import { ImGui } from '../../platform/imgui';
import type { AssetViewItem } from '../../ui/asset-view/asset-view';
import { checkerboard } from '../../ui/asset-view/asset-view';
import { ASSET_TYPE_COLORS } from '../../ui/icons/asset-icons';
import { drawEditorIcon } from '../../ui/icons/editor-icons';
import { InteractionColors as I } from '../../ui/theme/editor-interaction';
import type { AssetEntry } from '../assets/model/asset-types';
import type { AssetThumbnailCache } from '../assets/preview/asset-thumbnail-cache';

export class ContentAssetSource {
  constructor (private readonly thumbnails: AssetThumbnailCache) { }

  describe (entry: AssetEntry, name = entry.name): AssetViewItem {
    return { id: entry.id, name, type: entry.kind === 'folder' ? 'Folder' : entry.kind === 'scene' ? 'Scene' : 'Texture',
      icon: entry.kind, accent: entry.kind === 'scene' ? ASSET_TYPE_COLORS.scene : ASSET_TYPE_COLORS.texture,
      preview: entry.kind === 'texture' ? rect => {
        const image = this.thumbnails.get(entry.id);

        if (image) {
          const scale = Math.min(rect.width / image.width, rect.height / image.height), width = image.width * scale, height = image.height * scale;
          const x = rect.x + (rect.width - width) / 2, y = rect.y + (rect.height - height) / 2;

          checkerboard(x, y, width, height, 8);
          ImGui.GetWindowDrawList().AddImage(image.texture, new ImGui.Vec2(x, y), new ImGui.Vec2(x + width, y + height));
        } else {
          const size = Math.min(rect.width, rect.height) * 0.4;

          drawEditorIcon('texture', rect.x + (rect.width - size) / 2, rect.y + (rect.height - size) / 2, size, I.muted);
        }
      } : undefined };
  }
}
