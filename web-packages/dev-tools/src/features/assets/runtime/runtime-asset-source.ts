import type { EffectsObject, Engine } from '@galacean/effects';
import { AnimationClip, Geometry, Material, Shader, ShaderVariant, Texture } from '@galacean/effects';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import type { AssetViewItem } from '../../../ui/asset-view/asset-view';
import type { AssetIcon } from '../../../ui/icons/asset-icons';
import { ASSET_TYPE_COLORS } from '../../../ui/icons/asset-icons';
import { getOrCreateTexturePreview, imageTexturePreview } from '../preview/texture-preview';
import { materialPreviews } from '../preview/material-preview';

export const RUNTIME_ASSET_CATEGORIES = ['All', 'Textures', 'Materials', 'Shaders', 'Geometries', 'AnimationClips'] as const;
export type RuntimeAssetCategory = typeof RUNTIME_ASSET_CATEGORIES[number];
export interface RuntimeAssetItem extends AssetViewItem { object: EffectsObject, category: RuntimeAssetCategory, summary: string }

export class RuntimeAssetSource {
  items (engine: Engine): RuntimeAssetItem[] {
    return Object.values(engine.effectsObjectServer.objectInstance).flatMap(object => {
      const kind = object instanceof Texture ? ['Textures', 'texture', 'Texture'] : object instanceof Material ? ['Materials', 'material', 'Material'] :
        object instanceof Shader || object instanceof ShaderVariant ? ['Shaders', 'shader', 'Shader'] : object instanceof Geometry ? ['Geometries', 'geometry', 'Geometry'] :
          object instanceof AnimationClip ? ['AnimationClips', 'animationClip', 'AnimationClip'] : undefined;

      if (!kind || object instanceof Texture && (object.isDestroyed || EditorRuntimeSession.device.isSceneTexture(object))) { return []; }
      const icon = kind[1] as AssetIcon;
      const name = (object as { name?: string }).name || (object instanceof Shader ? object.shaderData?.name : object instanceof ShaderVariant ? object.source?.name : '') || object.getInstanceId();
      const summary = object instanceof Texture ? object.width + ' × ' + object.height : object instanceof Geometry ? object.subMeshes.length + ' submeshes' :
        object instanceof AnimationClip ? object.duration.toFixed(2) + ' s' : kind[2];

      return [{ id: object.getInstanceId(), object, name, type: kind[2], category: kind[0] as RuntimeAssetCategory, icon,
        accent: ASSET_TYPE_COLORS[icon as keyof typeof ASSET_TYPE_COLORS], summary,
        preview: object instanceof Texture || object instanceof Material ? hovered => {
          const material = object instanceof Material ? materialPreviews.runtime(object, 128, { realtime: hovered }) : undefined;
          const preview = object instanceof Texture ? getOrCreateTexturePreview(object) : material && imageTexturePreview(material);

          return preview ? { preview, width: object instanceof Texture ? object.width : 128, height: object instanceof Texture ? object.height : 128 } : undefined;
        } : undefined }];
    });
  }
}
