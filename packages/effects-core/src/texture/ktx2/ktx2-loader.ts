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
      glContext,
      engine.gpuCapability.isWebGL2
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
    gl: WebGLRenderingContext & WebGL2RenderingContext,
    isWebGL2: boolean
  ) {
    // Extensions
    const astcExt = (gl as any).getExtension('WEBGL_compressed_texture_astc');
    const etcExt = isWebGL2 ? null : (gl as any).getExtension('WEBGL_compressed_texture_etc');
    const pvrtcExt = (gl as any).getExtension('WEBGL_compressed_texture_pvrtc') || (gl as any).getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc');
    const srgbExt = !isWebGL2 ? (gl as any).getExtension('EXT_sRGB') : null;

    const compressed = (internalFormat: number) => ({
      internalFormat,
      format: 0,
      dataType: 0,
    });

    const uncompressed = (
      internalFormat: number,
      format: number,
      dataType: number = gl.UNSIGNED_BYTE
    ) => ({ internalFormat, format, dataType });

    switch (format) {
      // --- Uncompressed ---
      case TextureFormat.R8G8B8: {
        if (isWebGL2) {
          // WebGL2: sRGB is core
          if (isSRGBColorSpace) {
            return uncompressed((gl as WebGL2RenderingContext).SRGB8, gl.RGB, gl.UNSIGNED_BYTE);
          }

          return uncompressed((gl as WebGL2RenderingContext).RGB8, gl.RGB, gl.UNSIGNED_BYTE);
        } else {
          // WebGL1: need EXT_sRGB for sRGB textures
          if (isSRGBColorSpace) {
            if (!srgbExt) {
              throw new Error('EXT_sRGB not supported: cannot create sRGB RGB texture on WebGL1');
            }
            const SRGB_EXT = (srgbExt).SRGB_EXT;

            return uncompressed(SRGB_EXT, SRGB_EXT, gl.UNSIGNED_BYTE);
          }

          return uncompressed(gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
        }
      }
      case TextureFormat.R8G8B8A8: {
        if (isWebGL2) {
          if (isSRGBColorSpace) {
            return uncompressed((gl as WebGL2RenderingContext).SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE);
          }

          return uncompressed((gl as WebGL2RenderingContext).RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
        } else {
          if (isSRGBColorSpace) {
            if (!srgbExt) {
              throw new Error('EXT_sRGB not supported: cannot create sRGB RGBA texture on WebGL1');
            }
            const SRGB_ALPHA_EXT = (srgbExt).SRGB_ALPHA_EXT;

            return uncompressed(SRGB_ALPHA_EXT, SRGB_ALPHA_EXT, gl.UNSIGNED_BYTE);
          }

          return uncompressed(gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        }
      }
      // --- Compressed ASTC ---
      case TextureFormat.ASTC_4x4: {
        if (!astcExt) {
          throw new Error('WEBGL_compressed_texture_astc not supported');
        }

        return compressed(
          isSRGBColorSpace
            ? (astcExt).COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
            : (astcExt).COMPRESSED_RGBA_ASTC_4x4_KHR
        );
      }
      // --- Compressed ETC2 ---
      case TextureFormat.ETC2_RGB: {
        if (isWebGL2) {
          return compressed(
            isSRGBColorSpace
              ? (gl as any).COMPRESSED_SRGB8_ETC2
              : (gl as any).COMPRESSED_RGB8_ETC2
          );
        } else {
          if (!etcExt) {
            throw new Error('WEBGL_compressed_texture_etc not supported (ETC2)');
          }

          return compressed(
            isSRGBColorSpace
              ? (etcExt).COMPRESSED_SRGB8_ETC2
              : (etcExt).COMPRESSED_RGB8_ETC2
          );
        }
      }
      case TextureFormat.ETC2_RGBA8: {
        if (isWebGL2) {
          return compressed(
            isSRGBColorSpace
              ? (gl as any).COMPRESSED_SRGB8_ALPHA8_ETC2_EAC
              : (gl as any).COMPRESSED_RGBA8_ETC2_EAC
          );
        } else {
          if (!etcExt) {
            throw new Error('WEBGL_compressed_texture_etc not supported (ETC2 EAC)');
          }

          return compressed(
            isSRGBColorSpace
              ? (etcExt).COMPRESSED_SRGB8_ALPHA8_ETC2_EAC
              : (etcExt).COMPRESSED_RGBA8_ETC2_EAC
          );
        }
      }
      // --- Compressed PVRTC (no sRGB variants in WebGL) ---
      case TextureFormat.PVRTC_RGB4: {
        if (!pvrtcExt) {
          throw new Error('WEBGL_compressed_texture_pvrtc not supported');
        }

        return compressed((pvrtcExt).COMPRESSED_RGB_PVRTC_4BPPV1_IMG);
      }
      case TextureFormat.PVRTC_RGBA4: {
        if (!pvrtcExt) {
          throw new Error('WEBGL_compressed_texture_pvrtc not supported');
        }

        return compressed((pvrtcExt).COMPRESSED_RGBA_PVRTC_4BPPV1_IMG);
      }
      default:
        throw new Error(`Unsupported TextureFormat: ${format}`);
    }
  }
}