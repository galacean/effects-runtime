import type { EffectsObject, Engine } from '@galacean/effects';
import { AnimationClip, Geometry, Material, Shader, ShaderVariant, Texture } from '@galacean/effects';
import { ImGui } from '../../../platform/imgui';
import { EditorRuntimeSession } from '../../../platform/effects-runtime/editor-runtime-session';
import type { AssetViewItem } from '../../../ui/asset-view/asset-view';
import { checkerboard } from '../../../ui/asset-view/asset-view';
import type { AssetIcon } from '../../../ui/icons/asset-icons';
import { ASSET_TYPE_COLORS } from '../../../ui/icons/asset-icons';
import { getOrCreateTexturePreview } from '../preview/texture-preview';

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
        preview: object instanceof Texture ? rect => {
          const preview = getOrCreateTexturePreview(object);

          if (!preview) { return; }
          const scale = Math.min(rect.width / Math.max(1, object.width), rect.height / Math.max(1, object.height));
          const width = Math.max(1, object.width) * scale, height = Math.max(1, object.height) * scale;
          const x = rect.x + (rect.width - width) / 2, y = rect.y + (rect.height - height) / 2;

          checkerboard(x, y, width, height, 8);
          ImGui.GetWindowDrawList().AddImage(preview.tex, new ImGui.Vec2(x, y), new ImGui.Vec2(x + width, y + height), preview.uv0, preview.uv1);
        } : undefined }];
    });
  }
}
