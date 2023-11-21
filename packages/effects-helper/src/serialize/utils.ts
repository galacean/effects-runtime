import { spec } from '@galacean/effects';
import type { TextureCubeSourceOptionsImage, TextureCubeSourceOptionsImageMipmaps } from '@galacean/effects';

export async function loadMipmaps (
  textureOptions: TextureCubeSourceOptionsImageMipmaps | TextureCubeSourceOptionsImage,
  dataIndex: number,
): Promise<{ data: ArrayBuffer, mipmaps: spec.SerializedTextureCubeMipmap[] }> {
  const { mipmaps } = textureOptions as TextureCubeSourceOptionsImageMipmaps;
  const { cube } = textureOptions as TextureCubeSourceOptionsImage;
  const textureCubeMipmaps = mipmaps || [cube];
  const jobs = textureCubeMipmaps.map(mipmap => Promise.all(
    mipmap.map(imageLike => {
      if (imageLike instanceof HTMLImageElement) {
        return getImageFileContent(imageLike);
      }

      return Promise.reject('invalid image format');
    })
  ));
  const newMipmaps = await Promise.all(jobs);
  const images: ArrayBuffer[] = [];

  newMipmaps.forEach(mipmap => images.push(...mipmap));

  const result = concatArrayBuffers(images);
  const cubeMipmaps: spec.SerializedTextureCubeMipmap[] = [];

  for (let i = 0; i < textureCubeMipmaps.length; i++) {
    const mipmap = textureCubeMipmaps[i];
    const mipmapPointers = [] as unknown as spec.SerializedTextureCubeMipmap;

    for (let j = 0; j < mipmap.length; j++) {
      const pointer = mipmapPointers[j] = result.pointers[i * 6 + j];

      pointer[1][0] = dataIndex;
    }

    cubeMipmaps.push(mipmapPointers);
  }

  return {
    data: result.data,
    mipmaps: cubeMipmaps,
  };
}

export async function getImageFileContent (image: HTMLImageElement | ImageBitmap | HTMLVideoElement): Promise<ArrayBuffer> {
  const canvas = document.createElement('canvas');

  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')?.drawImage(image, 0, 0);

  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob.arrayBuffer());
        } else {
          reject(Error('no canvas blob'));
        }
      },
      'image/png',
      1,
    );
  });
}

export function concatBuffers (
  buffers: (spec.TypedArray | ArrayBuffer)[],
  bufferInfo: Map<spec.TypedArray | ArrayBuffer, spec.BinaryPointerContent>,
  length: number,
): ArrayBuffer {
  const ret = new Uint8Array(length);

  buffers.forEach(buffer => {
    const [, offset, byteLength] = bufferInfo.get(buffer)!;
    const source = buffer instanceof ArrayBuffer ? new Uint8Array(buffer, 0, byteLength) : new Uint8Array(buffer.buffer, buffer.byteOffset, byteLength);

    ret.set(source, offset);
  });

  return ret.buffer;
}

export function getBinaryType (arr: spec.TypedArray | ArrayBuffer): spec.BinaryType {
  if (arr instanceof Uint8Array) {
    return 'u8';
  } else if (arr instanceof Int8Array) {
    return 'i8';
  } else if (arr instanceof Uint16Array) {
    return 'u16';
  } else if (arr instanceof Int16Array) {
    return 'i16';
  } else if (arr instanceof Uint32Array) {
    return 'u32';
  } else if (arr instanceof Int32Array) {
    return 'i32';
  } else if (arr instanceof Float32Array) {
    return 'f32';
  }

  return '';
}

/**
 * 工具方法，按照 4bytes 对齐方式合并 buffers，如果提供了 pointer，会把原来的 pointer 转化为新的映射
 * 返回的 pointers 数组和传入的 pointers 数组长度一致，并且一一对应
 * @internal
 * @param buffers
 * @param pointers - 如果不提供 pointers，将返回整段 buffers 的 pointer 重映射
 * @param overwrite - 如果为 true，将直接改写参数中的 pointer 值，否则生成新的 pointer 传出
 */
export function concatArrayBuffers (
  buffers: (spec.TypedArray | ArrayBuffer)[],
  pointers?: spec.BinaryPointer[],
  overwrite?: boolean,
): { data: ArrayBuffer, pointers: spec.BinaryPointer[] } {
  const bufferInfo: Map<spec.TypedArray | ArrayBuffer, spec.BinaryPointerContent> = new Map();
  let offset = 0;

  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    const content: spec.BinaryPointerContent = [0, offset, buffer.byteLength];
    const type = getBinaryType(buffer);

    if (type) {
      content[3] = type;
    }
    bufferInfo.set(buffer, content);
    offset += buffer.byteLength;
    // padding 4bytes for f32
    offset = Math.ceil(offset / 4) * 4;
  }

  if (!pointers) {
    pointers = buffers.map((buffer, i) => {
      return [spec.ValueType.BINARY, [i, 0, buffer.byteLength]];
    });
  }

  const retBuffer = concatBuffers(buffers, bufferInfo, offset);
  const mappedPointers: spec.BinaryPointer[] = pointers.map(pointer => {
    const content = pointer[1];
    const buffer = buffers[content[0]];

    if (!buffer) {
      throw new Error(`buffer index ${content[0]} not found`);
    }
    const originStart = content[1] || 0;
    const byteLength = content[2] || (buffer.byteLength - originStart);
    const info = bufferInfo.get(buffer) ?? [];
    // @ts-expect-error
    const binaryPointerContent: spec.BinaryPointerContent = [0, originStart + info[1], byteLength];

    if (info[3]) {
      binaryPointerContent[3] = info[3];
    }
    if (overwrite) {
      pointer[1] = binaryPointerContent;

      return pointer;
    }

    return [spec.ValueType.BINARY, binaryPointerContent];
  });

  return {
    data: retBuffer,
    pointers: mappedPointers,
  };
}
