// ============================================
// 数据类型常量
// ============================================
export const DATA_TYPES = {
  UNSIGNED_BYTE: 0x1401,
  FLOAT: 0x1406,
  HALF_FLOAT: 0x140B,
  HALF_FLOAT_OES: 0x8D61,
} as const;

// ============================================
// 纹理目标常量
// ============================================
export const TEXTURE_TARGETS = {
  TEXTURE_2D: 0x0DE1,
  TEXTURE_CUBE_MAP: 0x8513,
  TEXTURE_3D: 0x806F,
  TEXTURE_2D_ARRAY: 0x8C1A,
  TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515,
  CUBEMAP_FACES: [0x8515, 0x8516, 0x8517, 0x8518, 0x8519, 0x851A] as const,
} as const;

// ============================================
// 缓冲区常量
// ============================================
export const BUFFER_TARGETS = {
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  ARRAY_BUFFER_BINDING: 0x8894,
  ELEMENT_ARRAY_BUFFER_BINDING: 0x8895,
} as const;

// ============================================
// Renderbuffer 常量
// ============================================
export const RENDERBUFFER_TARGET = 0x8D41;

// ============================================
// 像素格式常量
// ============================================
export const PIXEL_FORMATS = {
  ALPHA: 0x1906,
  RGB: 0x1907,
  RGBA: 0x1908,
  LUMINANCE: 0x1909,
  LUMINANCE_ALPHA: 0x190A,
} as const;

// ============================================
// 内部格式常量（WebGL2）
// ============================================
export const INTERNAL_FORMATS = {
  R8: 0x8229,
  RG8: 0x822B,
  RGB8: 0x8051,
  RGBA8: 0x8058,
  R16F: 0x822D,
  RG16F: 0x822F,
  RGB16F: 0x881B,
  RGBA16F: 0x881A,
  R32F: 0x822E,
  RG32F: 0x8230,
  RGB32F: 0x8815,
  RGBA32F: 0x8814,
} as const;

// ============================================
// Renderbuffer 格式常量
// ============================================
export const RENDERBUFFER_FORMATS = {
  RGBA4: 0x8056,
  RGB565: 0x8D62,
  RGB5_A1: 0x8057,
  DEPTH_COMPONENT16: 0x81A5,
  STENCIL_INDEX8: 0x8D48,
  DEPTH_STENCIL: 0x84F9,
  DEPTH_COMPONENT24: 0x81A6,
  DEPTH_COMPONENT32F: 0x8CAC,
  DEPTH24_STENCIL8: 0x88F0,
  DEPTH32F_STENCIL8: 0x8CAD,
} as const;

// ============================================
// 格式信息表
// ============================================
export interface FormatInfo {
  bytesPerUnit: number[],
  dataTypes?: number[],
}

export const TEXTURE_FORMATS: Record<number, FormatInfo> = {
  // 无符号格式
  [PIXEL_FORMATS.ALPHA]: {
    bytesPerUnit: [1, 2, 2, 4],
    dataTypes: [DATA_TYPES.UNSIGNED_BYTE, DATA_TYPES.HALF_FLOAT, DATA_TYPES.HALF_FLOAT_OES, DATA_TYPES.FLOAT],
  },
  [PIXEL_FORMATS.LUMINANCE]: {
    bytesPerUnit: [1, 2, 2, 4],
    dataTypes: [DATA_TYPES.UNSIGNED_BYTE, DATA_TYPES.HALF_FLOAT, DATA_TYPES.HALF_FLOAT_OES, DATA_TYPES.FLOAT],
  },
  [PIXEL_FORMATS.LUMINANCE_ALPHA]: {
    bytesPerUnit: [2, 4, 4, 8],
    dataTypes: [DATA_TYPES.UNSIGNED_BYTE, DATA_TYPES.HALF_FLOAT, DATA_TYPES.HALF_FLOAT_OES, DATA_TYPES.FLOAT],
  },
  [PIXEL_FORMATS.RGB]: {
    bytesPerUnit: [3, 6, 6, 12],
    dataTypes: [DATA_TYPES.UNSIGNED_BYTE, DATA_TYPES.HALF_FLOAT, DATA_TYPES.HALF_FLOAT_OES, DATA_TYPES.FLOAT],
  },
  [PIXEL_FORMATS.RGBA]: {
    bytesPerUnit: [4, 8, 8, 16],
    dataTypes: [DATA_TYPES.UNSIGNED_BYTE, DATA_TYPES.HALF_FLOAT, DATA_TYPES.HALF_FLOAT_OES, DATA_TYPES.FLOAT],
  },

  // 固定大小格式
  [INTERNAL_FORMATS.R8]: { bytesPerUnit: [1] },
  [INTERNAL_FORMATS.RG8]: { bytesPerUnit: [2] },
  [INTERNAL_FORMATS.RGB8]: { bytesPerUnit: [3] },
  [INTERNAL_FORMATS.RGBA8]: { bytesPerUnit: [4] },
  [INTERNAL_FORMATS.R16F]: { bytesPerUnit: [2] },
  [INTERNAL_FORMATS.RG16F]: { bytesPerUnit: [4] },
  [INTERNAL_FORMATS.RGB16F]: { bytesPerUnit: [6] },
  [INTERNAL_FORMATS.RGBA16F]: { bytesPerUnit: [8] },
  [INTERNAL_FORMATS.R32F]: { bytesPerUnit: [4] },
  [INTERNAL_FORMATS.RG32F]: { bytesPerUnit: [8] },
  [INTERNAL_FORMATS.RGB32F]: { bytesPerUnit: [12] },
  [INTERNAL_FORMATS.RGBA32F]: { bytesPerUnit: [16] },
};

export const RENDERBUFFER_SIZE_MAP: Record<number, { bytesPerPixel: number }> = {
  // WebGL1
  [RENDERBUFFER_FORMATS.RGBA4]: { bytesPerPixel: 2 },
  [RENDERBUFFER_FORMATS.RGB565]: { bytesPerPixel: 2 },
  [RENDERBUFFER_FORMATS.RGB5_A1]: { bytesPerPixel: 2 },
  [RENDERBUFFER_FORMATS.DEPTH_COMPONENT16]: { bytesPerPixel: 2 },
  [RENDERBUFFER_FORMATS.STENCIL_INDEX8]: { bytesPerPixel: 1 },
  [RENDERBUFFER_FORMATS.DEPTH_STENCIL]: { bytesPerPixel: 4 },

  // WebGL2
  [INTERNAL_FORMATS.R8]: { bytesPerPixel: 1 },
  [INTERNAL_FORMATS.RG8]: { bytesPerPixel: 2 },
  [INTERNAL_FORMATS.RGB8]: { bytesPerPixel: 3 },
  [INTERNAL_FORMATS.RGBA8]: { bytesPerPixel: 4 },
  [RENDERBUFFER_FORMATS.DEPTH_COMPONENT24]: { bytesPerPixel: 4 },
  [RENDERBUFFER_FORMATS.DEPTH_COMPONENT32F]: { bytesPerPixel: 4 },
  [RENDERBUFFER_FORMATS.DEPTH24_STENCIL8]: { bytesPerPixel: 4 },
  [RENDERBUFFER_FORMATS.DEPTH32F_STENCIL8]: { bytesPerPixel: 8 },
};
