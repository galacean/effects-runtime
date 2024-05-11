import { TextureSourceType } from './types';
import type { TextureFactorySourceFrom, TextureSourceOptions, TextureDataType } from './types';
import { glContext } from '../gl';
import type { Engine } from '../engine';
import { EffectsObject } from '../effects-object';
import { loadImage } from '../downloader';
import { generateGUID } from '../utils';

let seed = 1;

/**
 * Texture 抽象类
 */
export abstract class Texture extends EffectsObject {
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

  /**
   * 创建一个新的 Texture 对象。
   */
  static create: (engine: Engine, options?: TextureSourceOptions) => Texture;

  /**
   * 通过 URL 创建 Texture 对象。
   * @param url - 要创建的 Texture URL
   * @since 2.0.0
   */
  static async fromImage (url: string, engine: Engine): Promise<Texture> {
    const image = await loadImage(url);

    const texture = Texture.create(engine, {
      sourceType: TextureSourceType.image,
      image,
      id: generateGUID(),
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

  constructor (engine: Engine) {
    super(engine);
    this.id = 'Tex' + seed++;
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

  uploadCurrentVideoFrame () {
    // OVERRIDE
  }

  /**
   * 释放 Texture GPU 资源。
   * 注意：该方法只释放资源，并不销毁 GPU textureBuffer 对象。
   * @override
   */
  offloadData () {
    // OVERRIDE
  }

  /**
   * 重新加载 Texture  GPU 资源。
   * @override
   */
  reloadData () {
    // OVERRIDE
  }

  /**
   * 更新 Texture 源数据。
   * @param options - 创建 Texture 选项
   */
  abstract updateSource (options: TextureSourceOptions): void;

  /**
   * 销毁当前资源。
   */
  abstract override dispose (): void;

  /**
   * 初始化 GPU 资源
   * @override
   */
  initialize (): void {
    // OVERRIDE
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

export function generateWhiteTexture (engine: Engine) {
  return Texture.create(
    engine,
    {
      id: 'whitetexture00000000000000000000',
      data: {
        width: 1,
        height: 1,
        data: new Uint8Array([255, 255, 255, 255]),
      },
      sourceType: TextureSourceType.data,
      type: glContext.UNSIGNED_BYTE,
      format: glContext.RGBA,
      internalFormat: glContext.RGBA,
      wrapS: glContext.MIRRORED_REPEAT,
      wrapT: glContext.MIRRORED_REPEAT,
      minFilter: glContext.NEAREST,
      magFilter: glContext.NEAREST,
    },
  );
}
