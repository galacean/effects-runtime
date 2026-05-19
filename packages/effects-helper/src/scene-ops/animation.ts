import type { spec } from '@galacean/effects';
import { findElement, getCompositionComponents } from './element';
import { normalizeScene, type SceneMutationResult } from './utils';

type PositionOverLifetime = Record<string, unknown>;
type RotationOverLifetime = Record<string, unknown>;
type SizeOverLifetime = Record<string, unknown>;
type TransformPlayableAssetData = {
  id: string,
  dataType?: string,
  positionOverLifetime?: PositionOverLifetime,
  rotationOverLifetime?: RotationOverLifetime,
  sizeOverLifetime?: SizeOverLifetime,
};

export type TransformAnimationPatch = {
  positionOverLifetime?: PositionOverLifetime,
  rotationOverLifetime?: RotationOverLifetime,
  sizeOverLifetime?: SizeOverLifetime,
};

export type PatchTransformAnimationInput = {
  scene: spec.JSONScene | string,
  elementId: string,
  patch: TransformAnimationPatch,
};

export type PatchTransformAnimationSuccess = {
  elementId: string,
  playableAssetId: string,
};

/**
 * 修改元素绑定的 TransformPlayableAsset overLifetime 动画段。
 * 失败码: SCENE_PARSE_FAILED | ELEMENT_NOT_FOUND | ANIMATION_NOT_FOUND
 */
export function patchTransformAnimation (
  input: PatchTransformAnimationInput,
): SceneMutationResult<PatchTransformAnimationSuccess> {
  try {
    const scene = normalizeScene(input.scene);
    const match = findElement(scene, input.elementId);

    if (!match) {
      return {
        ok: false,
        code: 'ELEMENT_NOT_FOUND',
        message: `element '${input.elementId}' 不存在`,
      };
    }

    const asset = findTransformPlayableAsset(scene, match.element.id);

    if (!asset) {
      return {
        ok: false,
        code: 'ANIMATION_NOT_FOUND',
        message: `element '${input.elementId}' 缺少 TransformPlayableAsset`,
      };
    }

    if (input.patch.positionOverLifetime) {
      asset.positionOverLifetime = clone(input.patch.positionOverLifetime);
    }
    if (input.patch.rotationOverLifetime) {
      asset.rotationOverLifetime = clone(input.patch.rotationOverLifetime);
    }
    if (input.patch.sizeOverLifetime) {
      asset.sizeOverLifetime = clone(input.patch.sizeOverLifetime);
    }

    return {
      ok: true,
      scene,
      data: {
        elementId: match.element.id,
        playableAssetId: asset.id,
      },
    };
  } catch {
    return {
      ok: false,
      code: 'SCENE_PARSE_FAILED',
      message: 'scene 不是合法的 JSONScene 对象或序列化字符串',
    };
  }
}

function findTransformPlayableAsset (scene: spec.JSONScene, elementId: string): TransformPlayableAssetData | null {
  const composition = findOwningComposition(scene, elementId);

  if (!composition) {
    return null;
  }

  const binding = composition.sceneBindings.find(item => item.value.id === elementId);

  if (!binding) {
    return null;
  }

  const objectTrack = scene.miscs.find(
    misc => misc.id === binding.key.id && String(misc.dataType) === 'ObjectBindingTrack',
  ) as (spec.TrackAssetData & { children?: spec.DataPath[] }) | undefined;

  if (!objectTrack || !Array.isArray(objectTrack.children)) {
    return null;
  }

  for (const child of objectTrack.children) {
    const childTrack = scene.miscs.find(
      misc => misc.id === child.id && String(misc.dataType) !== 'TimelineAsset' && Array.isArray((misc as { clips?: unknown }).clips),
    ) as (spec.TrackAssetData & { clips: Array<{ asset?: { id?: string } }> }) | undefined;

    if (!childTrack) {
      continue;
    }

    for (const clip of childTrack.clips) {
      const assetId = clip.asset?.id;

      if (!assetId) {
        continue;
      }
      const asset = scene.miscs.find(misc => misc.id === assetId && String(misc.dataType) === 'TransformPlayableAsset');

      if (asset) {
        return asset as unknown as TransformPlayableAssetData;
      }
    }
  }

  return null;
}

function findOwningComposition (scene: spec.JSONScene, elementId: string): spec.CompositionComponentData | null {
  for (const composition of getCompositionComponents(scene)) {
    if (composition.items.some(item => item.id === elementId)) {
      return composition;
    }
  }

  return null;
}

function clone<T> (value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
