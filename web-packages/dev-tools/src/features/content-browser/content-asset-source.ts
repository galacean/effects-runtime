import type { AssetViewItem } from '../../ui/asset-view/asset-view';
import type { AssetEntry } from '../assets/model/asset-types';
import type { AssetThumbnailCache } from '../assets/preview/asset-thumbnail-cache';
import { materialPreviews } from '../assets/preview/material-preview';
import { imageTexturePreview } from '../assets/preview/texture-preview';
import { ASSET_PRESENTATION } from '../assets/ui/asset-presentation';

export class ContentAssetSource {
  constructor (private readonly thumbnails: AssetThumbnailCache) { }

  describe (entry: AssetEntry, name = entry.name): AssetViewItem {
    const presentation = ASSET_PRESENTATION[entry.kind];

    return { id: entry.id, name, type: presentation.label, icon: presentation.icon, accent: presentation.accent,
      tooltip: entry.name + '\n' + presentation.label + (entry.width ? '\nDimensions: ' + entry.width + ' × ' + entry.height : '') + (entry.sourceName ? '\nSource: ' + entry.sourceName : ''),
      columns: [presentation.label, entry.width ? entry.width + ' × ' + entry.height : '—', entry.size ? (entry.size / 1024).toFixed(1) + ' KiB' : '—', new Date(entry.updatedAt).toLocaleDateString()],
      preview: entry.kind === 'texture' || entry.kind === 'sprite' || entry.kind === 'material' ? hovered => {
        const preview = entry.kind === 'sprite' ? this.thumbnails.getSprite(entry.id) : undefined;

        if (preview) { return { preview, width: preview.width, height: preview.height }; }
        const image = entry.kind === 'material' ? materialPreviews.asset(entry.id, 128, { realtime: hovered }) : entry.kind === 'texture' ? this.thumbnails.get(entry.id) : undefined;

        return image ? { preview: imageTexturePreview(image), width: image.width, height: image.height } : undefined;
      } : undefined };
  }
}
