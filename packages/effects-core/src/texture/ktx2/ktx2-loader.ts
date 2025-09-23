/* eslint-disable @typescript-eslint/no-unused-vars */
import { BinomialTranscoder } from './transcoder/binomial-transcoder';
import { DFDTransferFunction, KTX2Container } from './ktx2-container';
import { KTX2TargetFormat, TextureFormat, CompressedTextureFormat } from './ktx2-target-format';
import type { TranscodeResult } from './transcoder/abstract-transcoder';
import type { Engine } from '../../engine';
import { GLCapabilityType } from '../../render/gpu-capability';
import { loadBinary } from '../../downloader';
import type { Texture2DSourceOptionsCompressed, TextureDataType } from '../types';
import { TextureSourceType } from '../types';
import { glContext } from '../../gl';

export class KTX2Loader {
  private static _isBinomialInit: boolean = false;
  private static _binomialLLCTranscoder: BinomialTranscoder;
  private static _priorityFormats = {
    etc1s: [
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.PVRTC,
    ],
    uastc: [
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.PVRTC,
    ],
  };
  private static _capabilityMap: Partial<Record<KTX2TargetFormat, Partial<Record<DFDTransferFunction, GLCapabilityType[]>>>> = {
    [KTX2TargetFormat.ASTC]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.astc, GLCapabilityType.astc_webkit],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.astc, GLCapabilityType.astc_webkit],
    },
    [KTX2TargetFormat.ETC]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.etc, GLCapabilityType.etc_webkit],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.etc, GLCapabilityType.etc_webkit],
    },
    [KTX2TargetFormat.PVRTC]: { [DFDTransferFunction.linear]: [GLCapabilityType.pvrtc, GLCapabilityType.pvrtc_webkit] },
  };

  private static _getBinomialLLCTranscoder (workerCount: number = 4) {
    KTX2Loader._isBinomialInit = true;

    return (this._binomialLLCTranscoder ??= new BinomialTranscoder(workerCount));
  }

  private static isPowerOfTwo (value: number) {
    return (value & (value - 1)) === 0 && value !== 0;
  }

  private static _decideTargetFormat (
    engine: Engine,
    ktx2Container: KTX2Container,
    priorityFormats?: KTX2TargetFormat[]
  ): KTX2TargetFormat {
    const { isSRGB, pixelWidth, pixelHeight } = ktx2Container;
    const targetFormat = this._detectSupportedFormat(engine, priorityFormats ?? [], isSRGB) as KTX2TargetFormat;

    if (
      targetFormat === KTX2TargetFormat.PVRTC &&
      (!KTX2Loader.isPowerOfTwo(pixelWidth) || !KTX2Loader.isPowerOfTwo(pixelHeight) || pixelWidth !== pixelHeight)
    ) {
      console.warn('PVRTC image need power of 2 and width===height, downgrade to RGBA8');

      return KTX2TargetFormat.R8G8B8A8;
    }

    if (targetFormat === null) {
      console.warn('Can\'t support any compressed texture, downgrade to RGBA8');

      return KTX2TargetFormat.R8G8B8A8;
    }

    return targetFormat;
  }

  private static _detectSupportedFormat (
    engine: Engine,
    priorityFormats: KTX2TargetFormat[],
    isSRGB: boolean
  ): KTX2TargetFormat | null {
    for (let i = 0; i < priorityFormats.length; i++) {
      const format = priorityFormats[i];
      const capabilities =
        this._capabilityMap[format]?.[isSRGB ? DFDTransferFunction.sRGB : DFDTransferFunction.linear];

      if (capabilities) {
        for (let j = 0; j < capabilities.length; j++) {
          if (engine.gpuCapability.canIUse(capabilities[j])) {
            return format;
          }
        }
      } else {
        switch (priorityFormats[i]) {
          case KTX2TargetFormat.R8G8B8A8:
            return format;
          case KTX2TargetFormat.R8:
          case KTX2TargetFormat.R8G8:
            if (engine.gpuCapability.isWebGL2) {return format;}
        }
      }
    }

    return null;
  }

  initialize (workerCount: number): Promise<void> {
    return KTX2Loader._getBinomialLLCTranscoder(workerCount).init();
  }

  /** @internal */
  static _parseBuffer (buffer: Uint8Array, engine: Engine) {
    const ktx2Container = new KTX2Container(buffer);

    const formatPriorities = KTX2Loader._priorityFormats[ktx2Container.isUASTC ? 'uastc' : 'etc1s'];
    const targetFormat = KTX2Loader._decideTargetFormat(engine, ktx2Container, formatPriorities);

    const binomialLLCWorker = KTX2Loader._getBinomialLLCTranscoder();

    const transcodeResultPromise = binomialLLCWorker.init().then(() => binomialLLCWorker.transcode(buffer, targetFormat));

    return transcodeResultPromise.then(result => {
      return {
        ktx2Container,
        engine,
        result,
        targetFormat,
        params: ktx2Container.keyValue['GalaceanTextureParams'] as Uint8Array,
      };
    });
  }

  private static _getEngineTextureFormat (
    basisFormat: KTX2TargetFormat,
    transcodeResult: TranscodeResult
  ): TextureFormat {
    const { hasAlpha } = transcodeResult;

    switch (basisFormat) {
      case KTX2TargetFormat.ASTC:
        return TextureFormat.ASTC_4x4;
      case KTX2TargetFormat.ETC:
        return hasAlpha ? TextureFormat.ETC2_RGBA8 : TextureFormat.ETC2_RGB;
      case KTX2TargetFormat.PVRTC:
        return hasAlpha ? TextureFormat.PVRTC_RGBA4 : TextureFormat.PVRTC_RGB4;
      case KTX2TargetFormat.R8G8B8A8:
        return TextureFormat.R8G8B8A8;
    }

    return TextureFormat.R8G8B8;
  }

  /** @internal */
  static _createTextureByBuffer (
    engine: Engine,
    ktx2Container: KTX2Container,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    params?: Uint8Array,
  ) {
    const { pixelWidth, pixelHeight, faceCount, vkFormat } = ktx2Container;
    // 映射格式
    const { internalFormat, format, type } = KTX2Loader.mapVkFormatToWebGL(vkFormat);
    // 纹理目标
    const target = faceCount === 6 ? glContext.TEXTURE_CUBE_MAP : glContext.TEXTURE_2D;
    // mipmap 占位符（真实数据需异步转码）
    const mipmaps: TextureDataType[] = [];
    const totalLevels = ktx2Container.levels.length;
    const maxDimension = Math.max(pixelWidth, pixelHeight);
    const useMipmaps = totalLevels > 1 && totalLevels >= Math.floor(Math.log2(maxDimension)) + 1;
    const levelCount = useMipmaps ? totalLevels : 1;

    for (let level = 0; level < levelCount; level++) {
      const width = Math.max(1, pixelWidth >> level);
      const height = Math.max(1, pixelHeight >> level);

      for (let face = 0; face < faceCount; face++) {
        mipmaps.push({
          data: new Uint8Array(0), // 占位符，需异步转码填充
          width,
          height,
        });
      }
    }

    return {
      sourceType: TextureSourceType.compressed,
      target,
      internalFormat,
      format,
      type,
      mipmaps };
  }

  async load (url: string, engine: Engine) {
    const buffer = new Uint8Array(await loadBinary(url));

    KTX2Loader._parseBuffer(new Uint8Array(buffer), engine)
      .then(({ ktx2Container, engine, result, targetFormat, params }) =>
        KTX2Loader._createTextureByBuffer(engine, ktx2Container, result, targetFormat, params)
      ).catch(()=>{});
  }

  static mapVkFormatToWebGL (vkFormat: number) {
    // format 和 type 对于压缩纹理必须为 0
    const compressedEntry = (internalFormat: number) => ({
      internalFormat,
      format: 0,
      type: 0,
      compressed: true as const,
    });

    // 未压缩 fallback（用于 Basis 等通用编码）
    const uncompressedEntry = () => ({
      internalFormat: glContext.SRGB8_ALPHA8,
      format: glContext.RGBA,
      type: glContext.UNSIGNED_BYTE,
      compressed: false as const,
    });

    switch (vkFormat) {
      // --- ETC2 ---
      case 165: // VK_FORMAT_ETC2_R8G8B8_UNORM_BLOCK
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGB8_ETC2);
      case 166: // VK_FORMAT_ETC2_R8G8B8A1_UNORM_BLOCK
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2);
      case 167: // VK_FORMAT_ETC2_R8G8B8A8_UNORM_BLOCK
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA8_ETC2_EAC);        // --- ASTC ---
      case 175: // VK_FORMAT_ASTC_4x4_UNORM_BLOCK
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_4x4_KHR);
      case 176: // 5x4
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_5x4_KHR);
      case 177: // 5x5
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_5x5_KHR);
      case 178: // 6x5
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_6x5_KHR);
      case 179: // 6x6
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_6x6_KHR);
      case 180: // 8x5
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_8x5_KHR);
      case 181: // 8x6
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_8x6_KHR);
      case 182: // 8x8
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_ASTC_8x8_KHR);        // --- PVRTC ---
      case 1000054008: // PVRTC1 4BPP RGB UNORM
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGB_PVRTC_4BPPV1_IMG);
      case 1000054009: // PVRTC1 4BPP SRGB RGB
        return compressedEntry(CompressedTextureFormat.COMPRESSED_SRGB_PVRTC_4BPPV1_EXT);
      case 1000054012: // PVRTC1 4BPP RGBA UNORM
        return compressedEntry(CompressedTextureFormat.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG);
      case 1000054013: // PVRTC1 4BPP SRGB RGBA
        return compressedEntry(CompressedTextureFormat.COMPRESSED_SRGB_ALPHA_PVRTC_4BPPV1_EXT);        // --- Fallback: Basis Universal 或未知格式 ---
      case 0:
        return uncompressedEntry();        // --- 其他不支持的格式 ---
      default:
        console.info(`Unsupported vkFormat: ${vkFormat}. Using RGBA8 fallback.`);

        return uncompressedEntry();
    }
  }
}