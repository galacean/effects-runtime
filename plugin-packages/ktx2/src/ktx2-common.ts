/**
 * KTX2 transcode target format.
 * if you modify this file, please also modify KTX2TargetFormat in binomial-workercode.ts
 */
export enum KTX2TargetFormat {
  /** RGB(A) compressed format, 128 bits per 4x4 pixel block. */
  ASTC = 0
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
  ASTC_4x4 = 2
}
