import type { Texture2DSourceOptions, Texture2DSourceOptionsImage, TextureCubeSourceOptions, TextureCubeSourceOptionsImageMipmaps, TextureFactorySource2DFrom, TextureFactorySourceFrom, TextureSourceType, spec } from '@galacean/effects';
import { getImageFileContent, loadMipmaps } from './utils';

export interface TextureSerializationResult {
  version: '1.0',
  // cube texture 的所有 mipmaps 会被打入 bins 中，每个 cube texture 生成一个 bin
  // image mipmaps 也会被写入 bins 中
  bins?: ArrayBuffer[],
  // 每个 image texture2D 会被写入 image 对象中
  images: ArrayBuffer[],
  textures: spec.TextureJSONOptions[],
}

const TextureSourceTypeImage: TextureSourceType = 2;

/**
 * texture 序列化
 * @param textureOptions
 */
export async function serializeTextures (
  textureOptions: (Texture2DSourceOptions | TextureCubeSourceOptions)[]
): Promise<TextureSerializationResult> {
  const imageBufferSet: Map<string, Promise<ArrayBuffer>> = new Map();
  const filesPending: Promise<ArrayBuffer>[] = [];
  const cubesPending: Promise<void>[] = [];
  const imageMap = new Map<Texture2DSourceOptions | TextureCubeSourceOptions, ArrayBuffer>();
  const cubeMap = new Map<Texture2DSourceOptions | TextureCubeSourceOptions, { data: ArrayBuffer, mipmaps: spec.SerializedTextureCubeMipmap[] }>();

  for (let i = 0; i < textureOptions.length; i++) {
    const texture = textureOptions[i];
    const sourceFrom = texture.sourceFrom as TextureFactorySourceFrom;
    const { target } = texture as TextureCubeSourceOptionsImageMipmaps;
    const { image } = texture as Texture2DSourceOptionsImage;

    if (
      sourceFrom &&
      sourceFrom.type === TextureSourceTypeImage &&
      sourceFrom.target !== WebGLRenderingContext.TEXTURE_CUBE_MAP
    ) {
      const { url } = sourceFrom as TextureFactorySource2DFrom;
      const job = async () => {
        const result = await fetch(url);
        const buffer = await result.arrayBuffer();

        imageMap.set(texture, buffer);

        return buffer;
      };

      filesPending.push(job());
      continue;
    }

    if (target === WebGLRenderingContext.TEXTURE_CUBE_MAP) {
      const job = async () => {
        const result = await loadMipmaps(texture as TextureCubeSourceOptionsImageMipmaps, cubesPending.length);

        cubeMap.set(texture, result);
      };

      cubesPending.push(job());
      continue;
    }

    if (image instanceof HTMLImageElement) {
      const url = image.src;

      if (!imageBufferSet.has(url)) {
        imageBufferSet.set(url, getImageFileContent(image));
      }

      const job = async () => {
        const buffer = await imageBufferSet.get(url)!;

        imageMap.set(texture, buffer);

        return buffer;
      };

      filesPending.push(job());
    } else {
      throw new Error(`tex ${i} image should be HTMLImage or HTMLCanvas`);
    }
  }

  await Promise.all(cubesPending);

  const files = await Promise.all(filesPending);
  const images = Array.from(new Set(files));
  const resultTextures: spec.SerializedTextureSource[] = [];
  const bins: ArrayBuffer[] = [];
  let tex: spec.SerializedTextureSource;

  for (let i = 0; i < textureOptions.length; i++) {
    const texture = textureOptions[i];

    if (texture.target === WebGLRenderingContext.TEXTURE_CUBE_MAP) {
      const info = cubeMap.get(texture)!;

      bins.push(info.data);
      tex = { ...texture, ...{ mipmaps: info.mipmaps, sourceType: 7 } } as spec.SerializedTextureCube;
      if ('cube' in tex) {
        delete tex.cube;
      }
    } else {
      const buffer = imageMap.get(texture)!;

      tex = { ...texture, ...{ source: images.indexOf(buffer) } } as spec.SerializedTexture2D;
      if ('mipmaps' in tex) {
        // @ts-expect-error
        delete tex.mipmaps;
      }
    }
    if ('sourceFrom' in tex) {
      delete tex.sourceFrom;
    }
    if ('image' in tex) {
      delete tex.image;
    }
    resultTextures.push(tex);
  }

  return {
    version: '1.0',
    images,
    bins,
    textures: resultTextures,
  };
}
