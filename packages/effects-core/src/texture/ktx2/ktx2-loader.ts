import { BinomialLLCTranscoder } from './transcoder/binomial-transcoder';
import { KhronosTranscoder } from './transcoder/khronos-transcoder';
import { DFDTransferFunction, KTX2Container } from './ktx2-container';
import { KTX2TargetFormat, TextureFormat } from './ktx2-common';
import { TextureSourceType } from '../types';
import { glContext } from '../../gl';
import { isPowerOfTwo } from '../utils';
import { loadBinary } from '../../downloader';
import { GLCapabilityType } from '../../render/gpu-capability';
import type { TranscodeResult } from './transcoder/abstract-transcoder';
import type { GPUCapability } from '../../render/gpu-capability';
import type { Texture2DSourceOptionsCompressed, TextureDataType } from '../types';

export class KTX2Loader {
  private static binomialLLCTranscoder: BinomialLLCTranscoder | null;
  private static khronosTranscoder: KhronosTranscoder | null;
  private static priorityFormats = {
    etc1s: [
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.ETC1,
      KTX2TargetFormat.PVRTC,
      KTX2TargetFormat.RGBA8,
    ],
    uastc: [
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.PVRTC,
      KTX2TargetFormat.RGBA8,
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
    [KTX2TargetFormat.ETC1]: {
      [DFDTransferFunction.linear]: [GLCapabilityType.etc1],
    },
  };

  static initialize (useKhronosTranscoder = false, workerCount = 2): Promise<void> {
    if (useKhronosTranscoder) {return KTX2Loader.getKhronosTranscoder(workerCount).init();} else {return KTX2Loader.getBinomialLLCTranscoder(workerCount).init();}
  }

  private static getBinomialLLCTranscoder (workerCount: number = 2) {
    return (this.binomialLLCTranscoder ??= new BinomialLLCTranscoder(workerCount));
  }

  private static getKhronosTranscoder (workerCount: number = 2) {
    return (this.khronosTranscoder ??= new KhronosTranscoder(workerCount, KTX2TargetFormat.ASTC));
  }

  /**
   * @internal
   * 解析并转码 KTX2 文件
   */
  private static parseBuffer (buffer: Uint8Array, gpuCapability?: GPUCapability) {
    const ktx2Container = new KTX2Container(buffer);

    if (ktx2Container.isNotBasis) {
      throw new Error('Unsupported KTX2: only Basis (ETC1S/UASTC) containers are supported');
    }
    // TODO: DIY priorityFormats
    const formatPriorities = KTX2Loader.priorityFormats[ktx2Container.isUASTC ? 'uastc' : 'etc1s'];
    const targetFormat = KTX2Loader.decideTargetFormat(ktx2Container, formatPriorities, gpuCapability);
    const transcodeTarget = (targetFormat === KTX2TargetFormat.ETC1) ? KTX2TargetFormat.ETC : targetFormat;
    let transcodeResultPromise: Promise<TranscodeResult>;

    if (targetFormat === KTX2TargetFormat.ASTC && ktx2Container.isUASTC) {
      const khronosWorker = KTX2Loader.getKhronosTranscoder();

      transcodeResultPromise = khronosWorker.init().
        then(() => khronosWorker.transcode(ktx2Container));
    } else {
      const binomialLLCWorker = KTX2Loader.getBinomialLLCTranscoder();

      transcodeResultPromise = binomialLLCWorker.init().
        then(() => binomialLLCWorker.transcode(buffer, transcodeTarget));
    }

    return transcodeResultPromise
      .then(async result => {
        // 预检查：如果当前 internalFormat 实际不可用，回退到 RGBA8 重转码
        const ensured = await KTX2Loader.ensureUploadable(ktx2Container, buffer, result, targetFormat, gpuCapability);

        return {
          ktx2Container,
          gpuCapability,
          result: ensured.result,
          targetFormat: ensured.targetFormat,
        };
      });
  }

  /**
   * @internal
   * 根据设备能力和图像属性决定最优的转码目标格式
   * @param ktx2Container - KTX2 容器对象
   * @param priorityFormats - 候选格式优先级列表
   * @param gpuCapability - GPU 能力信息
   */
  private static decideTargetFormat (
    ktx2Container: KTX2Container,
    priorityFormats?: KTX2TargetFormat[],
    gpuCapability?: GPUCapability,
  ): KTX2TargetFormat {
    const { isSRGB, pixelWidth, pixelHeight } = ktx2Container;
    const hasAlpha = this.containerHasAlpha(ktx2Container);
    const targetFormat = this.detectSupportedFormat(priorityFormats ?? [], isSRGB, hasAlpha, gpuCapability) as KTX2TargetFormat;

    if (targetFormat === KTX2TargetFormat.PVRTC && (!isPowerOfTwo(pixelWidth) || !isPowerOfTwo(pixelHeight))) {
      console.warn('PVRTC image need power of 2, downgrade to RGBA8');

      return KTX2TargetFormat.RGBA8;
    }

    if (targetFormat === null) {
      console.warn('Can\'t support any compressed texture, downgrade to RGBA8');

      return KTX2TargetFormat.RGBA8;
    }

    return targetFormat;
  }

  /**
   * @internal
   * 判断 KTX2 容器是否包含 Alpha 通道
   */
  private static containerHasAlpha (ktx2Container: KTX2Container): boolean {
    // 对 UASTC 保守处理：可能包含 alpha，避免误选 ETC1
    if (ktx2Container.isUASTC) {return true;}
    // 对 ETC1S：依据 BasisLZ 的 imageDescs.alphaSliceByteLength 判断
    const globalData = ktx2Container.globalData;

    if (!globalData) {return false;}

    return globalData.imageDescs?.some(desc => desc.alphaSliceByteLength > 0) ?? false;
  }

  /**
   * @internal
   * 从优先级格式列表中检测设备支持的第一个可用格式
   * @param priorityFormats - 格式优先级列表
   * @param gpuCapability - GPU 能力信息
   * @returns 支持的 KTX2TargetFormat，若无则返回 null
   */
  private static detectSupportedFormat (
    priorityFormats: KTX2TargetFormat[],
    isSRGB: boolean,
    hasAlpha: boolean,
    gpuCapability?: GPUCapability
  ): KTX2TargetFormat | null {
    for (let i = 0; i < priorityFormats.length; i++) {
      const format = priorityFormats[i];

      if (format === KTX2TargetFormat.ETC1) {
        if (isSRGB || hasAlpha) {
          continue;
        }
      }
      const capabilities =
        this.capabilityMap[format]?.[isSRGB ? DFDTransferFunction.sRGB : DFDTransferFunction.linear];

      if (capabilities) {
        if (gpuCapability == undefined) {return null;}
        for (let j = 0; j < capabilities.length; j++) {
          if (gpuCapability?.canIUse(capabilities[j])) {
            return format;
          }
        }
      } else {
        switch (priorityFormats[i]) {
          case KTX2TargetFormat.RGBA8:
            return format;
        }
      }
    }

    return null;
  }

  /**
   * 从 ArrayBuffer 加载 KTX2 纹理并返回压缩纹理源选项
   */
  static async loadFromBuffer (arrBuffer: ArrayBuffer, gpuCapability?: GPUCapability) {
    if (gpuCapability == undefined) {throw new Error('GPUCapability undefined');}
    const buffer = new Uint8Array(arrBuffer);
    const { ktx2Container, result, targetFormat } = await KTX2Loader.parseBuffer(buffer, gpuCapability);

    return KTX2Loader.createTextureByBuffer(ktx2Container, result, targetFormat, gpuCapability);
  }

  /**
   * 从 URL 加载 KTX2 纹理并返回压缩纹理源选项
   */
  static async loadFromURL (url: string, gpuCapability?: GPUCapability) {
    if (gpuCapability == undefined) {throw new Error('GPUCapability undefined');}
    const buffer = new Uint8Array(await loadBinary(url));
    const { ktx2Container, result, targetFormat } = await KTX2Loader.parseBuffer(buffer, gpuCapability);

    return KTX2Loader.createTextureByBuffer(ktx2Container, result, targetFormat, gpuCapability);
  }

  /**
   * @internal
   * 根据转码结果创建引擎所需的压缩纹理源选项
   * @param ktx2Container - KTX2 容器对象
   * @param transcodeResult - 转码结果
   * @param targetFormat - 目标格式
   * @param gpuCapability - GPU 能力信息
   * @returns Texture2DSourceOptionsCompressed 配置对象
   */
  static createTextureByBuffer (
    ktx2Container: KTX2Container,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    gpuCapability?: GPUCapability,
  ): Texture2DSourceOptionsCompressed {
    const textureFormat = KTX2Loader.getEngineTextureFormat(targetFormat, transcodeResult.hasAlpha);
    const { pixelWidth, pixelHeight, faceCount } = ktx2Container;
    const { internalFormat, format, type } = KTX2Loader.getGLTextureDetail(textureFormat, gpuCapability);

    const target = faceCount === 6 ? glContext.TEXTURE_CUBE_MAP : glContext.TEXTURE_2D;

    const faces = transcodeResult.faces;
    const transLevels = faces[0]?.length ?? 0;
    const maxDimension = Math.max(pixelWidth, pixelHeight);

    if (maxDimension === 0) {
      throw new Error('Invalid KTX2 texture: both width and height are zero');
    }
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
    const isCompressed = textureFormat !== TextureFormat.R8G8B8A8;

    return {
      sourceType: isCompressed ? TextureSourceType.compressed : TextureSourceType.data,
      target,
      internalFormat,
      format,
      type,
      mipmaps,
    };
  }

  /**
   * @internal
   * 将 KTX2 目标格式映射为引擎内部的 TextureFormat 枚举值
   * @param basisFormat - KTX2 目标格式
   * @returns 对应的 TextureFormat
   */
  private static getEngineTextureFormat (
    basisFormat: KTX2TargetFormat,
    hasAlpha: boolean,
  ): TextureFormat {

    switch (basisFormat) {
      case KTX2TargetFormat.ASTC:
        return TextureFormat.ASTC_4x4;
      case KTX2TargetFormat.ETC:
        return hasAlpha ? TextureFormat.ETC2_RGBA8 : TextureFormat.ETC2_RGB;
      case KTX2TargetFormat.PVRTC:
        return hasAlpha ? TextureFormat.PVRTC_RGBA4 : TextureFormat.PVRTC_RGB4;
      case KTX2TargetFormat.ETC1:
        return TextureFormat.ETC1_RGB;
      case KTX2TargetFormat.RGBA8:
        return TextureFormat.R8G8B8A8;
    }
  }

  /**
   * @internal
   * 根据引擎纹理格式和色彩空间，获取 WebGL 所需的 internalFormat、format 和 type
   * @param format - 引擎内部纹理格式
   * @param isSRGBColorSpace - 是否为 sRGB 色彩空间
   * @param gpuCapability - GPU 能力信息
   * @returns 包含 internalFormat、format、type 的对象
   */
  private static getGLTextureDetail (
    format: TextureFormat,
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
      // ASTC
      COMPRESSED_RGBA_ASTC_4x4_KHR: 0x93b0,
      // ETC2
      COMPRESSED_RGB8_ETC2: 0x9274,
      COMPRESSED_RGBA8_ETC2_EAC: 0x9278,
      // PVRTC
      COMPRESSED_RGB_PVRTC_4BPPV1_IMG: 0x8c00,
      COMPRESSED_RGBA_PVRTC_4BPPV1_IMG: 0x8c02,
      // ETC1
      ETC1_RGB8_OES: 0x8D64,
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
    const hasETC2 = isWebGL2;
    const hasETC1 = can(GLCapabilityType.etc1);

    switch (format) {
      // Uncompressed
      case TextureFormat.R8G8B8: {
        return isWebGL2
          ? uncompressed(GL_CONST.RGB8, GL_CONST.RGB)
          : uncompressed(GL_CONST.RGB, GL_CONST.RGB);
      }
      case TextureFormat.R8G8B8A8: {
        return isWebGL2
          ? uncompressed(GL_CONST.RGBA8, GL_CONST.RGBA)
          : uncompressed(GL_CONST.RGBA, GL_CONST.RGBA);
      }
      // Compressed ASTC
      case TextureFormat.ASTC_4x4: {
        if (!hasASTC) {throw new Error('WEBGL_compressed_texture_astc not supported');}

        return compressed(GL_CONST.COMPRESSED_RGBA_ASTC_4x4_KHR);
      }
      // Compressed ETC2
      case TextureFormat.ETC2_RGB: {
        if (!hasETC2) {throw new Error('ETC2 not supported');}

        return compressed(GL_CONST.COMPRESSED_RGB8_ETC2);
      }
      case TextureFormat.ETC2_RGBA8: {
        if (!hasETC2) {throw new Error('ETC2 EAC not supported');}

        return compressed(GL_CONST.COMPRESSED_RGBA8_ETC2_EAC);
      }
      // Compressed ETC1
      case TextureFormat.ETC1_RGB: {
        if (!hasETC1) {throw new Error('WEBGL_compressed_texture_etc1 not supported');}

        return compressed(GL_CONST.ETC1_RGB8_OES);
      }
      // Compressed PVRTC (WebGL 无 sRGB 变体)
      case TextureFormat.PVRTC_RGB4: {
        if (!hasPVRTC) {throw new Error('WEBGL_compressed_texture_pvrtc not supported');}

        return compressed(GL_CONST.COMPRESSED_RGB_PVRTC_4BPPV1_IMG);
      }
      case TextureFormat.PVRTC_RGBA4: {
        if (!hasPVRTC) {throw new Error('WEBGL_compressed_texture_pvrtc not supported');}

        return compressed(GL_CONST.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG);
      }
      default:
        throw new Error(`Unsupported TextureFormat: ${format}`);
    }
  }

  /**
   * @internal
   * 检查当前转码结果是否可在当前设备上上传（即 internalFormat 是否受支持）
   * @throws 若格式不支持则抛出错误
   */
  private static checkUploadable (
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    gpuCapability?: GPUCapability
  ): void {
    const engineFormat = KTX2Loader.getEngineTextureFormat(targetFormat, transcodeResult.hasAlpha);

    // 如果该 internalFormat 在当前设备不可用，会抛错
    KTX2Loader.getGLTextureDetail(engineFormat, gpuCapability);
  }

  /**
   * 将原始 KTX2 缓冲区重新转码为 RGBA8 格式
   */
  private static async transcodeToRGBA8 (srcBuffer: Uint8Array): Promise<{ result: TranscodeResult, targetFormat: KTX2TargetFormat }> {
    const binomial = KTX2Loader.getBinomialLLCTranscoder();

    await binomial.init();
    const result = await binomial.transcode(srcBuffer, KTX2TargetFormat.RGBA8);

    return { result, targetFormat: KTX2TargetFormat.RGBA8 };
  }

  /**
   * 确保转码结果可在当前设备上传；若不可用，则尝试降级
   * @returns 可上传的转码结果和最终目标格式
   */
  private static async ensureUploadable (
    ktx2Container: KTX2Container,
    srcBuffer: Uint8Array,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    gpuCapability?: GPUCapability
  ): Promise<{ result: TranscodeResult, targetFormat: KTX2TargetFormat }> {
    const can = (cap: GLCapabilityType) => {
      try { return !!gpuCapability?.canIUse?.(cap); } catch { return false; }
    };
    const isWebGL2 = !!gpuCapability?.isWebGL2;
    const hasETC2 = isWebGL2;
    const hasETC1 = can(GLCapabilityType.etc1);

    try {
      this.checkUploadable(transcodeResult, targetFormat, gpuCapability);

      return { result: transcodeResult, targetFormat };
    } catch (e) {
      // 仅处理 ETC 路径的细化逻辑
      if (targetFormat === KTX2TargetFormat.ETC) {
        // 依据转码产物区分 ETC1/ETC2
        const basisFormat = transcodeResult.format;

        if (basisFormat === 0 /* ETC1，无 alpha */) {
          // 设备有 ETC2（WebGL2），无 ETC1
          if (hasETC2 && !hasETC1) {
            console.warn('Device lacks ETC1 but has ETC2: upload ETC1 subset with ETC2 internalFormat (no re-transcode).');

            return { result: transcodeResult, targetFormat: KTX2TargetFormat.ETC };
          }

          // 设备无 ETC2，但有 ETC1
          if (!hasETC2 && hasETC1 && !ktx2Container.isSRGB) {
            console.warn('ETC2 not supported, downgrade to ETC1 internalFormat (no re-transcode).');

            return { result: transcodeResult, targetFormat: KTX2TargetFormat.ETC1 };
          }
        }

        if (basisFormat === 1 /* ETC2 (EAC RGBA)，有 alpha */) {
          // ETC2 EAC 不支持，必须回退到 RGBA8
          console.warn('ETC2 EAC not supported, fallback to RGBA8 with re-transcode.');

          return await this.transcodeToRGBA8(srcBuffer);
        }
      }

      // 其他格式或无法满足条件：统一回退 RGBA8
      console.warn('KTX2 Upload format not supported, fallback to RGBA8.', {
        targetFormat,
        isSRGB: ktx2Container.isSRGB,
        error: e instanceof Error ? e.message : e,
      });
      if (targetFormat === KTX2TargetFormat.RGBA8) {
        // 已是 RGBA8 仍失败，抛出原错误
        throw e;
      }

      return await this.transcodeToRGBA8(srcBuffer);
    }
  }

  static dispose (): void {
    this.binomialLLCTranscoder?.destroy();
    this.binomialLLCTranscoder = null;
    this.khronosTranscoder?.destroy();
    this.khronosTranscoder = null;
  }
}