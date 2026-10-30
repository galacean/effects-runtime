import { assetLibrary } from '../asset-library';
import { TextureSourceType } from '@galacean/effects';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import { texturePreviewCache, type CachedImagePreview } from './texture-preview-cache';

/** Supplies project-scoped, versioned image requests to the shared preview cache. */
export class AssetThumbnailCache {
  get (id: string, full = false): CachedImagePreview | undefined {
    const entry = assetLibrary.entry(id), project = assetLibrary.projectId;

    if (!entry || entry.deletedAt || entry.kind !== 'texture') { return; }
    const texture = assetLibrary.texture(EditorRuntimeSession.player.engine, id);

    if (texture?.isRegistered && !texture.isDestroyed) {
      return {
        texture: texturePreviewCache.reference(() => assetLibrary.texture(EditorRuntimeSession.player.engine, id)),
        width: texture.width, height: texture.height, flipY: texture.source.sourceType === TextureSourceType.framebuffer || !!texture.source.flipY,
      };
    }

    return texturePreviewCache.image(this, project + ':' + id + (full ? ':full' : ':thumbnail'), entry.updatedAt,
      async () => {
        const source = await assetLibrary.storage.image(id, project);

        return full ? source?.blob : source?.thumbnail;
      }, error => { if (project === assetLibrary.projectId) { assetLibrary.report(error); } });
  }

  clear (): void { texturePreviewCache.clear(this); }
}
