import type { EffectsObject, Engine } from '@galacean/effects';
import { AnimationClip, Geometry, Material, Shader, ShaderVariant, Texture } from '@galacean/effects';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import type { AssetViewItem } from '../../../ui/asset-view/asset-view';
import { ASSET_TYPE_COLORS } from '../../../ui/icons/asset-icons';
import { getOrCreateTexturePreview, imageTexturePreview } from '../preview/texture-preview';
import { materialPreviews } from '../preview/material-preview';
import { observeRuntimeAssets } from './runtime-asset-changes';

export const RUNTIME_ASSET_CATEGORIES = ['All', 'Textures', 'Materials', 'Shaders', 'Geometries', 'AnimationClips'] as const;
export type RuntimeAssetCategory = typeof RUNTIME_ASSET_CATEGORIES[number];
export interface RuntimeAssetItem extends AssetViewItem { object: EffectsObject, category: RuntimeAssetCategory }

type RuntimeAsset = Texture | Material | Shader | ShaderVariant | Geometry | AnimationClip;

function isRuntimeAsset (object: EffectsObject | undefined): object is RuntimeAsset {
  return object instanceof Texture || object instanceof Material || object instanceof Shader || object instanceof ShaderVariant ||
    object instanceof Geometry || object instanceof AnimationClip;
}

/** Index the current engine's asset descriptors; consume only queued IDs after the initial enumeration. */
export class RuntimeAssetSource {
  private registry?: Engine['effectsObjectServer'];
  private objects?: Engine['effectsObjectServer']['objectInstance'];
  private unsubscribe?: () => void;
  private pending = new Set<string>();
  private readonly watched = new Map<string, { object: RuntimeAsset, unsubscribe(): void }>();
  private readonly index = new Map<string, RuntimeAssetItem>();

  get (id: string): RuntimeAssetItem | undefined { return this.index.get(id); }
  values (): IterableIterator<RuntimeAssetItem> { return this.index.values(); }

  update (engine: Engine): boolean {
    const registry = engine.effectsObjectServer, objects = registry.objectInstance;
    let changed = this.registry !== registry;

    if (changed) {
      this.dispose(); this.registry = registry;
      this.unsubscribe = observeRuntimeAssets(engine, (id, object) => {
        if (this.watched.has(id) || isRuntimeAsset(object)) { this.pending.add(id); } else { this.pending.delete(id); }
      });
    }
    if (objects !== this.objects) {
      this.objects = objects;
      this.watched.forEach((_watch, id) => this.pending.add(id));
      for (const [id, object] of Object.entries(objects)) {
        if (isRuntimeAsset(object)) { this.pending.add(id); }
      }
    }
    if (!this.pending.size) { return changed; }
    const pending = this.pending;

    this.pending = new Set();
    for (const id of pending) {
      const object = objects[id], watch = this.watched.get(id);

      if (object !== watch?.object) {
        watch?.unsubscribe(); this.watched.delete(id);
        if (isRuntimeAsset(object)) {
          const onChanged = () => { this.pending.add(id); };

          object.on('changed', onChanged);
          this.watched.set(id, { object, unsubscribe: () => object.off('changed', onChanged) });
        }
      }
      const previous = this.index.get(id);
      const item = isRuntimeAsset(object) ? this.describe(id, object, previous) : undefined;

      if (item === previous) { continue; }
      if (item) { this.index.set(id, item); } else { this.index.delete(id); }
      changed = true;
    }

    return changed;
  }

  dispose (): void {
    this.unsubscribe?.(); this.unsubscribe = undefined; this.registry = undefined; this.objects = undefined;
    this.watched.forEach(watch => watch.unsubscribe());
    this.watched.clear(); this.pending.clear(); this.index.clear();
  }

  private describe (id: string, object: RuntimeAsset, previous?: RuntimeAssetItem): RuntimeAssetItem | undefined {
    if (object instanceof Texture && (object.isDestroyed || EditorRuntimeSession.device.isSceneTexture(object))) { return; }
    const kind: readonly [RuntimeAssetCategory, keyof typeof ASSET_TYPE_COLORS, string] = object instanceof Texture ? ['Textures', 'texture', 'Texture'] :
      object instanceof Material ? ['Materials', 'material', 'Material'] : object instanceof Geometry ? ['Geometries', 'geometry', 'Geometry'] :
        object instanceof AnimationClip ? ['AnimationClips', 'animationClip', 'AnimationClip'] : ['Shaders', 'shader', 'Shader'];
    const [category, icon, type] = kind;
    const name = (object as { name?: string }).name || (object instanceof Shader ? object.shaderData?.name : object instanceof ShaderVariant ? object.source?.name : '') || id;

    if (previous?.object === object && previous.name === name) { return previous; }

    return { id, object, name, type, category, icon, accent: ASSET_TYPE_COLORS[icon],
      preview: object instanceof Texture || object instanceof Material ? hovered => {
        const material = object instanceof Material ? materialPreviews.runtime(object, 128, { realtime: hovered }) : undefined;
        const preview = object instanceof Texture ? getOrCreateTexturePreview(object) : material && imageTexturePreview(material);

        return preview ? { preview, width: object instanceof Texture ? object.width : 128, height: object instanceof Texture ? object.height : 128 } : undefined;
      } : undefined };
  }
}
