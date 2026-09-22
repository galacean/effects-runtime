import type { GPUTexture } from './gpu-texture';
import { getDefaultTextureFactory } from './texture-factory';
import * as spec from '@galacean/effects-specification';
import { Asset } from '../asset';
import { TextureSourceType } from './types';
import type { TextureFactorySourceFrom, TextureSourceOptions, TextureDataType, TextureOptionsBase } from './types';
import { glContext } from '../gl';
import type { Engine } from '../engine';
import { loadImage, loadVideo } from '../downloader';
import { generateGUID, throwDestroyedError } from '../utils';
import { logger } from '../utils/logger';

let seed = 1;

/**
 * Texture 资产，组合后端 GPUTexture。
 */
export class Texture extends Asset {
  /**
   * Texture 名称
   */
  name: string;
  sourceFrom?: TextureFactorySourceFrom;
  sourceType?: TextureSourceType;
  source: TextureSourceOptions;

  /**
   * Texture 高度
   */
  width: number;
  /**
   * Texture 宽度
   */
  height: number;
  /**
   * Texture 的全局唯一 id
   */
  readonly id: string;

  protected destroyed = false;
  protected offloaded: boolean;
  private gpuTexture?: GPUTexture;
  private initialized = false;

  /**
   * 创建一个新的 Texture 对象。
   */
  static create: (engine: Engine, options?: TextureSourceOptions) => Texture;

  /**
   * 通过 URL 创建 Texture 对象。
   * @param url - 要创建的 Texture URL
   * @since 2.0.0
   */
  static async fromImage (
    url: string,
    engine: Engine,
    options?: TextureOptionsBase,
  ): Promise<Texture> {
    const image = await loadImage(url);

    const texture = Texture.create(engine, {
      sourceType: TextureSourceType.image,
      image,
      target: glContext.TEXTURE_2D,
      id: generateGUID(),
      flipY: true,
      ...options,
    });

    texture.initialize();

    return texture;
  }

  /**
   * 通过视频 URL 创建 Texture 对象。
   * @param url - 要创建的 Texture URL
   * @param engine - 引擎对象
   * @param options - 可选的 Texture 选项
   * @since 2.1.0
   * @returns
   */
  static async fromVideo (
    url: string,
    engine: Engine,
    options?: TextureOptionsBase,
  ): Promise<Texture> {
    const video = await loadVideo(url);
    const texture = Texture.create(engine, {
      sourceType: TextureSourceType.video,
      video,
      id: generateGUID(),
      flipY: true,
      ...options,
    });

    texture.initialize();

    return texture;
  }

  /**
   * 通过数据创建 Texture 对象。
   * @param data - 要创建的 Texture 数据
   * @param options - 可选的 Texture 选项
   */
  static createWithData: (
    engine: Engine,
    data?: TextureDataType,
    options?: Record<string, any>,
  ) => Texture;

  constructor (engine: Engine, source?: TextureSourceOptions) {
    super(engine);
    this.id = 'Tex' + seed++;
    if (source) {
      this.fromData(source as unknown as spec.EffectsObjectData);
    }
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  /**
   * 获取 Texture 的宽度。
   */
  getWidth () {
    return this.width || 0;
  }

  /**
   * 获取 Texture 的高度。
   */
  getHeight () {
    return this.height || 0;
  }

  async uploadCurrentVideoFrame (): Promise<boolean> {
    if (this.source.sourceType === TextureSourceType.video && this.source.video && this.initialized) {
      this.update({ video: this.source.video });

      return true;
    }

    return false;
  }

  /**
   * 释放 Texture GPU 资源。
   * 注意：该方法只释放资源，并不销毁 GPU textureBuffer 对象。
   * @override
   */
  offloadData (): void {
    if (!this.initialized || !getDefaultTextureFactory().canOffloadTexture(this.source.sourceFrom)) {
      return;
    }
    this.gpuTexture?.offloadData();
    this.syncSize();
    this.offloaded = true;
  }

  /**
   * 重新加载 Texture  GPU 资源。
   * @override
   */
  async reloadData (): Promise<void> {
    if (this.offloaded) {
      await getDefaultTextureFactory().reload(this);
    }
  }

  /**
   * 更新 Texture 源数据。
   * @param options - 创建 Texture 选项
   */
  updateSource (options: TextureSourceOptions): void {
    this.source = this.assembleOptions({ ...this.source, ...options } as TextureSourceOptions);
    this.sourceType = this.source.sourceType;
    this.sourceFrom = this.source.sourceFrom;
    this.update(this.source);
  }

  update (options: TextureSourceOptions): void {
    if (!this.gpuTexture) {
      this.width = this.height = 0;

      return;
    }
    this.gpuTexture.update(this.source, options);
    this.syncSize();
  }

  /**
   * 初始化 GPU 资源
   * @override
   */
  initialize (): void {
    if (this.initialized) {
      return;
    }
    this.engine.effectsObjectServer.addTexture(this);
    const gpuTexture = this.getGPUTexture();

    gpuTexture.initialize(this.source);
    this.syncSize();
    this.release();
    this.initialized = true;
  }

  getGPUTexture (): GPUTexture {
    if (!this.gpuTexture) {
      this.gpuTexture = this.engine.displayServer.renderingDevice.createTexture();
      this.gpuTexture.width = this.width;
      this.gpuTexture.height = this.height;
    }

    return this.gpuTexture;
  }

  private syncSize (): void {
    if (this.gpuTexture) {
      this.width = this.gpuTexture.width;
      this.height = this.gpuTexture.height;
    }
  }

  restore (): void {
    this.getGPUTexture().restore(this.source);
    this.syncSize();
    this.initialized = true;
  }

  override fromData (data: spec.EffectsObjectData): void {
    super.fromData(data);
    this.source = this.assembleOptions(data as unknown as TextureSourceOptions);
    this.sourceType = this.source.sourceType;
    this.sourceFrom = this.source.sourceFrom;
    this.name = this.source.name ?? '';
  }

  clone (): Texture {
    const texture = new Texture(this.engine, this.source);

    texture.sourceFrom = this.sourceFrom;
    texture.sourceType = this.sourceType;
    texture.width = this.width;
    texture.height = this.height;

    return texture;
  }

  /** Release upload sources only when context restoration is disabled. */
  release (): void {
    if (!this.engine.displayServer.renderingDevice.doNotHandleContextLost) {
      return;
    }
    const source = this.source as unknown as Record<string, unknown>;

    switch (this.source.sourceType) {
      case TextureSourceType.image:
        delete source.image;
        delete source.cube;

        break;
      case TextureSourceType.data:
        delete source.data;

        break;
      case TextureSourceType.compressed:
      case TextureSourceType.mipmaps:
        delete source.mipmaps;

        break;
    }
  }

  override dispose (): void {
    this.gpuTexture?.dispose();
    this.width = this.height = 0;
    this.destroyed = true;
    this.update = () => {
      logger.error('This texture has been destroyed.');
    };
    this.initialize = throwDestroyedError as unknown as () => void;
    if (this.engine !== undefined) {
      this.engine.effectsObjectServer.removeTexture(this);
    }
    super.dispose();
  }

  protected assembleOptions (options: TextureSourceOptions): TextureSourceOptions {
    const { target = glContext.TEXTURE_2D, format: internalFormat = glContext.RGBA } = options;

    if (!options.sourceType) {
      if ('image' in options) {
        options.sourceType = TextureSourceType.image;
      } else if ('data' in options) {
        options.sourceType = TextureSourceType.data;
      } else if ('video' in options) {
        options.sourceType = TextureSourceType.video;
      } else {
        options.sourceType = 0; // TextureSourceType.none
      }
    }

    return {
      minFilter: glContext.NEAREST,
      magFilter: glContext.NEAREST,
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
      target: target as WebGLRenderingContext['TEXTURE_2D'],
      format: glContext.RGBA,
      internalFormat,
      type: glContext.UNSIGNED_BYTE,
      ...options,
    };
  }
}

export function generateHalfFloatTexture (engine: Engine, data: Uint16Array, width: number, height: number): Texture {
  const channel = data.length / width / height;
  let format;
  let internalFormat;

  if (channel === 4 || channel === 0) {
    internalFormat = format = glContext.RGBA;
  } else if (channel === 3) {
    internalFormat = format = glContext.RGB;
  } else if (channel === 2) {
    internalFormat = format = glContext.LUMINANCE_ALPHA;
  } else {
    internalFormat = format = glContext.LUMINANCE;
  }

  return Texture.createWithData(
    engine,
    {
      data, width, height,
    },
    {
      type: glContext.HALF_FLOAT,
      format,
      internalFormat,
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
    });
}

const sourceOptions = {
  type: glContext.UNSIGNED_BYTE,
  format: glContext.RGBA,
  internalFormat: glContext.RGBA,
  wrapS: glContext.MIRRORED_REPEAT,
  wrapT: glContext.MIRRORED_REPEAT,
  minFilter: glContext.NEAREST,
  magFilter: glContext.NEAREST,
};

export function generateWhiteTexture (engine: Engine) {
  return Texture.create(
    engine,
    {
      id: spec.BuiltinObjectGUID.WhiteTexture,
      data: {
        width: 1,
        height: 1,
        data: new Uint8Array([255, 255, 255, 255]),
      },
      sourceType: TextureSourceType.data,
      ...sourceOptions,
    },
  );
}

export function generateEmptyTexture (engine: Engine) {
  return Texture.create(
    engine,
    {
      id: spec.BuiltinObjectGUID.EmptyTexture,
      data: {
        width: 1,
        height: 1,
        data: new Uint8Array([0, 0, 0, 0]),
      },
      sourceType: TextureSourceType.data,
      ...sourceOptions,
    },
  );
}
