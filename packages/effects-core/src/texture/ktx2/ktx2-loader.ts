/* eslint-disable @typescript-eslint/no-unused-vars */
import { BinomialTranscoder } from './transcoder/binomial-transcoder';
import { KhronosTranscoder } from './transcoder/khronos-transcoder';
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
  private static _binomialLLCTranscoder: BinomialTranscoder | null;
  private static _khronosTranscoder: KhronosTranscoder | null;
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

  /**
   * Release ktx2 transcoder worker.
   * @remarks If use loader after releasing, we should release again.
   */
  static release (): void {
    if (this._binomialLLCTranscoder) {this._binomialLLCTranscoder.destroy();}
    if (this._khronosTranscoder) {this._khronosTranscoder.destroy();}
    this._binomialLLCTranscoder = null;
    this._khronosTranscoder = null;
    this._isBinomialInit = false;
  }

  /** @internal */
  static _parseBuffer (buffer: Uint8Array, engine: Engine) {
    const ktx2Container = new KTX2Container(buffer);

    const formatPriorities = KTX2Loader._priorityFormats[ktx2Container.isUASTC ? 'uastc' : 'etc1s'];
    const targetFormat = KTX2Loader._decideTargetFormat(engine, ktx2Container, formatPriorities);

    let transcodeResultPromise: Promise<TranscodeResult>;

    if (KTX2Loader._isBinomialInit || targetFormat != KTX2TargetFormat.ASTC || !ktx2Container.isUASTC) {
      const binomialLLCWorker = KTX2Loader._getBinomialLLCTranscoder();

      transcodeResultPromise = binomialLLCWorker.init().then(() => binomialLLCWorker.transcode(buffer, targetFormat));
    } else {
      const khronosWorker = KTX2Loader._getKhronosTranscoder();

      transcodeResultPromise = khronosWorker.init().then(() => khronosWorker.transcode(ktx2Container));
    }

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
  static _createTextureByBuffer (
    engine: Engine,
    ktx2Container: KTX2Container,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
  ) {
    const { pixelWidth, pixelHeight, faceCount, isSRGB, vkFormat } = ktx2Container;
    const textureFormat = KTX2Loader._getEngineTextureFormat(targetFormat, transcodeResult);
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
    const { internalFormat, format, dataType } = KTX2Loader._getGLTextureDetail(
      textureFormat,
      isSRGB,
      engine
    );

    return {
      sourceType: TextureSourceType.compressed,
      target,
      internalFormat,
      format,
      dataType,
      mipmaps };
  }

  async load (url: string, engine: Engine) {
    const buffer = new Uint8Array(await loadBinary(url));

    KTX2Loader._parseBuffer(new Uint8Array(buffer), engine)
      .then(({ ktx2Container, engine, result, targetFormat, params }) =>
        KTX2Loader._createTextureByBuffer(engine, ktx2Container, result, targetFormat)
      ).catch(()=>{
        console.info('KTX2 texture load failed');
      });
  }

  private static _getBinomialLLCTranscoder (workerCount: number = 4) {
    KTX2Loader._isBinomialInit = true;

    return (this._binomialLLCTranscoder ??= new BinomialTranscoder(workerCount));
  }

  private static _getKhronosTranscoder (workerCount: number = 4) {
    return (this._khronosTranscoder ??= new KhronosTranscoder(workerCount, KTX2TargetFormat.ASTC));
  }

  private static isPowerOfTwo (value: number) {
    return (value & (value - 1)) === 0 && value !== 0;
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
  private static _getGLTextureDetail (
    format: TextureFormat,
    isSRGBColorSpace: boolean,
    engine: Engine,
  ) {
    // Extensions
    const isWebGL2 = engine.gpuCapability.isWebGL2;
    const hasASTC = engine.gpuCapability.canIUse(GLCapabilityType.astc) || engine.gpuCapability.canIUse(GLCapabilityType.astc_webkit);
    const hasPVRTC = engine.gpuCapability.canIUse(GLCapabilityType.pvrtc) || engine.gpuCapability.canIUse(GLCapabilityType.pvrtc_webkit);
    const hasETC1 = engine.gpuCapability.canIUse(GLCapabilityType.etc1) || engine.gpuCapability.canIUse(GLCapabilityType.etc1_webkit);
    const hasETC2 = isWebGL2 || engine.gpuCapability.canIUse(GLCapabilityType.etc) || engine.gpuCapability.canIUse(GLCapabilityType.etc_webkit);
    const hasSRGBExt = isWebGL2 || engine.gpuCapability.canIUse(GLCapabilityType.sRGB);
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
      COMPRESSED_RGB_ETC1_WEBGL: 0x8d64,
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
      dataType: 0,
    });

    const uncompressed = (internalFormat: number, format: number, dataType: number = GL_CONST.UNSIGNED_BYTE) => ({
      internalFormat,
      format,
      dataType,
    });

    switch (format) {
      // Uncompressed
      case TextureFormat.R8G8B8: {
        if (isWebGL2) {
          return isSRGBColorSpace
            ? uncompressed(GL_CONST.SRGB8, GL_CONST.RGB)
            : uncompressed(GL_CONST.RGB8, GL_CONST.RGB);
        } else {
          if (isSRGBColorSpace) {
            if (!hasSRGBExt) {
              throw new Error('EXT_sRGB not supported: cannot create sRGB RGB texture on WebGL1');
            }

            return uncompressed(GL_CONST.SRGB_EXT, GL_CONST.SRGB_EXT);
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
            if (!hasSRGBExt) {
              throw new Error('EXT_sRGB not supported: cannot create sRGB RGBA texture on WebGL1');
            }

            return uncompressed(GL_CONST.SRGB_ALPHA_EXT, GL_CONST.SRGB_ALPHA_EXT);
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
      }      // Optional: ETC1 (RGB only, no sRGB/alpha)
      case TextureFormat.ETC1_RGB: {
        if (!hasETC1) {
          throw new Error('WEBGL_compressed_texture_etc1 not supported');
        }
        if (isSRGBColorSpace) {
          // No sRGB variant for ETC1; caller should avoid requesting sRGB with ETC1
          throw new Error('ETC1 has no sRGB variant');
        }

        return compressed(GL_CONST.COMPRESSED_RGB_ETC1_WEBGL);
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