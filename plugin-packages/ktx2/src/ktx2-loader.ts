import type {
  GPUCapability, Texture2DSourceOptionsCompressed, TextureDataType, TextureLoader,
} from '@galacean/effects';
import {
  TextureSourceType, CompressTextureCapabilityType, loadBinary, glContext,
  textureLoaderRegistry,
} from '@galacean/effects';
import { KTX2TargetFormat } from './ktx2-common';
import { KTX2Container } from './ktx2-container';
import { KhronosTranscoder } from './transcoder/khronos-transcoder';
import type { TranscodeResult } from './transcoder/texture-transcoder';

/**
 * KTX2 加载器 - 专用于 UASTC 转 ASTC
 */
export class KTX2Loader implements TextureLoader {
  private khronosTranscoder: KhronosTranscoder | null = null;
  private khronosInitPromise?: Promise<void>;

  constructor (
    private readonly workerCount = 2,
    private readonly useWebWorker = true,
  ) { }

  /**
   * 初始化 Khronos Transcoder
   */
  private async initKhronosTranscoder (): Promise<void> {
    if (this.khronosTranscoder) {
      return;
    }

    try {
      const transcoder = new KhronosTranscoder(this.workerCount, KTX2TargetFormat.ASTC, this.useWebWorker);

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
    const { ktx2Container, result } = await this.parseBuffer(buffer, gpuCapability);

    return this.createTextureByBuffer(ktx2Container, result, gpuCapability);
  }

  /**
   * 从 URL 加载 KTX2 纹理并返回压缩纹理源选项
   */
  async loadFromURL (url: string, gpuCapability?: GPUCapability) {
    if (!gpuCapability) {
      throw new Error('GPUCapability is required');
    }

    const buffer = new Uint8Array(await loadBinary(url));
    const { ktx2Container, result } = await this.parseBuffer(buffer, gpuCapability);

    return this.createTextureByBuffer(ktx2Container, result, gpuCapability);
  }

  /**
   * @internal
   * 解析并转码 KTX2 文件
   */
  private async parseBuffer (buffer: Uint8Array, gpuCapability: GPUCapability) {
    const ktx2Container = new KTX2Container(buffer);

    // 验证格式支持
    if (!ktx2Container.isUASTC) {
      throw new Error('Unsupported KTX2: only UASTC format is supported');
    }

    // 验证 ASTC 支持
    this.checkASTCSupport(gpuCapability);

    // 转码
    const transcoder = await this.ensureKhronosTranscoder();
    const result = await transcoder.transcode(ktx2Container);

    return {
      ktx2Container,
      result,
    };
  }

  /**
   * @internal
   * 检查设备是否支持 ASTC
   */
  private checkASTCSupport (gpuCapability: GPUCapability): void {
    const hasASTC =
      gpuCapability.isCompressedFormatSupported(CompressTextureCapabilityType.astc) ||
      gpuCapability.isCompressedFormatSupported(CompressTextureCapabilityType.astc_webkit);

    if (!hasASTC) {
      throw new Error('ASTC compressed texture is not supported on this device');
    }
  }

  /**
   * @internal
   * 根据转码结果创建引擎所需的压缩纹理源选项
   */
  private createTextureByBuffer (
    ktx2Container: KTX2Container,
    transcodeResult: TranscodeResult,
    gpuCapability: GPUCapability,
  ): Texture2DSourceOptionsCompressed {
    const { pixelWidth, pixelHeight, faceCount } = ktx2Container;
    const { internalFormat, format, type } = this.getGLTextureDetail(gpuCapability);

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

    return {
      sourceType: TextureSourceType.compressed,
      target,
      internalFormat,
      format,
      type,
      mipmaps,
    };
  }

  /**
   * @internal
   * 获取 ASTC 4x4 的 WebGL 格式信息
   */
  private getGLTextureDetail (gpuCapability: GPUCapability) {
    const COMPRESSED_RGBA_ASTC_4x4_KHR = 0x93b0;

    const hasASTC =
      gpuCapability.isCompressedFormatSupported(CompressTextureCapabilityType.astc) ||
      gpuCapability.isCompressedFormatSupported(CompressTextureCapabilityType.astc_webkit);

    if (!hasASTC) {
      throw new Error('WEBGL_compressed_texture_astc not supported');
    }

    return {
      internalFormat: COMPRESSED_RGBA_ASTC_4x4_KHR,
      format: 0,
      type: 0,
    };
  }

  /**
   * 销毁加载器，释放资源
   */
  dispose (): void {
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
  workerCount?: number,
  useWebWorker?: boolean,
}) {
  const { workerCount = 2, useWebWorker = false } = options ?? {};

  textureLoaderRegistry.register('ktx2', () => {
    return new KTX2Loader(workerCount, useWebWorker);
  });
}

/**
 * 注销 KTX2 加载器
 */
export function unregisterKTX2Loader () {
  textureLoaderRegistry.unregister('ktx2');
}
