import { AbstractPlugin } from '@galacean/effects';
import type { spec, Composition, Scene, Texture } from '@galacean/effects';
import type { SkeletonData } from './core';
import { Skeleton, TextureAtlas } from './core';
import { createSkeletonData, getAnimationList, getSkinList } from './utils';

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
    const textDecoder = new TextDecoder('utf-8');

    composition.loaderData.spineDatas = scene.jsonScene.spines.map((resource, index) => readSpineData(resource, textDecoder, scene.bins, composition.textures));
  }

  override onCompositionDestroyed (composition: Composition) {
    if (composition.loaderData.spineDatas) {
      delete composition.loaderData.spineDatas;
    }
  }
}

function readSpineData (resource: spec.SpineResource, textDecoder: TextDecoder, bins: ArrayBuffer[], textures: Texture[]): SpineResource {
  let bufferLength, start, skeletonFile, index;
  const { atlas: atlasPointer, skeleton: skeletonPointer, images, skeletonType } = resource;

  [index, start = 0, bufferLength] = atlasPointer[1];
  const atlasBuffer = bins[index];
  const atlasText = bufferLength ? textDecoder.decode(new Uint8Array(atlasBuffer, start, bufferLength)) : textDecoder.decode(new Uint8Array(atlasBuffer, start));
  const atlas = new TextureAtlas(atlasText);
  const pageCount = atlas.pages.length;

  if (images.length !== pageCount) {
    throw new Error('atlas.page\'s length not equal spine.textures\' length');
  }
  for (let i = 0; i < pageCount; i++) {
    const page = atlas.pages[i];
    const tex = textures[images[i]];

    if (!tex) {
      throw new Error(`Can not find page ${page.name}'s texture, check the texture name`);
    }
    page.setTexture(tex);

  }
  [index, start = 0, bufferLength] = skeletonPointer[1];
  const skeletonBuffer = bins[index];

  if (skeletonType === 'json') {
    skeletonFile = bufferLength ? textDecoder.decode(new Uint8Array(skeletonBuffer, start, bufferLength)) : textDecoder.decode(new Uint8Array(skeletonBuffer, start));
  } else {
    skeletonFile = bufferLength ? new DataView(skeletonBuffer, start, bufferLength) : new DataView(skeletonBuffer, start);
  }

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

