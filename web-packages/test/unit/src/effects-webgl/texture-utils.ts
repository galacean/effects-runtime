// @ts-nocheck
// https://github.com/greggman/webgl-memory/blob/main/src/texture-utils.js
/* PixelFormat */
const ALPHA = 0x1906;
const RGB = 0x1907;
const RGBA = 0x1908;
const LUMINANCE = 0x1909;
const LUMINANCE_ALPHA = 0x190A;
const DEPTH_COMPONENT = 0x1902;
const DEPTH_STENCIL = 0x84F9;

const R8 = 0x8229;
const R8_SNORM = 0x8F94;
const R16F = 0x822D;
const R32F = 0x822E;
const R8UI = 0x8232;
const R8I = 0x8231;
const RG16UI = 0x823A;
const RG16I = 0x8239;
const RG32UI = 0x823C;
const RG32I = 0x823B;
const RG8 = 0x822B;
const RG8_SNORM = 0x8F95;
const RG16F = 0x822F;
const RG32F = 0x8230;
const RG8UI = 0x8238;
const RG8I = 0x8237;
const R16UI = 0x8234;
const R16I = 0x8233;
const R32UI = 0x8236;
const R32I = 0x8235;
const RGB8 = 0x8051;
const SRGB8 = 0x8C41;
const RGB565 = 0x8D62;
const RGB8_SNORM = 0x8F96;
const R11F_G11F_B10F = 0x8C3A;
const RGB9_E5 = 0x8C3D;
const RGB16F = 0x881B;
const RGB32F = 0x8815;
const RGB8UI = 0x8D7D;
const RGB8I = 0x8D8F;
const RGB16UI = 0x8D77;
const RGB16I = 0x8D89;
const RGB32UI = 0x8D71;
const RGB32I = 0x8D83;
const RGBA8 = 0x8058;
const SRGB8_ALPHA8 = 0x8C43;
const RGBA8_SNORM = 0x8F97;
const RGB5_A1 = 0x8057;
const RGBA4 = 0x8056;
const RGB10_A2 = 0x8059;
const RGBA16F = 0x881A;
const RGBA32F = 0x8814;
const RGBA8UI = 0x8D7C;
const RGBA8I = 0x8D8E;
const RGB10_A2UI = 0x906F;
const RGBA16UI = 0x8D76;
const RGBA16I = 0x8D88;
const RGBA32I = 0x8D82;
const RGBA32UI = 0x8D70;

const DEPTH_COMPONENT16 = 0x81A5;
const DEPTH_COMPONENT24 = 0x81A6;
const DEPTH_COMPONENT32F = 0x8CAC;
const DEPTH32F_STENCIL8 = 0x8CAD;
const DEPTH24_STENCIL8 = 0x88F0;

/* DataType */
// const BYTE                         = 0x1400;
const UNSIGNED_BYTE = 0x1401;
// const SHORT                        = 0x1402;
const UNSIGNED_SHORT = 0x1403;
// const INT                          = 0x1404;
const UNSIGNED_INT = 0x1405;
const FLOAT = 0x1406;
const UNSIGNED_SHORT_4_4_4_4 = 0x8033;
const UNSIGNED_SHORT_5_5_5_1 = 0x8034;
const UNSIGNED_SHORT_5_6_5 = 0x8363;
const HALF_FLOAT = 0x140B;
const HALF_FLOAT_OES = 0x8D61;  // Thanks Khronos for making this different >:(
// const UNSIGNED_INT_2_10_10_10_REV  = 0x8368;
// const UNSIGNED_INT_10F_11F_11F_REV = 0x8C3B;
// const UNSIGNED_INT_5_9_9_9_REV     = 0x8C3E;
// const FLOAT_32_UNSIGNED_INT_24_8_REV = 0x8DAD;
// const UNSIGNED_INT_24_8            = 0x84FA;

const RG = 0x8227;
const RG_INTEGER = 0x8228;
const RED = 0x1903;
const RED_INTEGER = 0x8D94;
const RGB_INTEGER = 0x8D98;
const RGBA_INTEGER = 0x8D99;

const SRGB_ALPHA_EXT = 0x8C42;

const formatInfo = {};

{
  // NOTE: this is named `numColorComponents` vs `numComponents` so we can let Uglify mangle
  // the name.
  const f = formatInfo;

  f[ALPHA] = { numColorComponents: 1 };
  f[LUMINANCE] = { numColorComponents: 1 };
  f[LUMINANCE_ALPHA] = { numColorComponents: 2 };
  f[RGB] = { numColorComponents: 3 };
  f[RGBA] = { numColorComponents: 4 };
  f[RED] = { numColorComponents: 1 };
  f[RED_INTEGER] = { numColorComponents: 1 };
  f[RG] = { numColorComponents: 2 };
  f[RG_INTEGER] = { numColorComponents: 2 };
  f[RGB] = { numColorComponents: 3 };
  f[RGB_INTEGER] = { numColorComponents: 3 };
  f[RGBA] = { numColorComponents: 4 };
  f[RGBA_INTEGER] = { numColorComponents: 4 };
  f[DEPTH_COMPONENT] = { numColorComponents: 1 };
  f[DEPTH_STENCIL] = { numColorComponents: 2 };
}

/**
 * @typedef {Object} TextureFormatDetails
 * @property {number} textureFormat format to pass texImage2D and similar functions.
 * @property {boolean} colorRenderable true if you can render to this format of texture.
 * @property {boolean} textureFilterable true if you can filter the texture, false if you can ony use `NEAREST`.
 * @property {number[]} type Array of possible types you can pass to texImage2D and similar function
 * @property {Object.<number,number>} bytesPerElementMap A map of types to bytes per element
 * @private
 */

let s_textureInternalFormatInfo;

function getTextureInternalFormatInfo (internalFormat) {
  if (!s_textureInternalFormatInfo) {
    // NOTE: these properties need unique names so we can let Uglify mangle the name.
    const t = {};

    // unsized formats
    t[ALPHA] = { bytesPerElement: [1, 2, 2, 4], type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT] };
    t[LUMINANCE] = { bytesPerElement: [1, 2, 2, 4], type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT] };
    t[LUMINANCE_ALPHA] = { bytesPerElement: [2, 4, 4, 8], type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT] };
    t[RGB] = { bytesPerElement: [3, 6, 6, 12, 2], type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT, UNSIGNED_SHORT_5_6_5] };
    t[RGBA] = { bytesPerElement: [4, 8, 8, 16, 2, 2], type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT, UNSIGNED_SHORT_4_4_4_4, UNSIGNED_SHORT_5_5_5_1] };
    t[SRGB_ALPHA_EXT] = { bytesPerElement: [4, 8, 8, 16, 2, 2], type: [UNSIGNED_BYTE, HALF_FLOAT, HALF_FLOAT_OES, FLOAT, UNSIGNED_SHORT_4_4_4_4, UNSIGNED_SHORT_5_5_5_1] };
    t[DEPTH_COMPONENT] = { bytesPerElement: [2, 4], type: [UNSIGNED_INT, UNSIGNED_SHORT] };
    t[DEPTH_STENCIL] = { bytesPerElement: [4] };

    // sized formats
    t[R8] = { bytesPerElement: [1] };
    t[R8_SNORM] = { bytesPerElement: [1] };
    t[R16F] = { bytesPerElement: [2] };
    t[R32F] = { bytesPerElement: [4] };
    t[R8UI] = { bytesPerElement: [1] };
    t[R8I] = { bytesPerElement: [1] };
    t[R16UI] = { bytesPerElement: [2] };
    t[R16I] = { bytesPerElement: [2] };
    t[R32UI] = { bytesPerElement: [4] };
    t[R32I] = { bytesPerElement: [4] };
    t[RG8] = { bytesPerElement: [2] };
    t[RG8_SNORM] = { bytesPerElement: [2] };
    t[RG16F] = { bytesPerElement: [4] };
    t[RG32F] = { bytesPerElement: [8] };
    t[RG8UI] = { bytesPerElement: [2] };
    t[RG8I] = { bytesPerElement: [2] };
    t[RG16UI] = { bytesPerElement: [4] };
    t[RG16I] = { bytesPerElement: [4] };
    t[RG32UI] = { bytesPerElement: [8] };
    t[RG32I] = { bytesPerElement: [8] };
    t[RGB8] = { bytesPerElement: [3] };
    t[SRGB8] = { bytesPerElement: [3] };
    t[RGB565] = { bytesPerElement: [2] };
    t[RGB8_SNORM] = { bytesPerElement: [3] };
    t[R11F_G11F_B10F] = { bytesPerElement: [4] };
    t[RGB9_E5] = { bytesPerElement: [4] };
    t[RGB16F] = { bytesPerElement: [6] };
    t[RGB32F] = { bytesPerElement: [12] };
    t[RGB8UI] = { bytesPerElement: [3] };
    t[RGB8I] = { bytesPerElement: [3] };
    t[RGB16UI] = { bytesPerElement: [6] };
    t[RGB16I] = { bytesPerElement: [6] };
    t[RGB32UI] = { bytesPerElement: [12] };
    t[RGB32I] = { bytesPerElement: [12] };
    t[RGBA8] = { bytesPerElement: [4] };
    t[SRGB8_ALPHA8] = { bytesPerElement: [4] };
    t[RGBA8_SNORM] = { bytesPerElement: [4] };
    t[RGB5_A1] = { bytesPerElement: [2] };
    t[RGBA4] = { bytesPerElement: [2] };
    t[RGB10_A2] = { bytesPerElement: [4] };
    t[RGBA16F] = { bytesPerElement: [8] };
    t[RGBA32F] = { bytesPerElement: [16] };
    t[RGBA8UI] = { bytesPerElement: [4] };
    t[RGBA8I] = { bytesPerElement: [4] };
    t[RGB10_A2UI] = { bytesPerElement: [4] };
    t[RGBA16UI] = { bytesPerElement: [8] };
    t[RGBA16I] = { bytesPerElement: [8] };
    t[RGBA32I] = { bytesPerElement: [16] };
    t[RGBA32UI] = { bytesPerElement: [16] };
    // Sized Internal
    t[DEPTH_COMPONENT16] = { bytesPerElement: [2] };
    t[DEPTH_COMPONENT24] = { bytesPerElement: [4] };
    t[DEPTH_COMPONENT32F] = { bytesPerElement: [4] };
    t[DEPTH24_STENCIL8] = { bytesPerElement: [4] };
    t[DEPTH32F_STENCIL8] = { bytesPerElement: [4] };

    s_textureInternalFormatInfo = t;
  }

  return s_textureInternalFormatInfo[internalFormat];
}

function makeComputeBlockRectSizeFunction (blockWidth, blockHeight, bytesPerBlock) {
  return function (width, height, depth) {
    const blocksAcross = (width + blockWidth - 1) / blockWidth | 0;
    const blocksDown = (height + blockHeight - 1) / blockHeight | 0;

    return blocksAcross * blocksDown * bytesPerBlock * depth;
  };
}

function makeComputePaddedRectSizeFunction (minWidth, minHeight, divisor) {
  return function (width, height, depth) {
    return (Math.max(width, minWidth) * Math.max(height, minHeight) / divisor | 0) * depth;
  };
}

// WEBGL_compressed_texture_s3tc
const COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;
const COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
const COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
const COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;
// WEBGL_compressed_texture_etc1
const COMPRESSED_RGB_ETC1_WEBGL = 0x8D64;
// WEBGL_compressed_texture_pvrtc
const COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 0x8C00;
const COMPRESSED_RGB_PVRTC_2BPPV1_IMG = 0x8C01;
const COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8C02;
const COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 0x8C03;
// WEBGL_compressed_texture_etc
const COMPRESSED_R11_EAC = 0x9270;
const COMPRESSED_SIGNED_R11_EAC = 0x9271;
const COMPRESSED_RG11_EAC = 0x9272;
const COMPRESSED_SIGNED_RG11_EAC = 0x9273;
const COMPRESSED_RGB8_ETC2 = 0x9274;
const COMPRESSED_SRGB8_ETC2 = 0x9275;
const COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9276;
const COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2 = 0x9277;
const COMPRESSED_RGBA8_ETC2_EAC = 0x9278;
const COMPRESSED_SRGB8_ALPHA8_ETC2_EAC = 0x9279;
// WEBGL_compressed_texture_astc
const COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93B0;
const COMPRESSED_RGBA_ASTC_5x4_KHR = 0x93B1;
const COMPRESSED_RGBA_ASTC_5x5_KHR = 0x93B2;
const COMPRESSED_RGBA_ASTC_6x5_KHR = 0x93B3;
const COMPRESSED_RGBA_ASTC_6x6_KHR = 0x93B4;
const COMPRESSED_RGBA_ASTC_8x5_KHR = 0x93B5;
const COMPRESSED_RGBA_ASTC_8x6_KHR = 0x93B6;
const COMPRESSED_RGBA_ASTC_8x8_KHR = 0x93B7;
const COMPRESSED_RGBA_ASTC_10x5_KHR = 0x93B8;
const COMPRESSED_RGBA_ASTC_10x6_KHR = 0x93B9;
const COMPRESSED_RGBA_ASTC_10x8_KHR = 0x93BA;
const COMPRESSED_RGBA_ASTC_10x10_KHR = 0x93BB;
const COMPRESSED_RGBA_ASTC_12x10_KHR = 0x93BC;
const COMPRESSED_RGBA_ASTC_12x12_KHR = 0x93BD;
const COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR = 0x93D0;
const COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR = 0x93D1;
const COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR = 0x93D2;
const COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR = 0x93D3;
const COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR = 0x93D4;
const COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR = 0x93D5;
const COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR = 0x93D6;
const COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR = 0x93D7;
const COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR = 0x93D8;
const COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR = 0x93D9;
const COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR = 0x93DA;
const COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR = 0x93DB;
const COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR = 0x93DC;
const COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR = 0x93DD;
// WEBGL_compressed_texture_s3tc_srgb
const COMPRESSED_SRGB_S3TC_DXT1_EXT = 0x8C4C;
const COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT = 0x8C4D;
const COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT = 0x8C4E;
const COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT = 0x8C4F;
// EXT_texture_compression_bptc
const COMPRESSED_RGBA_BPTC_UNORM_EXT = 0x8E8C;
const COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT = 0x8E8D;
const COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT = 0x8E8E;
const COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT = 0x8E8F;
// EXT_texture_compression_rgtc
const COMPRESSED_RED_RGTC1_EXT = 0x8DBB;
const COMPRESSED_SIGNED_RED_RGTC1_EXT = 0x8DBC;
const COMPRESSED_RED_GREEN_RGTC2_EXT = 0x8DBD;
const COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT = 0x8DBE;

const compressedTextureFunctions = new Map([
  [COMPRESSED_RGB_S3TC_DXT1_EXT, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_RGBA_S3TC_DXT1_EXT, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_RGBA_S3TC_DXT3_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_RGBA_S3TC_DXT5_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],

  [COMPRESSED_RGB_ETC1_WEBGL, makeComputeBlockRectSizeFunction(4, 4, 8)],

  [COMPRESSED_RGB_PVRTC_4BPPV1_IMG, makeComputePaddedRectSizeFunction(8, 8, 2)],
  [COMPRESSED_RGBA_PVRTC_4BPPV1_IMG, makeComputePaddedRectSizeFunction(8, 8, 2)],
  [COMPRESSED_RGB_PVRTC_2BPPV1_IMG, makeComputePaddedRectSizeFunction(16, 8, 4)],
  [COMPRESSED_RGBA_PVRTC_2BPPV1_IMG, makeComputePaddedRectSizeFunction(16, 8, 4)],

  [COMPRESSED_R11_EAC, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_SIGNED_R11_EAC, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_RGB8_ETC2, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_SRGB8_ETC2, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2, makeComputeBlockRectSizeFunction(4, 4, 8)],

  [COMPRESSED_RG11_EAC, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_SIGNED_RG11_EAC, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_RGBA8_ETC2_EAC, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ETC2_EAC, makeComputeBlockRectSizeFunction(4, 4, 16)],

  [COMPRESSED_RGBA_ASTC_4x4_KHR, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_RGBA_ASTC_5x4_KHR, makeComputeBlockRectSizeFunction(5, 4, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR, makeComputeBlockRectSizeFunction(5, 4, 16)],
  [COMPRESSED_RGBA_ASTC_5x5_KHR, makeComputeBlockRectSizeFunction(5, 5, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR, makeComputeBlockRectSizeFunction(5, 5, 16)],
  [COMPRESSED_RGBA_ASTC_6x5_KHR, makeComputeBlockRectSizeFunction(6, 5, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR, makeComputeBlockRectSizeFunction(6, 5, 16)],
  [COMPRESSED_RGBA_ASTC_6x6_KHR, makeComputeBlockRectSizeFunction(6, 6, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR, makeComputeBlockRectSizeFunction(6, 6, 16)],
  [COMPRESSED_RGBA_ASTC_8x5_KHR, makeComputeBlockRectSizeFunction(8, 5, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR, makeComputeBlockRectSizeFunction(8, 5, 16)],
  [COMPRESSED_RGBA_ASTC_8x6_KHR, makeComputeBlockRectSizeFunction(8, 6, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR, makeComputeBlockRectSizeFunction(8, 6, 16)],
  [COMPRESSED_RGBA_ASTC_8x8_KHR, makeComputeBlockRectSizeFunction(8, 8, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR, makeComputeBlockRectSizeFunction(8, 8, 16)],
  [COMPRESSED_RGBA_ASTC_10x5_KHR, makeComputeBlockRectSizeFunction(10, 5, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR, makeComputeBlockRectSizeFunction(10, 5, 16)],
  [COMPRESSED_RGBA_ASTC_10x6_KHR, makeComputeBlockRectSizeFunction(10, 6, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR, makeComputeBlockRectSizeFunction(10, 6, 16)],
  [COMPRESSED_RGBA_ASTC_10x8_KHR, makeComputeBlockRectSizeFunction(10, 8, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR, makeComputeBlockRectSizeFunction(10, 8, 16)],
  [COMPRESSED_RGBA_ASTC_10x10_KHR, makeComputeBlockRectSizeFunction(10, 10, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR, makeComputeBlockRectSizeFunction(10, 10, 16)],
  [COMPRESSED_RGBA_ASTC_12x10_KHR, makeComputeBlockRectSizeFunction(12, 10, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR, makeComputeBlockRectSizeFunction(12, 10, 16)],
  [COMPRESSED_RGBA_ASTC_12x12_KHR, makeComputeBlockRectSizeFunction(12, 12, 16)],
  [COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR, makeComputeBlockRectSizeFunction(12, 12, 16)],

  [COMPRESSED_SRGB_S3TC_DXT1_EXT, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],

  [COMPRESSED_RGBA_BPTC_UNORM_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],

  [COMPRESSED_RED_RGTC1_EXT, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_SIGNED_RED_RGTC1_EXT, makeComputeBlockRectSizeFunction(4, 4, 8)],
  [COMPRESSED_RED_GREEN_RGTC2_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],
  [COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT, makeComputeBlockRectSizeFunction(4, 4, 16)],
]);

/**
 * Gets the number of bytes per element for a given internalFormat / type
 * @param {number} internalFormat The internalFormat parameter from texImage2D etc..
 * @param {number} type The type parameter for texImage2D etc..
 * @return {number} the number of bytes per element for the given internalFormat, type combo
 * @memberOf module:twgl/textures
 */
export function getBytesPerElementForInternalFormat (internalFormat, type) {
  const info = getTextureInternalFormatInfo(internalFormat);

  if (!info) {
    throw 'unknown internal format';
  }
  if (info.type) {
    const ndx = info.type.indexOf(type);

    if (ndx < 0) {
      throw new Error(`unsupported type ${type} for internalformat ${internalFormat}`);
    }

    return info.bytesPerElement[ndx];
  }

  return info.bytesPerElement[0];
}

function getBytesForMipUncompressed (internalFormat, width, height, depth, type) {
  const bytesPerElement = getBytesPerElementForInternalFormat(internalFormat, type);

  return width * height * depth * bytesPerElement;
}

export function getBytesForMip (internalFormat, width, height, depth, type) {
  const fn = compressedTextureFunctions.get(internalFormat);

  return fn ? fn(width, height, depth) : getBytesForMipUncompressed(internalFormat, width, height, depth, type);
}

export function readPixels (gl, texture, data) {
  const framebuffer = gl.createFramebuffer();

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  // attach texture to framebuffer
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const canRead = (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE);

  if (canRead) {
    gl.readPixels(0, 0, data.width, data.height, gl.RGBA, gl.UNSIGNED_BYTE, data.data);
  }
  gl.deleteFramebuffer(framebuffer);

  return canRead;
}

export function getTextureGPUInfo (texture, texOptions) {
  const gpuInfo = [0, 0, 0, []];

  gpuInfo[0] = texture.source.internalFormat;
  gpuInfo[1] = texture.source.type;
  gpuInfo[2] = texture.source.target;
  const mipmaps = texOptions.mipmaps;

  if (mipmaps) {
    mipmaps.forEach(tex => {
      if (tex.length) {
        gpuInfo[3].push([tex[0].width, tex[0].height]);

      } else {
        gpuInfo[3].push([tex.width, tex.height]);

      }
    });
  } else {
    gpuInfo[3].push([texture.width, texture.height]);
  }

  return gpuInfo;
}

export function getTextureMemory (tex, gpuInfo) {
  let size = 0;

  if (tex) {

    if (gpuInfo[0]) {
      const mipmapSizes = gpuInfo[3];
      const format = gpuInfo[0];
      const type = gpuInfo[1];
      const target = gpuInfo[2];
      const face = target === WebGLRenderingContext.TEXTURE_CUBE_MAP ? 6 : 1;

      for (let i = 0; i < mipmapSizes.length; i++) {
        const mipmapSize = mipmapSizes[i];
        const mipmapMemory = getBytesForMip(format, mipmapSize[0], mipmapSize[1], 1, type);

        size += mipmapMemory * face;
      }
    }
  }

  return size;
}

