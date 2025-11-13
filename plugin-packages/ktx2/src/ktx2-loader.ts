import { KTX2TargetFormat, TextureFormat } from './ktx2-common';
import { KhronosTranscoder } from './transcoder/khronos-transcoder';
import { DFDTransferFunction, KTX2Container } from './ktx2-container';
import { BinomialLLCTranscoder } from './transcoder/binomial-transcoder';
import { TextureSourceType, GLCapabilityType, loadBinary, isPowerOfTwo, glContext, textureLoaderRegistry } from '@galacean/effects';
import type { TranscodeResult } from './transcoder/abstract-transcoder';
import type { GPUCapability, Texture2DSourceOptionsCompressed, TextureDataType, TextureLoader } from '@galacean/effects';

export class KTX2Loader implements TextureLoader {
  private binomialLLCTranscoder: BinomialLLCTranscoder | null = null;
  private khronosTranscoder: KhronosTranscoder | null = null;
  private binomialInitPromise?: Promise<void>;
  private khronosInitPromise?: Promise<void>;

  private readonly priorityFormats = {
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

  private readonly capabilityMap: Partial<Record<KTX2TargetFormat, Partial<Record<DFDTransferFunction, GLCapabilityType[]>>>> = {
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

  constructor (
    private readonly useKhronosTranscoder: boolean = false,
    private readonly workerCount: number = 2
  ) {
  }

  /**
   * 初始化 BinomialLLC Transcoder
   */
  private async initBinomialLLCTranscoder (): Promise<void> {
    if (this.binomialLLCTranscoder) {
      return;
    }

    try {
      const transcoder = new BinomialLLCTranscoder(this.workerCount);

      await transcoder.init();
      this.binomialLLCTranscoder = transcoder;
    } catch (error) {
      console.error('Failed to initialize BinomialLLCTranscoder:', error);
      this.binomialLLCTranscoder = null;
      this.binomialInitPromise = undefined;
      throw error;
    }
  }

  /**
   * 初始化 Khronos Transcoder
   */
  private async initKhronosTranscoder (): Promise<void> {
    if (this.khronosTranscoder) {
      return;
    }

    try {
      const transcoder = new KhronosTranscoder(this.workerCount, KTX2TargetFormat.ASTC);

      await transcoder.init();
      this.khronosTranscoder = transcoder;
    } catch (error) {
      console.error('Failed to initialize KhronosTranscoder:', error);
      this.khronosTranscoder = null;
      this.khronosInitPromise = undefined;
      throw error;
    }
  }

  /**
   * 确保 BinomialLLC Transcoder 已初始化
   */
  private async ensureBinomialLLCTranscoder (): Promise<BinomialLLCTranscoder> {
    if (this.binomialLLCTranscoder) {
      return this.binomialLLCTranscoder;
    }

    if (!this.binomialInitPromise) {
      this.binomialInitPromise = this.initBinomialLLCTranscoder();
    }

    await this.binomialInitPromise;

    if (!this.binomialLLCTranscoder) {
      throw new Error('BinomialLLCTranscoder initialization failed');
    }

    return this.binomialLLCTranscoder;
  }

  /**
   * 确保 Khronos Transcoder 已初始化
   */
  private async ensureKhronosTranscoder (): Promise<KhronosTranscoder> {
    if (this.khronosTranscoder) {
      return this.khronosTranscoder;
    }

    if (!this.khronosInitPromise) {
      this.khronosInitPromise = this.initKhronosTranscoder();
    }

    await this.khronosInitPromise;

    if (!this.khronosTranscoder) {
      throw new Error('KhronosTranscoder initialization failed');
    }

    return this.khronosTranscoder;
  }

  /**
   * 从 ArrayBuffer 加载 KTX2 纹理并返回压缩纹理源选项
   */
  async loadFromBuffer (arrBuffer: ArrayBuffer, gpuCapability?: GPUCapability) {
    if (!gpuCapability) {
      throw new Error('GPUCapability is required');
    }

    const buffer = new Uint8Array(arrBuffer);
    const { ktx2Container, result, targetFormat } = await this.parseBuffer(buffer, gpuCapability);

    return this.createTextureByBuffer(ktx2Container, result, targetFormat, gpuCapability);
  }

  /**
   * 从 URL 加载 KTX2 纹理并返回压缩纹理源选项
   */
  async loadFromURL (url: string, gpuCapability?: GPUCapability) {
    if (!gpuCapability) {
      throw new Error('GPUCapability is required');
    }

    const buffer = new Uint8Array(await loadBinary(url));
    const { ktx2Container, result, targetFormat } = await this.parseBuffer(buffer, gpuCapability);

    return this.createTextureByBuffer(ktx2Container, result, targetFormat, gpuCapability);
  }

  /**
   * @internal
   * 解析并转码 KTX2 文件
   */
  private async parseBuffer (buffer: Uint8Array, gpuCapability?: GPUCapability) {
    const ktx2Container = new KTX2Container(buffer);

    if (ktx2Container.isNotBasis) {
      throw new Error('Unsupported KTX2: only Basis (ETC1S/UASTC) containers are supported');
    }

    // TODO: DIY priorityFormats
    const formatPriorities = this.priorityFormats[ktx2Container.isUASTC ? 'uastc' : 'etc1s'];
    const targetFormat = this.decideTargetFormat(ktx2Container, formatPriorities, gpuCapability);
    const transcodeTarget = (targetFormat === KTX2TargetFormat.ETC1) ? KTX2TargetFormat.ETC : targetFormat;

    let transcodeResultPromise: Promise<TranscodeResult>;

    // 根据实际需要选择并等待 transcoder 初始化
    if (this.useKhronosTranscoder && targetFormat === KTX2TargetFormat.ASTC && ktx2Container.isUASTC) {
      const transcoder = await this.ensureKhronosTranscoder();

      console.info('Using KhronosTranscoder for ASTC UASTC texture');
      transcodeResultPromise = transcoder.transcode(ktx2Container);
    } else {
      const transcoder = await this.ensureBinomialLLCTranscoder();

      transcodeResultPromise = transcoder.transcode(buffer, transcodeTarget);
    }

    const result = await transcodeResultPromise;

    // 预检查：如果当前 internalFormat 实际不可用，回退到 RGBA8 重转码
    const ensured = await this.ensureUploadable(ktx2Container, buffer, result, targetFormat, gpuCapability);

    return {
      ktx2Container,
      gpuCapability,
      result: ensured.result,
      targetFormat: ensured.targetFormat,
    };
  }

  /**
   * @internal
   * 根据设备能力和图像属性决定最优的转码目标格式
   * @param ktx2Container - KTX2 容器对象
   * @param priorityFormats - 候选格式优先级列表
   * @param gpuCapability - GPU 能力信息
   */
  private decideTargetFormat (
    ktx2Container: KTX2Container,
    priorityFormats?: KTX2TargetFormat[],
    gpuCapability?: GPUCapability,
  ): KTX2TargetFormat {
    const { isSRGB, pixelWidth, pixelHeight } = ktx2Container;
    const hasAlpha = this.containerHasAlpha(ktx2Container);
    const targetFormat = this.detectSupportedFormat(priorityFormats ?? [], isSRGB, hasAlpha, gpuCapability);

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
  private containerHasAlpha (ktx2Container: KTX2Container): boolean {
    // 对 UASTC 保守处理：可能包含 alpha
    if (ktx2Container.isUASTC) {
      return true;
    }

    // 对 ETC1S：依据 BasisLZ 的 imageDescs.alphaSliceByteLength 判断
    const globalData = ktx2Container.globalData;

    if (!globalData) {
      return false;
    }

    return globalData.imageDescs?.some(desc => desc.alphaSliceByteLength > 0) ?? false;
  }

  /**
   * @internal
   * 从优先级格式列表中检测设备支持的第一个可用格式
   * @param priorityFormats - 格式优先级列表
   * @param isSRGB - 是否为 sRGB 色彩空间
   * @param hasAlpha - 是否包含 Alpha 通道
   * @param gpuCapability - GPU 能力信息
   * @returns 支持的 KTX2TargetFormat，若无则返回 null
   */
  private detectSupportedFormat (
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
        if (!gpuCapability) {
          return null;
        }

        for (let j = 0; j < capabilities.length; j++) {
          if (gpuCapability.canIUse(capabilities[j])) {
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
   * @internal
   * 根据转码结果创建引擎所需的压缩纹理源选项
   * @param ktx2Container - KTX2 容器对象
   * @param transcodeResult - 转码结果
   * @param targetFormat - 目标格式
   * @param gpuCapability - GPU 能力信息
   * @returns Texture2DSourceOptionsCompressed 配置对象
   */
  createTextureByBuffer (
    ktx2Container: KTX2Container,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    gpuCapability?: GPUCapability,
  ): Texture2DSourceOptionsCompressed {
    const textureFormat = this.getEngineTextureFormat(targetFormat, transcodeResult.hasAlpha);
    const { pixelWidth, pixelHeight, faceCount } = ktx2Container;
    const { internalFormat, format, type } = this.getGLTextureDetail(textureFormat, gpuCapability);

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
   * @param hasAlpha - 是否包含 Alpha 通道
   * @returns 对应的 TextureFormat
   */
  private getEngineTextureFormat (
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
   * 根据引擎纹理格式获取 WebGL 所需的 internalFormat、format 和 type
   * @param format - 引擎内部纹理格式
   * @param gpuCapability - GPU 能力信息
   * @returns 包含 internalFormat、format、type 的对象
   */
  private getGLTextureDetail (
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

    // 当 gpuCapability 未提供时，按"WebGL1 且无扩展"的最保守路径处理
    const isWebGL2 = !!gpuCapability?.isWebGL2;
    const can = (cap: GLCapabilityType) => {
      try {
        return !!gpuCapability?.canIUse?.(cap);
      } catch {
        return false;
      }
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
        if (!hasASTC) {
          throw new Error('WEBGL_compressed_texture_astc not supported');
        }

        return compressed(GL_CONST.COMPRESSED_RGBA_ASTC_4x4_KHR);
      }
      // Compressed ETC2
      case TextureFormat.ETC2_RGB: {
        if (!hasETC2) {
          throw new Error('ETC2 not supported');
        }

        return compressed(GL_CONST.COMPRESSED_RGB8_ETC2);
      }
      case TextureFormat.ETC2_RGBA8: {
        if (!hasETC2) {
          throw new Error('ETC2 EAC not supported');
        }

        return compressed(GL_CONST.COMPRESSED_RGBA8_ETC2_EAC);
      }
      // Compressed ETC1
      case TextureFormat.ETC1_RGB: {
        if (!hasETC1) {
          throw new Error('WEBGL_compressed_texture_etc1 not supported');
        }

        return compressed(GL_CONST.ETC1_RGB8_OES);
      }
      // Compressed PVRTC
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

  /**
   * @internal
   * 检查当前转码结果是否可在当前设备上上传（即 internalFormat 是否受支持）
   * @throws 若格式不支持则抛出错误
   */
  private checkUploadable (
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    gpuCapability?: GPUCapability
  ): void {
    const engineFormat = this.getEngineTextureFormat(targetFormat, transcodeResult.hasAlpha);

    // 如果该 internalFormat 在当前设备不可用，会抛错
    this.getGLTextureDetail(engineFormat, gpuCapability);
  }

  /**
   * @internal
   * 将原始 KTX2 缓冲区重新转码为 RGBA8 格式
   */
  private async transcodeToRGBA8 (srcBuffer: Uint8Array): Promise<{ result: TranscodeResult, targetFormat: KTX2TargetFormat }> {
    try {
      const transcoder = await this.ensureBinomialLLCTranscoder();
      const result = await transcoder.transcode(srcBuffer, KTX2TargetFormat.RGBA8);

      return { result, targetFormat: KTX2TargetFormat.RGBA8 };
    } catch (error) {
      console.error('Failed to transcode to RGBA8:', error);
      throw new Error('KTX2 fallback to RGBA8 failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * @internal
   * 确保转码结果可在当前设备上传；若不可用，则尝试降级
   * @returns 可上传的转码结果和最终目标格式
   */
  private async ensureUploadable (
    ktx2Container: KTX2Container,
    srcBuffer: Uint8Array,
    transcodeResult: TranscodeResult,
    targetFormat: KTX2TargetFormat,
    gpuCapability?: GPUCapability
  ): Promise<{ result: TranscodeResult, targetFormat: KTX2TargetFormat }> {
    const can = (cap: GLCapabilityType) => {
      try {
        return !!gpuCapability?.canIUse?.(cap);
      } catch {
        return false;
      }
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

  /**
   * 销毁加载器，释放资源
   */
  dispose (): void {
    this.binomialLLCTranscoder?.destroy();
    this.binomialLLCTranscoder = null;
    this.binomialInitPromise = undefined;

    this.khronosTranscoder?.destroy();
    this.khronosTranscoder = null;
    this.khronosInitPromise = undefined;
  }
}

/**
 * 注册 KTX2 加载器到全局注册表
 * @param options - 初始化选项
 */
export function registerKTX2Loader (options?: {
  preferKhronosForASTC?: boolean,
  workerCount?: number,
}) {
  const { preferKhronosForASTC: useKhronosTranscoder = true, workerCount = 2 } = options ?? {};

  textureLoaderRegistry.register('ktx2', () => {
    return new KTX2Loader(useKhronosTranscoder, workerCount);
  });
}

/**
 * 注销 KTX2 加载器
 */
export function unregisterKTX2Loader () {
  textureLoaderRegistry.unregister('ktx2');
}
