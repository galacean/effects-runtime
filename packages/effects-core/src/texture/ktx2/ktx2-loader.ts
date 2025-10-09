import { BinomialTranscoder } from './transcoder/binomial-transcoder';
import { KhronosTranscoder } from './transcoder/khronos-transcoder';
import { DFDTransferFunction, KTX2Container } from './ktx2-container';
import { KTX2TargetFormat, TextureFormat } from './ktx2-target-format';
import type { TranscodeResult } from './transcoder/abstract-transcoder';
import type { GPUCapability } from '../../render/gpu-capability';
import { GLCapabilityType } from '../../render/gpu-capability';
import { loadBinary } from '../../downloader';
import type { Texture2DSourceOptionsCompressed, TextureDataType } from '../types';
import { TextureSourceType } from '../types';
import { glContext } from '../../gl';
import { isPowerOfTwo } from '../utils';
export class KTX2Loader {
  private static binomialLLCTranscoder: BinomialTranscoder | null;
  private static khronosTranscoder: KhronosTranscoder | null;
  private static priorityFormats = {
    etc1s: [
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.PVRTC,
      KTX2TargetFormat.R8G8B8A8,
    ],
    uastc: [
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.PVRTC,
      KTX2TargetFormat.R8G8B8A8,
    ],
  };
  private static capabilityMap: Partial<Record<KTX2TargetFormat, Partial<Record<DFDTransferFunction, GLCapabilityType[]>>>> = {
    [KTX2TargetFormat.ASTC]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.astc, GLCapabilityType.astc_webkit],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.astc, GLCapabilityType.astc_webkit],
    },
    [KTX2TargetFormat.ETC]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.etc, GLCapabilityType.etc_webkit],
      [DFDTransferFunction.sRGB]: [GLCapabilityType.etc, GLCapabilityType.etc_webkit],
    },
    [KTX2TargetFormat.PVRTC]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.pvrtc, GLCapabilityType.pvrtc_webkit],
    },
  };

  /** @internal */
  static parseBuffer (buffer: Uint8Array, gpuCapability?: GPUCapability) {
    const ktx2Container = new KTX2Container(buffer);
    // TODO: DIY priorityFormats
    const formatPriorities = KTX2Loader.priorityFormats[ktx2Container.isUASTC ? 'uastc' : 'etc1s'];
    const targetFormat = KTX2Loader.decideTargetFormat(ktx2Container, formatPriorities, gpuCapability);

    let transcodeResultPromise: Promise<TranscodeResult>;

    if (targetFormat != KTX2TargetFormat.ASTC || !ktx2Container.isUASTC) {
      const binomialLLCWorker = KTX2Loader.getBinomialLLCTranscoder();

      transcodeResultPromise = binomialLLCWorker.init().then(() => binomialLLCWorker.transcode(buffer, targetFormat));
    } else {
      const khronosWorker = KTX2Loader.getKhronosTranscoder();

      transcodeResultPromise = khronosWorker.init().then(() => khronosWorker.transcode(ktx2Container));
    }

    return transcodeResultPromise.then(result => {
      return {
        ktx2Container,
        gpuCapability,
        result,
        targetFormat,
      };
    });
  }

  private static decideTargetFormat (
    ktx2Container: KTX2Container,
    priorityFormats?: KTX2TargetFormat[],
    gpuCapability?: GPUCapability,
  ): KTX2TargetFormat {
    const { isSRGB, pixelWidth, pixelHeight } = ktx2Container;
    const targetFormat = this._detectSupportedFormat(priorityFormats ?? [], isSRGB, gpuCapability) as KTX2TargetFormat;

    if (
      targetFormat === KTX2TargetFormat.PVRTC &&
      (!isPowerOfTwo(pixelWidth) || !isPowerOfTwo(pixelHeight) || pixelWidth !== pixelHeight)
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
    priorityFormats: KTX2TargetFormat[],
    isSRGB: boolean,
    gpuCapability?: GPUCapability
  ): KTX2TargetFormat | null {
    if (gpuCapability == undefined) {return null;}
    for (let i = 0; i < priorityFormats.length; i++) {
      const format = priorityFormats[i];
      const capabilities =
        this.capabilityMap[format]?.[isSRGB ? DFDTransferFunction.sRGB : DFDTransferFunction.linear];

      if (capabilities) {
        for (let j = 0; j < capabilities.length; j++) {
          if (gpuCapability?.canIUse(capabilities[j])) {
            return format;
          }
        }
      } else {
        switch (priorityFormats[i]) {
          case KTX2TargetFormat.R8G8B8A8:
            return format;
          case KTX2TargetFormat.R8:
          case KTX2TargetFormat.R8G8:
            if (gpuCapability?.isWebGL2) {return format;}
        }
      }
    }

    return null;
  }

  static async load (url: string, gpuCapability?: GPUCapability) {
    if (gpuCapability == undefined) {console.error('gpuCapability undefined');}
    const buffer = new Uint8Array(await loadBinary(url));

    try {
      const { ktx2Container, result, targetFormat } = await KTX2Loader.parseBuffer(new Uint8Array(buffer), gpuCapability);

      return KTX2Loader._createTextureByBuffer(ktx2Container, result, targetFormat, gpuCapability);
    } catch (error) {
      console.info('KTX2 texture load failed');
      throw error;
    }
  }

  static initialize (useKhronosTranscoder = false, workerCount = 4): Promise<void> {
    if (useKhronosTranscoder) {return KTX2Loader.getKhronosTranscoder(workerCount).init();} else {return KTX2Loader.getBinomialLLCTranscoder(workerCount).init();}
  }

  /** @internal */
  static _createTextureByBuffer (
    ktx2Container: KTX2Container,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    gpuCapability?: GPUCapability,
  ): Texture2DSourceOptionsCompressed {
    const textureFormat = KTX2Loader.getEngineTextureFormat(targetFormat, transcodeResult);
    const { pixelWidth, pixelHeight, faceCount, isSRGB } = ktx2Container;
    const { internalFormat, format, type } = KTX2Loader.getGLTextureDetail(textureFormat, isSRGB, gpuCapability);

    const target = faceCount === 6 ? glContext.TEXTURE_CUBE_MAP : glContext.TEXTURE_2D;

    const faces = transcodeResult.faces;
    const transLevels = faces[0]?.length ?? 0;
    const maxDimension = Math.max(pixelWidth, pixelHeight);
    const fullChainCount = Math.floor(Math.log2(maxDimension)) + 1;
    const useMipmaps = transLevels > 1 && transLevels >= fullChainCount;
    const levelCount = useMipmaps ? transLevels : 1;
    const mipmaps: TextureDataType[] = [];

    for (let level = 0; level < levelCount; level++) {
      for (let face = 0; face < faceCount; face++) {
        const src = faces[face][level];

        mipmaps.push({
          data: src.data,
          width: src.width,
          height: src.height,
        });
      }
    }

    return {
      sourceType: TextureSourceType.compressed,
      target,
      internalFormat,
      format,
      type,
      mipmaps,
    };
  }

  private static getBinomialLLCTranscoder (workerCount: number = 4) {
    return (this.binomialLLCTranscoder ??= new BinomialTranscoder(workerCount));
  }

  private static getKhronosTranscoder (workerCount: number = 4) {
    return (this.khronosTranscoder ??= new KhronosTranscoder(workerCount, KTX2TargetFormat.ASTC));
  }

  private static getEngineTextureFormat (
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

  private static getGLTextureDetail (
    format: TextureFormat,
    isSRGBColorSpace: boolean,
    gpuCapability?: GPUCapability,
  ) {
    const GL_CONST = {
      // base
      RGB: 0x1907,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      // sized internal formats (WebGL2)
      RGB8: 0x8051,
      RGBA8: 0x8058,
      SRGB8: 0x8c41,
      SRGB8_ALPHA8: 0x8c43,
      // EXT_sRGB (WebGL1)
      SRGB_EXT: 0x8c40,
      SRGB_ALPHA_EXT: 0x8c42,
      // ASTC
      COMPRESSED_RGBA_ASTC_4x4_KHR: 0x93b0,
      COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR: 0x93d0,
      // ETC2
      COMPRESSED_RGB8_ETC2: 0x9274,
      COMPRESSED_SRGB8_ETC2: 0x9275,
      COMPRESSED_RGBA8_ETC2_EAC: 0x9278,
      COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: 0x9279,
      // PVRTC
      COMPRESSED_RGB_PVRTC_4BPPV1_IMG: 0x8c00,
      COMPRESSED_RGBA_PVRTC_4BPPV1_IMG: 0x8c02,
    } as const;
    const compressed = (internalFormat: number) => ({
      internalFormat,
      format: 0,
      type: 0,
    });

    const uncompressed = (internalFormat: number, format: number, type: number = GL_CONST.UNSIGNED_BYTE) => ({
      internalFormat,
      format,
      type,
    });

    // 当 gpuCapability 未提供时，按“WebGL1 且无扩展”的最保守路径处理
    const isWebGL2 = !!gpuCapability?.isWebGL2;
    const can = (cap: GLCapabilityType) => {
      try { return !!gpuCapability?.canIUse?.(cap); } catch { return false; }
    };

    const hasASTC = can(GLCapabilityType.astc) || can(GLCapabilityType.astc_webkit);
    const hasPVRTC = can(GLCapabilityType.pvrtc) || can(GLCapabilityType.pvrtc_webkit);
    const hasETC2 = isWebGL2 || can(GLCapabilityType.etc) || can(GLCapabilityType.etc_webkit);
    const hasSRGBExt = isWebGL2 || can(GLCapabilityType.sRGB);

    switch (format) {
      // Uncompressed
      case TextureFormat.R8G8B8: {
        if (isWebGL2) {
          return isSRGBColorSpace
            ? uncompressed(GL_CONST.SRGB8, GL_CONST.RGB)
            : uncompressed(GL_CONST.RGB8, GL_CONST.RGB);
        } else {
          if (isSRGBColorSpace) {
            // WebGL1: 有 EXT_sRGB 用 sRGB_EXT，否则直接线性 RGB 降级
            if (hasSRGBExt) {
              return uncompressed(GL_CONST.SRGB_EXT, GL_CONST.SRGB_EXT);
            }

            return uncompressed(GL_CONST.RGB, GL_CONST.RGB);
          }

          return uncompressed(GL_CONST.RGB, GL_CONST.RGB);
        }
      }
      case TextureFormat.R8G8B8A8: {
        if (isWebGL2) {
          return isSRGBColorSpace
            ? uncompressed(GL_CONST.SRGB8_ALPHA8, GL_CONST.RGBA)
            : uncompressed(GL_CONST.RGBA8, GL_CONST.RGBA);
        } else {
          if (isSRGBColorSpace) {
            // WebGL1: 有 EXT_sRGB 用 SRGB_ALPHA_EXT，否则直接线性 RGBA 降级
            if (hasSRGBExt) {
              return uncompressed(GL_CONST.SRGB_ALPHA_EXT, GL_CONST.SRGB_ALPHA_EXT);
            }

            return uncompressed(GL_CONST.RGBA, GL_CONST.RGBA);
          }

          return uncompressed(GL_CONST.RGBA, GL_CONST.RGBA);
        }
      }
      // Compressed ASTC
      case TextureFormat.ASTC_4x4: {
        if (!hasASTC) {
          throw new Error('WEBGL_compressed_texture_astc not supported');
        }

        return compressed(
          isSRGBColorSpace ? GL_CONST.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
            : GL_CONST.COMPRESSED_RGBA_ASTC_4x4_KHR
        );
      }
      // Compressed ETC2
      case TextureFormat.ETC2_RGB: {
        if (!hasETC2) {
          throw new Error('ETC2 not supported');
        }

        return compressed(
          isSRGBColorSpace ? GL_CONST.COMPRESSED_SRGB8_ETC2
            : GL_CONST.COMPRESSED_RGB8_ETC2
        );
      }
      case TextureFormat.ETC2_RGBA8: {
        if (!hasETC2) {
          throw new Error('ETC2 EAC not supported');
        }

        return compressed(
          isSRGBColorSpace ? GL_CONST.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC
            : GL_CONST.COMPRESSED_RGBA8_ETC2_EAC
        );
      }
      // Compressed PVRTC (no sRGB variants in WebGL)
      case TextureFormat.PVRTC_RGB4: {
        if (!hasPVRTC) {
          throw new Error('WEBGL_compressed_texture_pvrtc not supported');
        }

        return compressed(GL_CONST.COMPRESSED_RGB_PVRTC_4BPPV1_IMG);
      }
      case TextureFormat.PVRTC_RGBA4: {
        if (!hasPVRTC) {
          throw new Error('WEBGL_compressed_texture_pvrtc not supported');
        }

        return compressed(GL_CONST.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG);
      }
      default:
        throw new Error(`Unsupported TextureFormat: ${format}`);
    }
  }
}