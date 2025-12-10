import { DATA_TYPES, TEXTURE_FORMATS, RENDERBUFFER_SIZE_MAP } from './constants';

const getFormatBytes = (format: number, dataType: number): number => {
  const info = TEXTURE_FORMATS[format];

  if (!info) {
    console.warn(`[Format Utils] Unknown format: 0x${format.toString(16)}, defaulting to 4 bytes`);

    return 4;
  }

  if (info.dataTypes) {
    const index = info.dataTypes.indexOf(dataType);

    if (index >= 0) {
      return info.bytesPerUnit[index];
    }
  }

  return info.bytesPerUnit[0];
};

// 压缩纹理
type SizeCalculator = (width: number, height: number, depth: number) => number;

const createBlockCalculator = (
  blockWidth: number,
  blockHeight: number,
  bytesPerBlock: number
): SizeCalculator => {
  return (width: number, height: number, depth: number) => {
    const blocksX = Math.ceil(width / blockWidth);
    const blocksY = Math.ceil(height / blockHeight);

    return blocksX * blocksY * bytesPerBlock * depth;
  };
};

// ASTC 压缩格式映射
const compressedFormats = new Map<number, SizeCalculator>([
  // ASTC RGBA
  [0x93B0, createBlockCalculator(4, 4, 16)],

  // ASTC SRGB
  [0x93D0, createBlockCalculator(4, 4, 16)],
]);

/**
 * 计算纹理内存大小
 */
export const calculateTextureSize = (
  format: number,
  width: number,
  height: number,
  depth: number = 1,
  dataType: number = DATA_TYPES.UNSIGNED_BYTE
): number => {
  // 检查是否为压缩格式
  const compressedCalculator = compressedFormats.get(format);

  if (compressedCalculator) {
    return compressedCalculator(width, height, depth);
  }

  const bytesPerPixel = getFormatBytes(format, dataType);

  return width * height * depth * bytesPerPixel;
};

/**
 * 计算 Renderbuffer 内存大小
 */
export const calculateRenderbufferSize = (
  format: number,
  width: number,
  height: number,
  samples: number = 1
): number => {
  const info = RENDERBUFFER_SIZE_MAP[format];

  if (!info) {
    console.warn(`[Format Utils] Unknown renderbuffer format: 0x${format.toString(16)}, defaulting to 4 bytes`);

    return width * height * 4 * samples;
  }

  return width * height * info.bytesPerPixel * samples;
};

/**
 * 检查是否为压缩格式
 */
export const isCompressedFormat = (format: number): boolean => {
  return compressedFormats.has(format);
};

/**
 * 获取压缩格式的块尺寸
 */
export const getCompressionBlockSize = (format: number): { width: number, height: number } | null => {
  const blockSizes: Record<number, { width: number, height: number }> = {
    0x93B0: { width: 4, height: 4 },
    // SRGB
    0x93D0: { width: 4, height: 4 },
  };

  return blockSizes[format] || null;
};

/**
 * 将字节转换为 MB，返回格式化字符串
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  return (bytes / (1024 * 1024)).toFixed(decimals);
};

