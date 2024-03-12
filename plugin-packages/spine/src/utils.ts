import type { Material } from '@galacean/effects';
import { assertExist, glContext } from '@galacean/effects';
import type { SkeletonData } from '@esotericsoftware/spine-core';
import {
  AtlasAttachmentLoader, BinaryInput,
  BlendMode,
  SkeletonBinary,
  SkeletonJson,
  TextureAtlas,
  TextureFilter,
  TextureWrap,
} from '@esotericsoftware/spine-core';
import { decodeText } from './polyfill';

export function setBlending (material: Material, mode: BlendMode, pma: boolean) {
  material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
  switch (mode) {
    case BlendMode.Multiply:
      material.blendFunction = [glContext.DST_COLOR, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case BlendMode.Screen:
      material.blendFunction = [glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE_MINUS_SRC_COLOR, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    case BlendMode.Additive:
      material.blendFunction = [pma ? glContext.ONE : glContext.SRC_ALPHA, glContext.ONE, glContext.ONE, glContext.ONE];

      break;
    case BlendMode.Normal:
      material.blendFunction = [pma ? glContext.ONE : glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA, glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA];

      break;
    default:
      throw new Error(`Unknown blend mode: ${mode}`);
  }
}

/**
 * 获取骨骼数据
 * @param atlas - 纹理图集文件 `.atlas` 结尾
 * @param skeletonFile - 描述文件 `.skel` 或者 `.json` 结尾
 * @param skeletonType - 'skel' | 'json'
 * @returns
 */
export function createSkeletonData (atlas: TextureAtlas, skeletonFile: any, skeletonType: any): SkeletonData {
  const atlasLoader = new AtlasAttachmentLoader(atlas);
  let skeletonLoader;

  if (skeletonType === 'skel') {
    skeletonLoader = new SkeletonBinary(atlasLoader);
    const input = new BinaryInput(skeletonFile);

    input.readInt32(); input.readInt32();
    const version = input.readString();

    if (!version) {
      throw new Error ('未获取到 Spine 版本信息，请使用 Spine 4.2 导出二进制数据');
    }

    if (version && version.split('.')[1] !== '2') {
      throw new Error (`请使用 Spine 4.2 导出二进制数据, 当前版本: ${version}`);
    }
  } else {
    skeletonLoader = new SkeletonJson(atlasLoader);
  }

  return skeletonLoader.readSkeletonData(skeletonFile);
}

/**
 * 获取创建纹理需要的参数
 * @param atlasBuffer
 * @returns 包含 magFilter, minFilter, wrapS, wrapT 的对象
*/
export function getTextureOptions (atlasBuffer: ArrayBuffer) {
  const atlasText = decodeText(new Uint8Array(atlasBuffer, 0));
  const atlas = new TextureAtlas(atlasText);
  const images: string[] = [];
  const page = atlas.pages[0]; // 打包配置都一样

  for (const page of atlas.pages) {
    images.push(page.name);
  }
  const {
    magFilter = TextureFilter.Linear,
    minFilter = TextureFilter.Linear,
    uWrap = TextureWrap.ClampToEdge,
    vWrap = TextureWrap.ClampToEdge,
  } = page;

  return {
    images,
    pma: page.pma,
    magFilter,
    minFilter,
    wrapS: uWrap,
    wrapT: vWrap,
  };
}

/**
 * 获取皮肤列表
 * @param skeletonData
 * @returns 包含皮肤名称的数组
 */
export function getAnimationList (skeletonData: SkeletonData): string[] {
  return skeletonData.animations.map(animation => animation.name);
}

/**
 * 获取动画时长
 * @param skeletonData - 骨骼数据
 * @param animationName - 动画名称
 * @returns 指定动画的持续时间（单位 s）
 */
export function getAnimationDuration (skeletonData: SkeletonData, animationName: string) {
  const animation = skeletonData.findAnimation(animationName);

  assertExist(animation);

  return animation.duration;
}

/**
 * 获取动画列表
 * @param skeletonData - 骨骼数据
 * @returns 指定骨骼动画的动画名数组
 */
export function getSkinList (skeletonData: SkeletonData): string[] {
  const res = [];

  for (let i = 0; i < skeletonData.skins.length; i++) {
    if (skeletonData.skins[i].name !== 'default') {
      res.push(skeletonData.skins[i].name);
    }
  }

  return res;
}

/**
 * 获取 spine 文件对应的编辑器版本
 */
export function getSpineVersion (skeleton: Uint8Array) {
  const input = new BinaryInput(skeleton);

  input.readInt32();
  input.readInt32();

  return input.readString();
}

/**
 * 从二进制数据中解析 atlas 数据
 * @param buffer - atlas 文件对应的二进制数据
 */
export function getAtlasFromBuffer (buffer: ArrayBuffer): TextureAtlas {
  const atlasText = decodeText(new Uint8Array(buffer));

  return new TextureAtlas(atlasText);
}

/**
 * 从二进制数据中解析用于创建 skeletonData 的数据
 * @param buffer - skeleton 文件，对应的二进制数据
 * @param skeletonType - 导出的 skeleton 文件对应的类型
 */
export function getSkeletonFromBuffer (buffer: ArrayBuffer, skeletonType: 'json' | 'skel'): DataView | string {
  let skeletonFile;
  const skeletonArray = new Uint8Array(buffer);

  if (skeletonType === 'json') {
    skeletonFile = decodeText(skeletonArray);
  } else {
    skeletonFile = new DataView(skeletonArray.buffer);
  }

  return skeletonFile;
}
