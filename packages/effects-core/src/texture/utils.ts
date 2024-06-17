import type * as spec from '@galacean/effects-specification';
import type { Texture2DSourceOptions, TextureCubeSourceOptions } from './types';
import { TextureSourceType } from './types';
import { loadImage } from '../downloader';
import type { Engine } from '../engine';

type TextureJSONOptions = spec.SerializedTextureSource & spec.TextureConfigOptionsBase & spec.TextureFormatOptions;

export async function deserializeMipmapTexture (
  textureOptions: TextureJSONOptions,
  bins: ArrayBuffer[],
  files: spec.BinaryFile[] = [],
  engine: Engine
): Promise<Texture2DSourceOptions | TextureCubeSourceOptions> {
  if (textureOptions.target === 34067) {
    const { mipmaps, target } = textureOptions as spec.SerializedTextureCube;
    // const jobs = mipmaps.map(mipmap => Promise.all(mipmap.map(pointer => loadMipmapImage(pointer, bins))));
    const loadedMipmaps: HTMLElement[][] = [];

    for (const level of mipmaps) {
      const newLevel = [];

      for (const face of level) {
        // @ts-expect-error
        const loadedImageAsset = engine.assetLoader.loadGUID(face.id);

        // @ts-expect-error
        newLevel.push(loadedImageAsset.data);
      }
      loadedMipmaps.push(newLevel);
    }
    // const bin = files[mipmaps[0][0][1][0]].url;

    return {
      keepImageSource: false,
      ...textureOptions,
      ...{
        mipmaps: loadedMipmaps,
        sourceFrom: {
          target,
          // bin,
          type: TextureSourceType.mipmaps,
          // mipmaps: mipmaps.map(mipmap => mipmap.map(pointer => [pointer[1][1], pointer[1][2]])),
        },
      } as TextureCubeSourceOptions,
    };
  } else {
    // TODO: 补充测试用例
    const { mipmaps, target } = textureOptions as spec.SerializedTexture2DMipmapSource;
    const jobs = mipmaps.map(pointer => loadMipmapImage(pointer, bins));
    const loadedMipmaps = await Promise.all(jobs);
    const bin = files[mipmaps[0][1][0]].url;

    return {
      keepImageSource: false,
      ...textureOptions,
      ...{
        mipmaps: loadedMipmaps,
        sourceType: TextureSourceType.mipmaps,
        sourceFrom: {
          target,
          bin,
          type: TextureSourceType.mipmaps,
          mipmaps: mipmaps.map(pointer => [pointer[1][1], pointer[1][2]]),
        },
      } as Texture2DSourceOptions,
    };
  }
}

async function loadMipmapImage (pointer: spec.BinaryPointer, bins: ArrayBuffer[]) {
  const [index, start, length] = pointer[1];
  const bin = bins[index];

  if (!bin) {
    throw new Error(`Invalid bin pointer: ${JSON.stringify(pointer)}.`);
  }

  return loadImage(new Blob([new Uint8Array(bin, start, length)]));
}
