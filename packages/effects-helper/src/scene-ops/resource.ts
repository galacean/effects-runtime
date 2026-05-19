/**
 * - replaceTexture: 替换元素纹理引用，并同步 scene.textures / scene.images
 */

import type { spec } from '@galacean/effects';
import { findElement } from './element';
import { normalizeScene, type SceneMutationResult } from './utils';

type ReplaceTextureInput = {
  scene: spec.JSONScene | string,
  elementId: string,
  url: string,
  textureId?: string,
  textureName?: string,
  reuseBy?: 'textureId' | 'url' | 'none',
  cleanupUnused?: boolean,
};

type ReplaceTextureSuccess = {
  elementId: string,
  textureId: string,
  sourceId: string,
  textureName: string,
  url: string,
  cleaned: {
    textures: string[],
    images: string[],
  },
};

type MutableImage = {
  id: string,
  url?: string,
  webp?: string,
  [key: string]: unknown,
};

type MutableTexture = {
  id: string,
  source?: unknown,
  name?: string,
  flipY?: boolean,
  [key: string]: unknown,
};

/**
 * 替换元素纹理。
 * - reuseBy: 纹理复用策略（textureId/url/none）
 * - cleanupUnused: 是否在替换后清理无引用旧资源
 * 失败码: SCENE_PARSE_FAILED | ELEMENT_NOT_FOUND | UNSUPPORTED_ELEMENT_TYPE | INVALID_INPUT
 */
export function replaceTexture (input: ReplaceTextureInput): SceneMutationResult<ReplaceTextureSuccess> {
  const { elementId, url } = input;

  try {
    const scene = normalizeScene(input.scene);
    const result = replaceElementTexture(
      scene,
      elementId,
      url,
      input.textureId,
      input.textureName,
      input.reuseBy,
      Boolean(input.cleanupUnused),
    );

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      scene,
      data: result.data,
    };
  } catch {
    return {
      ok: false,
      code: 'SCENE_PARSE_FAILED',
      message: 'scene 不是合法的 JSONScene 对象或序列化字符串',
    };
  }
}

function replaceElementTexture (
  scene: spec.JSONScene,
  elementId: string,
  textureUrl: string,
  textureId?: string,
  textureName?: string,
  reuseBy: 'textureId' | 'url' | 'none' = 'textureId',
  cleanupUnused = false,
) {
  ensureResourceCollections(scene);

  const match = findElement(scene, elementId);

  if (!match) {
    return { ok: false as const, code: 'ELEMENT_NOT_FOUND' as const, message: `element '${elementId}' 不存在` };
  }

  const component = findTextureAwareComponent(scene, match.element.id);

  if (!component) {
    return { ok: false as const, code: 'UNSUPPORTED_ELEMENT_TYPE' as const, message: `element '${elementId}' 不支持纹理替换` };
  }

  const textures = getMutableTextures(scene);
  const images = getMutableImages(scene);
  const currentTextureId = getStringValue(component.renderer?.texture?.id);
  const currentTexture = currentTextureId ? textures.find(item => getStringValue(item.id) === currentTextureId) : undefined;
  const reuseTexture = resolveReuseTexture(textures, images, textureUrl, textureId, reuseBy);

  if (reuseTexture) {
    const reuseTextureId = getStringValue(reuseTexture.id);
    const reuseSourceId = getDataPathId(reuseTexture.source);

    if (!reuseTextureId || !reuseSourceId) {
      return { ok: false as const, code: 'INVALID_INPUT' as const, message: '复用纹理数据不完整，无法替换' };
    }

    component.renderer ??= {};
    component.renderer.texture = { id: reuseTextureId };

    return {
      ok: true as const,
      data: {
        elementId: match.element.id,
        textureId: reuseTextureId,
        sourceId: reuseSourceId,
        textureName: getStringValue(reuseTexture.name) || reuseTextureId,
        url: getStringValue(findImageUrlById(images, reuseSourceId)) || textureUrl,
        cleaned: {
          textures: [],
          images: [],
        },
      },
    };
  }

  const currentSourceId = getDataPathId(currentTexture?.source);
  const nextTextureId = textureId?.trim()
    || (reuseBy === 'none' ? createId('texture') : (currentTextureId || createId('texture')));
  const nextTextureName = textureName?.trim() || nextTextureId;
  const nextSourceId = reuseBy === 'none' ? createId('image') : (currentSourceId || createId('image'));

  upsertImage(scene, {
    id: nextSourceId,
    url: textureUrl,
    webp: textureUrl,
  });

  upsertTexture(scene, {
    id: nextTextureId,
    source: { id: nextSourceId },
    flipY: true,
    name: nextTextureName,
  });

  component.renderer ??= {};
  component.renderer.texture = {
    id: nextTextureId,
  };

  const cleaned = cleanupUnused
    ? cleanupPreviousResources(scene, {
      oldTextureId: currentTextureId,
      oldSourceId: currentSourceId,
      nextTextureId,
      nextSourceId,
    })
    : { textures: [], images: [] };

  return {
    ok: true as const,
    data: {
      elementId: match.element.id,
      textureId: nextTextureId,
      sourceId: nextSourceId,
      textureName: nextTextureName,
      url: textureUrl,
      cleaned,
    },
  };
}

function resolveReuseTexture (
  textures: MutableTexture[],
  images: MutableImage[],
  textureUrl: string,
  textureId: string | undefined,
  reuseBy: 'textureId' | 'url' | 'none',
): MutableTexture | null {
  if (reuseBy === 'none') {
    return null;
  }

  if (reuseBy === 'textureId') {
    if (!textureId) {
      return null;
    }

    return textures.find(item => getStringValue(item.id) === textureId.trim()) || null;
  }

  const image = images.find(item => getStringValue(item.url) === textureUrl);
  const imageId = image ? getStringValue(image.id) : undefined;

  if (!imageId) {
    return null;
  }

  return textures.find(item => getDataPathId(item.source) === imageId) || null;
}

function findImageUrlById (
  images: MutableImage[],
  imageId: string,
): string | undefined {
  const image = images.find(item => getStringValue(item.id) === imageId);

  return image ? getStringValue(image.url) : undefined;
}

function ensureResourceCollections (scene: spec.JSONScene): void {
  const mutableScene = scene as spec.JSONScene & {
    images?: Array<Record<string, unknown>>,
    textures?: Array<Record<string, unknown>>,
    videos?: Array<Record<string, unknown>>,
  };

  mutableScene.images ??= [];
  mutableScene.textures ??= [];
  mutableScene.videos ??= [];
}

function getMutableImages (scene: spec.JSONScene): MutableImage[] {
  return scene.images as unknown as MutableImage[];
}

function getMutableTextures (scene: spec.JSONScene): MutableTexture[] {
  return scene.textures as unknown as MutableTexture[];
}

function findTextureAwareComponent (scene: spec.JSONScene, elementId: string): {
  renderer?: {
    texture?: {
      id?: string,
    },
    [key: string]: unknown,
  },
  [key: string]: unknown,
} | null {
  for (const component of scene.components) {
    if (component.item?.id !== elementId) {
      continue;
    }

    const supportedDataTypes = ['SpriteComponent', 'VideoComponent'];

    if (!supportedDataTypes.includes(String(component.dataType))) {
      continue;
    }

    return component as {
      renderer?: {
        texture?: {
          id?: string,
        },
      },
    };
  }

  return null;
}

function upsertImage (
  scene: spec.JSONScene,
  image: MutableImage,
): void {
  const images = getMutableImages(scene);
  const imageId = getStringValue(image.id);
  const index = images.findIndex(item => getStringValue(item.id) === imageId);

  if (index < 0) {
    images.push(image);

    return;
  }

  images[index] = {
    ...images[index],
    ...image,
  };
}

function upsertTexture (
  scene: spec.JSONScene,
  texture: MutableTexture,
): void {
  const textures = getMutableTextures(scene);
  const textureId = getStringValue(texture.id);
  const index = textures.findIndex(item => getStringValue(item.id) === textureId);

  if (index < 0) {
    textures.push(texture);

    return;
  }

  textures[index] = {
    ...textures[index],
    ...texture,
  };
}

function createId (prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getStringValue (value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  return undefined;
}

function getDataPathId (value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return getStringValue((value as { id?: unknown }).id);
}

function cleanupPreviousResources (
  scene: spec.JSONScene,
  input: {
    oldTextureId: string | undefined,
    oldSourceId: string | undefined,
    nextTextureId: string,
    nextSourceId: string,
  },
): {
    textures: string[],
    images: string[],
  } {
  const cleaned = {
    textures: [] as string[],
    images: [] as string[],
  };
  const textures = getMutableTextures(scene);
  const images = getMutableImages(scene);

  if (input.oldTextureId && input.oldTextureId !== input.nextTextureId && !isTextureIdUsed(scene, input.oldTextureId)) {
    const textureIndex = textures.findIndex(item => getStringValue(item.id) === input.oldTextureId);

    if (textureIndex >= 0) {
      textures.splice(textureIndex, 1);
      cleaned.textures.push(input.oldTextureId);
    }
  }

  if (input.oldSourceId && input.oldSourceId !== input.nextSourceId && !isSourceIdUsedByTextures(scene, input.oldSourceId)) {
    const imageIndex = images.findIndex(item => getStringValue(item.id) === input.oldSourceId);

    if (imageIndex >= 0) {
      images.splice(imageIndex, 1);
      cleaned.images.push(input.oldSourceId);
    }
  }

  return cleaned;
}

function isTextureIdUsed (scene: spec.JSONScene, textureId: string): boolean {
  for (const component of scene.components) {
    const renderer = (component as unknown as { renderer?: { texture?: { id?: unknown } } }).renderer;
    const currentTextureId = getStringValue(renderer?.texture?.id);

    if (currentTextureId === textureId) {
      return true;
    }
  }

  return false;
}

function isSourceIdUsedByTextures (scene: spec.JSONScene, sourceId: string): boolean {
  for (const texture of getMutableTextures(scene)) {
    if (getDataPathId(texture.source) === sourceId) {
      return true;
    }
  }

  return false;
}

