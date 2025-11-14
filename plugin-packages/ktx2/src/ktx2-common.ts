/**
 * KTX2 transcode target format.
 * if you modify this file, please also modify KTX2TargetFormat in binomial-workercode.ts
 */
export enum KTX2TargetFormat {
  /** RGB(A) compressed format, 128 bits per 4x4 pixel block. */
  ASTC,
  /** RGB(A) compressed format, 4 bits per pixel. */
  PVRTC,
  /** RGB(A) compressed format, 4 bits per pixel if no alpha channel, 8 bits per pixel if has alpha channel. */
  ETC,
  /** RGB compressed format, 4 bits per pixel (no alpha support). */
  ETC1,
  /** RGBA format, 32 bits per pixel. */
  RGBA8
}

/**
 * Texture format enumeration.
 */
export enum TextureFormat {
  /** RGB format, 8 bits per channel. */
  R8G8B8 = 0,
  /** RGBA format, 8 bits per channel. */
  R8G8B8A8 = 1,
  /** RGB(A) compressed format, 128 bits per 4x4 pixel block. */
  ASTC_4x4 = 2,
  /** RGB compressed format, 4 bits per pixel. */
  ETC2_RGB = 3,
  /** RGB compressed format, 8 bits per pixel. */
  ETC2_RGBA8 = 4,
  /** RGB compressed format, 4 bits per pixel (no alpha support). */
  ETC1_RGB = 5,
  /** RGB compressed format, 2 bits per pixel. */
  PVRTC_RGB2 = 6,
  /** RGBA compressed format, 2 bits per pixel. */
  PVRTC_RGBA2 = 7,
  /** RGB compressed format, 4 bits per pixel. */
  PVRTC_RGB4 = 8,
  /** RGBA compressed format, 4 bits per pixel. */
  PVRTC_RGBA4 = 9,
}
