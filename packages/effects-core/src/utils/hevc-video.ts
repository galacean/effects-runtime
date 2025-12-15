import * as spec from '@galacean/effects-specification';

/**
 * Check if the browser can play the given HEVC codec.
 * @param codec - The HEVC codec to check.
 * @returns True if the browser can probably or maybe play the codec, false otherwise.
 */
export function canPlayHevcCodec (codec: spec.HevcVideoCodec): boolean {
  const video = document.createElement('video');
  const contentType = `video/mp4; codecs="${codec}"`;
  const result = video.canPlayType(contentType);

  return result === 'probably' || result === 'maybe';
}

/**
 * Parse the given codec string into a HEVC video codec enum value.
 * @param codec - The codec string to parse.
 * @returns The corresponding HEVC video codec enum value, or undefined if the codec is invalid.
 */
export function parseCodec (codec: string): spec.HevcVideoCodec | undefined {
  // 传入的是完整的枚举值
  if (isCodecValue(codec)) {
    return codec;
  }

  // 传入的是枚举名称
  if (isCodecKey(codec)) {
    return spec.HevcVideoCodec[codec];
  }

  return undefined;
}

function isCodecValue (codec: string): codec is spec.HevcVideoCodec {
  return Object
    .keys(spec.HevcVideoCodec)
    .some(key =>
      spec.HevcVideoCodec[key as keyof typeof spec.HevcVideoCodec] as string === codec
    );
}

function isCodecKey (codec: string): codec is keyof typeof spec.HevcVideoCodec {
  return codec in spec.HevcVideoCodec;
}
