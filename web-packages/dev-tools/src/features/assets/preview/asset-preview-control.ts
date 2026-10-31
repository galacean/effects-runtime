import type { Engine } from '@galacean/effects';
import { Material, Sprite, Texture, MouseButton } from '@galacean/effects';
import type { InputEventMouseButton } from '@galacean/effects';
import { Control, MouseFilter } from '@galacean/effects-plugin-gui';
import { drawAssetIcon } from '../../../ui/icons/asset-icons';
import type { AssetIcon } from '../../../ui/icons/asset-icons';
import { editorColors } from '../../../ui/theme/control-theme';
import { materialPreviews } from './material-preview';
import { getSpriteThumbnail } from './sprite-thumbnail';
import { getOrCreateTexturePreview, imageTexturePreview, TexturePresentation } from './texture-preview';
import type { TexturePreview } from './texture-preview';
import { assetLibrary } from '../asset-library';
import { ContentAssetSource } from '../../content-browser/content-asset-source';
import { AssetThumbnailCache } from './asset-thumbnail-cache';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';

export function resourcePreview (resource: unknown, size: number): { preview: TexturePreview, width: number, height: number } | undefined {
  const sprite = resource instanceof Sprite ? getSpriteThumbnail(resource) : undefined;
  const material = resource instanceof Material ? materialPreviews.runtime(resource, size) : undefined;
  const preview = sprite ?? (resource instanceof Texture ? getOrCreateTexturePreview(resource) : material && imageTexturePreview(material));

  if (!preview) { return; }

  return { preview, width: sprite ? sprite.width : resource instanceof Texture ? resource.width : size,
    height: sprite ? sprite.height : resource instanceof Texture ? resource.height : size };
}

/** Resource previews share the same UV, alpha and atlas handling as asset editors. */
export class AssetPreviewControl extends Control {
  private readonly presentation: TexturePresentation;
  private aspect = 1;
  private hasImage = false;
  private readonly thumbnails = new AssetThumbnailCache();
  private readonly source = new ContentAssetSource(this.thumbnails, id => assetLibrary.asset(EditorRuntimeSession.player.engine, id));
  activated?: () => void;

  constructor (engine: Engine, private readonly resource: () => unknown, private readonly previewSize = 32, private readonly contentId?: () => string | undefined, private readonly fallbackIcon: AssetIcon = 'texture') {
    super(engine); this.mouseFilter = MouseFilter.Ignore; this.setCustomMinimumSize(previewSize, previewSize);
    this.presentation = new TexturePresentation(engine);
  }
  override update (delta: number): void {
    const entry = assetLibrary.entry(this.contentId?.() ?? '');
    const image = resourcePreview(this.resource(), this.previewSize) ?? (entry && this.source.describe(entry).preview?.(false));

    this.aspect = image ? image.width / Math.max(1, image.height) : 1;
    this.hasImage = !!image; this.presentation.update(image?.preview, undefined, this.previewSize * 2);
    super.update(delta);
  }
  override draw (): void {
    this.fillRect(0, 0, this.width, this.height, editorColors.input);
    if (this.hasImage) {
      const width = Math.min(this.width, this.height * this.aspect), height = width / Math.max(.000001, this.aspect);

      this.presentation.draw(this, (this.width - width) / 2, (this.height - height) / 2, width, height);
    } else {
      const resource = this.resource(), size = Math.min(24, this.width, this.height);

      drawAssetIcon(this, resource instanceof Material ? 'material' : resource instanceof Sprite ? 'sprite' : this.fallbackIcon, (this.width - size) / 2, (this.height - size) / 2, size);
    }
  }
  override onDestroy (): void { this.presentation.dispose(); this.thumbnails.clear(); }
  override onMouseDown (event: InputEventMouseButton): void {
    if (event.buttonIndex === MouseButton.Left && event.doubleClick) { this.activated?.(); event.accept(); }
  }
}
