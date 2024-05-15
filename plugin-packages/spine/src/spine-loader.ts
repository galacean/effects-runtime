import type { SkeletonData, Texture as SpineTexture } from '@esotericsoftware/spine-core';
import { Skeleton, TextureAtlas } from '@esotericsoftware/spine-core';
import type { Composition, Scene, spec, Texture } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';
import { decodeText } from './polyfill';
import { createSkeletonData, getAnimationList, getSkeletonFromBuffer, getSkinList } from './utils';

/**
 *
 */
export interface SpineResource {
  atlas: TextureAtlas,
  /**
   * 创建纹理的选项
   */
  texturesOptions: spec.TextureDefine[],
  /**
   * 给 VFXItem 用于创建 skeleton 实例
   */
  skeletonFile: DataView | string,
  /**
   * 给 VFXItem 用于创建 skeleton 实例
   */
  skeletonType: 'json' | 'skel',
  /**
   * 给编辑器用
   */
  skeletonData: SkeletonData,
  /**
   * 缓存给编辑器用
   */
  skeletonInstance: Skeleton,
  /**
   * 编辑器用 spineData 的索引
   */
  id?: string,
  skinList: string[],
  animationList: string[],
  /**
   * 指向 `compsition.images` 的纹理索引数组
   */
  images: number[],
}

/**
 *
 */
export class SpineLoader extends AbstractPlugin {
  override onCompositionConstructed (composition: Composition, scene: Scene): void {
    if (!scene.jsonScene.spines) {
      return;
    }

    composition.loaderData.spineDatas = scene.jsonScene.spines.map((resource, index) => readSpineData(resource, scene.bins, composition.textures, composition));
  }

  override onCompositionDestroyed (composition: Composition) {
    if (composition.loaderData.spineDatas) {
      delete composition.loaderData.spineDatas;
    }
  }
}

function readSpineData (resource: spec.SpineResource, bins: ArrayBuffer[], textures: Texture[], composition: Composition): SpineResource {
  const { atlas: atlasPointer, skeleton: skeletonPointer, images, skeletonType } = resource;
  const [index, start = 0, bufferLength] = atlasPointer[1];
  const atlasBuffer = bins[index];
  const atlasText = bufferLength ? decodeText(new Uint8Array(atlasBuffer, start, bufferLength)) : decodeText(new Uint8Array(atlasBuffer, start));
  const atlas = new TextureAtlas(atlasText);
  const pageCount = atlas.pages.length;
  const engine = composition.getEngine();

  if (images.length !== pageCount) {
    throw new Error('atlas.page\'s length not equal spine.textures\' length');
  }
  for (let i = 0; i < pageCount; i++) {
    const page = atlas.pages[i];

    // 直接获取Texture
    const textureId = (images[i] as unknown as spec.DataPath).id;
    const tex = engine.assetLoader.loadGUID<Texture>(textureId);

    if (!tex) {
      throw new Error(`Can not find page ${page.name}'s texture, check the texture name`);
    }
    page.texture = tex as unknown as SpineTexture;
  }

  const [skelIndex, skelStart = 0, skelBufferLength] = skeletonPointer[1];
  const skeletonBuffer = skelBufferLength ? bins[skelIndex].slice(skelStart, skelStart + skelBufferLength) : bins[skelIndex].slice(skelStart);
  const skeletonFile = getSkeletonFromBuffer(skeletonBuffer, skeletonType);
  const skeletonData = createSkeletonData(atlas, skeletonFile, skeletonType); //VFXItem用此skeletonData新建skeleton实例会造成纹理丢失
  const skinList = getSkinList(skeletonData);
  const animationList = getAnimationList(skeletonData);

  return {
    atlas,
    skeletonFile,
    skeletonData,
    images,
    skeletonType,
    skeletonInstance: new Skeleton(skeletonData),
    skinList,
    animationList,
    // @ts-expect-error
    texturesOptions: images.map(texturePointer => textures[texturePointer]),
    // @ts-expect-error
    id: resource.id,
  };
}

