import type * as spec from '@galacean/effects-specification';
import type { Texture2DSourceOptions, TextureCubeSourceOptions, TextureSourceOptions } from './types';
import { TextureSourceType } from './types';
import { loadImage } from '../downloader';
import { glContext } from '../gl';

/** Read source dimensions independently of GPU allocation and upload limits. */
export function getTextureSourceSize (source: TextureSourceOptions): spec.vec2 {
  if (source.sourceType === TextureSourceType.video) {
    return [source.video.videoWidth, source.video.videoHeight];
  }
  if (source.sourceType === TextureSourceType.framebuffer) {
    return [source.data?.width ?? 0, source.data?.height ?? 0];
  }

  let images: ({ width: number, height: number })[] = [];

  if ((source.sourceType === TextureSourceType.mipmaps || source.sourceType === TextureSourceType.compressed) && source.mipmaps.length) {
    const baseLevel = source.mipmaps[0];

    images = Array.isArray(baseLevel) ? baseLevel : [baseLevel];
  } else if (source.target === glContext.TEXTURE_CUBE_MAP && 'cube' in source) {
    images = source.cube;
  } else if (source.sourceType === TextureSourceType.image && 'image' in source) {
    images = [source.image];
  } else if (source.sourceType === TextureSourceType.data && 'data' in source) {
    images = [source.data];
  }
  let width = 0;
  let height = 0;

  for (const image of images) {
    width = Math.max(width, image.width);
    height = Math.max(height, image.height);
  }

  return [width, height];
}

type TextureJSONOptions = spec.SerializedTextureSource & spec.TextureConfigOptionsBase & spec.TextureFormatOptions;

export async function deserializeMipmapTexture (
  textureOptions: TextureJSONOptions,
  bins: ArrayBuffer[],
  imageSources: Record<string, any>,
  files: spec.BinaryFile[] = [],
): Promise<Texture2DSourceOptions | TextureCubeSourceOptions> {
  if (textureOptions.target === 34067) {
    const { mipmaps, target } = textureOptions as spec.SerializedTextureCube;
    const jobs = mipmaps.map(mipmap => Promise.all(mipmap.map(pointer => {
      // @ts-expect-error
      if (pointer.id) {
        // @ts-expect-error
        const loadedImage = imageSources[pointer.id];

        return loadedImage;
      } else {
        return loadMipmapImage(pointer, bins);
      }
    })));

    const loadedMipmaps = await Promise.all(jobs);

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
