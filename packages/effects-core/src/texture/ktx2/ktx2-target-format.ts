/**
 * KTX2 transcode target format.
 */
export enum KTX2TargetFormat {
  /** RGB(A) compressed format, 128 bits per 4x4 pixel block. */
  ASTC,
  /** RGB(A) compressed format, 128 bits per 4x4 pixel block. */
  BC7,
  /** RGB(A) compressed format, 4 bits per pixel if no alpha channel, 8 bits per pixel if has alpha channel. */
  BC1_BC3,
  /** RGB(A) compressed format, 4 bits per pixel. */
  PVRTC,
  /** RGB(A) compressed format, 4 bits per pixel if no alpha channel, 8 bits per pixel if has alpha channel. */
  ETC,
  /** R format, 8 bits per pixel. */
  R8,
  /** RG format, 16 bits per pixel. */
  R8G8,
  /** RGBA format, 32 bits per pixel. */
  R8G8B8A8
}

export enum CompressedTextureFormat {
  COMPRESSED_RGB8_ETC2 = 0x9274,
  COMPRESSED_SRGB8_ETC2 = 0x9275,

  COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9275,
  COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9276,

  COMPRESSED_RGBA8_ETC2_EAC = 0x9278,
  COMPRESSED_SRGB8_ALPHA8_ETC2_EAC = 0x9279,

  COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93B0,
  COMPRESSED_RGBA_ASTC_5x4_KHR = 0x93B1,
  COMPRESSED_RGBA_ASTC_5x5_KHR = 0x93B2,
  COMPRESSED_RGBA_ASTC_6x5_KHR = 0x93B3,
  COMPRESSED_RGBA_ASTC_6x6_KHR = 0x93B4,
  COMPRESSED_RGBA_ASTC_8x5_KHR = 0x93B5,
  COMPRESSED_RGBA_ASTC_8x6_KHR = 0x93B6,
  COMPRESSED_RGBA_ASTC_8x8_KHR = 0x93B7,

  COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR = 0x93D0,
  COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR = 0x93D1,
  COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR = 0x93D2,
  COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR = 0x93D3,
  COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR = 0x93D4,
  COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR = 0x93D5,
  COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR = 0x93D6,
  COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR = 0x93D7,

  COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 0x8C00,
  COMPRESSED_RGB_PVRTC_2BPPV1_IMG = 0x8C01,
  COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8C02,
  COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 0x8C03,

  COMPRESSED_SRGB_PVRTC_4BPPV1_EXT = 0x8A50,
  COMPRESSED_SRGB_PVRTC_2BPPV1_EXT = 0x8A51,
  COMPRESSED_SRGB_ALPHA_PVRTC_4BPPV1_EXT = 0x8A52,
  COMPRESSED_SRGB_ALPHA_PVRTC_2BPPV1_EXT = 0x8A53,
}

/**
 * Texture format enumeration.
 */
export enum TextureFormat {
  /** RGB format, 8 bits per channel. */
  R8G8B8 = 0,
  /** RGBA format, 8 bits per channel. */
  R8G8B8A8 = 1,
  /** RGBA format, 4 bits per channel. */
  R4G4B4A4 = 2,
  /** RGBA format, 5 bits in R channel, 5 bits in G channel, 5 bits in B channel, 1 bit in A channel. */
  R5G5B5A1 = 3,
  /** RGB format, 5 bits in R channel, 6 bits in G channel, 5 bits in B channel. */
  R5G6B5 = 4,
  /** RGBA format, 16 bits per channel. */
  R16G16B16A16 = 7,
  /** RGBA format, 32 bits per channel. */
  R32G32B32A32 = 8,
  /** RGBA unsigned integer format, 32 bits per channel. */
  R32G32B32A32_UInt = 9,
  /** RGB unsigned float format, 11 bits in R channel, 11 bits in G channel, 10 bits in B channel. */
  R11G11B10_UFloat = 35,
  /** R float format, 8 bits. */
  R8 = 36,
  /** RG float format, 8 bits per channel. */
  R8G8 = 37,
  /** RGB compressed format, 4 bits per pixel. */
  BC1 = 10,
  /** RGBA compressed format, 8 bits per pixel. */
  BC3 = 11,
  /** RGB(A) compressed format, 128 bits per 4x4 pixel block. */
  BC7 = 12,
  /** RGB compressed format, 4 bits per pixel. */
  ETC1_RGB = 13,
  /** RGB compressed format, 4 bits per pixel. */
  ETC2_RGB = 14,
  /** RGBA compressed format, 5 bits per pixel, 4 bit in RGB, 1 bit in A. */
  ETC2_RGBA5 = 15,
  /** RGB compressed format, 8 bits per pixel. */
  ETC2_RGBA8 = 16,
  /** RGB compressed format, 2 bits per pixel. */
  PVRTC_RGB2 = 17,
  /** RGBA compressed format, 2 bits per pixel. */
  PVRTC_RGBA2 = 18,
  /** RGB compressed format, 4 bits per pixel. */
  PVRTC_RGB4 = 19,
  /** RGBA compressed format, 4 bits per pixel. */
  PVRTC_RGBA4 = 20,
  /** RGB(A) compressed format, 128 bits per 4x4 pixel block. */
  ASTC_4x4 = 21,
  /** RGB(A) compressed format, 128 bits per 5x5 pixel block. */
  ASTC_5x5 = 22,
  /** RGB(A) compressed format, 128 bits per 6x6 pixel block. */
  ASTC_6x6 = 23,
  /** RGB(A) compressed format, 128 bits per 8x8 pixel block. */
  ASTC_8x8 = 24,
  /** RGB(A) compressed format, 128 bits per 10x10 pixel block. */
  ASTC_10x10 = 25,
  /** RGB(A) compressed format, 128 bits per 12x12 pixel block. */
  ASTC_12x12 = 26,
  /** Automatic depth format, engine will automatically select the supported precision. */
  Depth = 27,
  /** Render to stencil buffer. */
  Stencil = 28,
  /** Automatic depth stencil format, engine will automatically select the supported precision. */
  DepthStencil = 29,
  /** 16-bit depth format. */
  Depth16 = 30,
  /** 24-bit depth format. */
  Depth24 = 31,
  /** 32-bit depth format. */
  Depth32 = 32,
  /** 16-bit depth + 8-bit stencil format. */
  Depth24Stencil8 = 33,
  /** 32-bit depth + 8-bit stencil format. */
  Depth32Stencil8 = 34,
  /** @deprecated Use 'TextureFormat.R8' instead. */
  Alpha8 = 5,
  /** @deprecated Use 'TextureFormat.R8G8' instead. */
  LuminanceAlpha = 6,
  /** @deprecated Use `TextureFormat.BC1` instead. */
  DXT1 = 10,
  /** @deprecated Use `TextureFormat.BC3` instead. */
  DXT5 = 11
}
