import type * as spec from '@galacean/effects-specification';
import type { Texture2DSourceOptions, TextureCubeSourceOptions } from './types';
import { TextureSourceType } from './types';
import { loadImage } from '../downloader';

type TextureJSONOptions = spec.SerializedTextureSource & spec.TextureConfigOptionsBase & spec.TextureFormatOptions;

export async function deserializeMipmapTexture (
  textureOptions: TextureJSONOptions,
  bins: ArrayBuffer[],
  assets: Record<string, any>,
  files: spec.BinaryFile[] = [],
): Promise<Texture2DSourceOptions | TextureCubeSourceOptions> {
  if (textureOptions.target === 34067) {
    const { mipmaps, target } = textureOptions as spec.SerializedTextureCube;
    const jobs = mipmaps.map(mipmap => Promise.all(mipmap.map(pointer => {
      // @ts-expect-error
      if (pointer.id) {
        // @ts-expect-error
        const loadedImage = assets[pointer.id];

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

export function detectKTXVersion (data: Uint8Array): 'KTX' | 'KTX2' | 'unknown' {
  // KTX 和 KTX2 的通用头部标识（前 5 和后 5 字节相同）
  const commonPrefix = [0xab, 0x4b, 0x54, 0x58, 0x20];
  const commonSuffix = [0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

  if (data.length < 12) {
    return 'unknown';
  }

  // 检查固定头部和尾部
  for (let i = 0; i < 5; i++) {
    if (data[i] !== commonPrefix[i]) {return 'unknown';}
  }
  for (let i = 0; i < 5; i++) {
    if (data[7 + i] !== commonSuffix[i]) {return 'unknown';}
  }

  // 检查中间的版本号
  const versionMinor1 = data[5];
  const versionMinor2 = data[6];

  // KTX: " 11" -> ASCII 0x20 0x31 0x31
  // KTX2: " 20" -> ASCII 0x20 0x32 0x30
  if (versionMinor1 === 0x31 && versionMinor2 === 0x31) {
    return 'KTX';
  } else if (versionMinor1 === 0x32 && versionMinor2 === 0x30) {
    return 'KTX2';
  }

  return 'unknown';
}

export function isPowerOfTwo (value: number) {
  return (value & (value - 1)) === 0 && value !== 0;
}