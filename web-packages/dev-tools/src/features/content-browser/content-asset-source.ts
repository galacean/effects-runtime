import { Sprite } from '@galacean/effects';
import type { EffectsObject } from '@galacean/effects';
import { ImGui } from '../../platform/imgui';
import type { AssetViewItem } from '../../ui/asset-view/asset-view';
import { checkerboard } from '../../ui/asset-view/asset-view';
import { drawEditorIcon } from '../../ui/icons/editor-icons';
import { InteractionColors as I } from '../../ui/theme/editor-interaction';
import type { AssetEntry } from '../assets/model/asset-types';
import type { AssetThumbnailCache } from '../assets/preview/asset-thumbnail-cache';
import { getSpriteThumbnail } from '../assets/preview/sprite-thumbnail';
import { drawTexturePreview, imageTexturePreview } from '../assets/preview/texture-preview';
import { ASSET_PRESENTATION } from '../assets/ui/asset-presentation';

export class ContentAssetSource {
  constructor (private readonly thumbnails: AssetThumbnailCache, private readonly resolve: (id: string) => EffectsObject | undefined) { }

  describe (entry: AssetEntry, name = entry.name): AssetViewItem {
    const presentation = ASSET_PRESENTATION[entry.kind];

    return { id: entry.id, name, type: presentation.label, icon: presentation.icon, accent: presentation.accent,
      preview: entry.kind === 'texture' || entry.kind === 'sprite' ? rect => {
        const sprite = entry.kind === 'sprite' ? this.resolve(entry.id) : undefined;
        const preview = sprite instanceof Sprite ? getSpriteThumbnail(sprite) : undefined;
        const image = preview ? { texture: preview.tex, width: preview.width, height: preview.height } : entry.kind === 'texture' ? this.thumbnails.get(entry.id) : undefined;

        if (image) {
          const scale = Math.min(rect.width / image.width, rect.height / image.height), width = image.width * scale, height = image.height * scale;
          const x = rect.x + (rect.width - width) / 2, y = rect.y + (rect.height - height) / 2;

          checkerboard(x, y, width, height, 8);
          drawTexturePreview(preview ?? imageTexturePreview(image), new ImGui.Vec2(x, y), new ImGui.Vec2(x + width, y + height));
        } else {
          const size = Math.min(rect.width, rect.height) * 0.4;

          drawEditorIcon(presentation.menuIcon, rect.x + (rect.width - size) / 2, rect.y + (rect.height - size) / 2, size, I.muted);
        }
      } : undefined };
  }
}
