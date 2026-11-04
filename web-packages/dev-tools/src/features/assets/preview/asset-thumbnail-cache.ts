import { assetLibrary } from '../asset-library';
import type { Engine } from '@galacean/effects';
import { Sprite, TextureSourceType } from '@galacean/effects';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import type { SceneDocument } from '../../scene/document/scene-document';
import { sceneWorkspace } from '../../scene/scene-workspace';
import type { AssetEntry } from '../model/asset-types';
import { texturePreviewCache, type CachedImagePreview } from './texture-preview-cache';
import { initializePreviewTexture } from './texture-preview';
import { getSpriteThumbnail, type SpriteThumbnail } from './sprite-thumbnail';

/** Supplies project-scoped, versioned image requests to the shared preview cache. */
export class AssetThumbnailCache {
  private spriteRequests = new WeakMap<AssetEntry, { engine: Engine, document?: WeakRef<SceneDocument>, project: string, version: number, loading: boolean, failed: boolean }>();

  get (id: string, full = false): CachedImagePreview | undefined {
    const entry = assetLibrary.entry(id), project = assetLibrary.projectId;

    if (!entry || entry.deletedAt || entry.kind !== 'texture') { return; }
    const texture = assetLibrary.texture(EditorRuntimeSession.player.engine, id);

    if (texture?.isRegistered && initializePreviewTexture(texture)) {
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

  getSprite (id: string): SpriteThumbnail | undefined {
    const entry = assetLibrary.entry(id), project = assetLibrary.projectId;
    const engine = EditorRuntimeSession.player.engine, document = sceneWorkspace.current;

    if (entry?.kind !== 'sprite' || entry.deletedAt || entry.projectId !== project || sceneWorkspace.changingDocument) { return; }
    const sprite = assetLibrary.asset(engine, id);

    if (sprite instanceof Sprite) { return getSpriteThumbnail(sprite) ?? undefined; }
    let state = this.spriteRequests.get(entry);

    if (!state || state.engine !== engine || state.document?.deref() !== document || state.project !== project || state.version !== entry.updatedAt) {
      state = { engine, document: document && new WeakRef(document), project, version: entry.updatedAt, loading: false, failed: false }; this.spriteRequests.set(entry, state);
    }
    if (!state.loading && !state.failed) {
      const request = state;

      request.loading = true;
      void assetLibrary.loadAsset(engine, id).then(() => { request.loading = false; }).catch(error => {
        request.loading = false; request.failed = true;
        if (project === assetLibrary.projectId && document === sceneWorkspace.current) { assetLibrary.report(error); }
      });
    }
  }

  clear (): void { texturePreviewCache.clear(this); this.spriteRequests = new WeakMap(); }
}
