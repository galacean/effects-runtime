import type {
  Engine, Texture2DSourceOptionsCompressed, Texture2DSourceOptionsData,
  Texture2DSourceOptionsFrameBuffer, Texture2DSourceOptionsImage,
  Texture2DSourceOptionsVideo, TextureDataType, TextureSourceOptions,
} from '@galacean/effects-core';
import { glContext, Texture, TextureSourceType } from '@galacean/effects-core';

import * as PIXI from 'pixijs';

/**
 * PIXI 抽象纹理类
 */
export class PIXITexture extends Texture {
  /**
   * PIXI 纹理对象
   */
  texture: PIXI.Texture;

  /**
   * 将 WebGL 纹理过滤器枚举类型映射到 PIXIJS 纹理过滤器枚举类型
   * @param filter - WebGL 纹理过滤器枚举类型
   * @returns PIXIJS 纹理过滤器枚举类型
  */
  static toPixiJsTextureFilter (filter?: GLenum): PIXI.SCALE_MODES {
    switch (filter) {
      case glContext.LINEAR:
        return PIXI.SCALE_MODES.LINEAR;
      default:
        return PIXI.SCALE_MODES.NEAREST;
    }
  }

  /**
   * 将 WebGL 纹理环绕方式枚举类型映射到 PIXI 纹理环绕方式枚举类型
   * @param wrap - WebGL 纹理环绕方式枚举类型
   * @returns PIXI 纹理环绕方式枚举类型
   */
  static toPixiJsTextureWrap (wrap?: GLenum): PIXI.WRAP_MODES {
    switch (wrap) {
      case glContext.MIRRORED_REPEAT:
        return PIXI.WRAP_MODES.MIRRORED_REPEAT;
      case glContext.REPEAT:
        return PIXI.WRAP_MODES.REPEAT;
      default:
        return PIXI.WRAP_MODES.CLAMP;
    }
  }

  /**
   * 构造函数
   * @param data - 纹理数据
   * @param options - 纹理选项
   */
  constructor (engine: Engine, data?: TextureDataType, options: TextureSourceOptions = {}) {
    super(engine);
    if (data) {
      const { width = 1, height = 1 } = data;

      this.texture = this.createTextureByType({
        ...options as Texture2DSourceOptionsData,
        sourceType: TextureSourceType.data,
        data,
      });
      this.width = width;
      this.height = height;
    } else {
      this.texture = this.createTextureByType(options);
    }
    this.texture.needsUpdate = true;
  }

  /**
   * 更新纹理数据
   * @param options - 纹理选项
   */
  updateSource (options: TextureSourceOptions) {
    this.texture.dispose();
    this.texture = this.createTextureByType(options);

    this.texture.needsUpdate = true;
  }

  /**
   * 开始更新视频数据
   *
   */
  async startVideo () {
    if (this.sourceType === TextureSourceType.video) {
      const video = (this.texture).source.data;

      if (video.paused) {
        await video.play();
      }
    }
  }

  /**
   * 组装纹理选项
   * @param options - 纹理选项
   * @returns 组装后的纹理选项
   */
  override assembleOptions (options: TextureSourceOptions): TextureSourceOptions {
    const { target = glContext.TEXTURE_2D } = options;

    if (!options.sourceType) {
      if ('image' in options) {
        options.sourceType = TextureSourceType.image;
      } else if ('data' in options) {
        options.sourceType = TextureSourceType.data;
      } else if ('video' in options) {
        options.sourceType = TextureSourceType.video;
      } else {
        options.sourceType = TextureSourceType.none; // TextureSourceType.none
      }
    }

    // @ts-expect-error
    return {
      target,
      format: PIXI.RGBAFormat,
      type: PIXI.UnsignedByteType,
      ...options,
      minFilter: PIXITexture.toPixiJsTextureFilter(options.minFilter),
      magFilter: PIXITexture.toPixiJsTextureFilter(options.magFilter),
      wrapS: PIXITexture.toPixiJsTextureWrap(options.wrapS),
      wrapT: PIXITexture.toPixiJsTextureWrap(options.wrapT),
    };
  }

  /**
   * 释放纹理占用的内存
   */
  dispose () {
    this.texture.dispose();
  }

  private createTextureByType (options: TextureSourceOptions): PIXI.Texture {
    const assembleOptions = this.assembleOptions(options);
    // TODO renderer.getMaxAnisotropy() 查询最大各向异性
    const {
      flipY,
      type,
      wrapS,
      wrapT,
      minFilter,
      magFilter,
      sourceType,
    } = assembleOptions;
    const mapping = PIXI.UVMapping;
    let { format } = assembleOptions;
    let texture: PIXI.Texture | undefined = undefined;

    this.sourceType = sourceType;
    if (sourceType === TextureSourceType.data) {
      const { data } = options as Texture2DSourceOptionsData;

      texture = new PIXI.DataTexture(
        data.data, data.width, data.height,
        format, type, mapping, wrapS, wrapT, magFilter, minFilter
      );
      this.width = data.width;
      this.height = data.height;
    } else if (sourceType === TextureSourceType.image) {
      const { image } = options as Texture2DSourceOptionsImage;

      texture = new PIXI.Texture(
        image, mapping, wrapS, wrapT, magFilter, minFilter, format, type
      );
      this.width = image.width;
      this.height = image.height;
    } else if (sourceType === TextureSourceType.compressed) {
      let maxWidth = 0;
      let maxHeight = 0;
      const mipmaps = (options as Texture2DSourceOptionsCompressed).mipmaps.map(({ data, width, height }) => {
        maxWidth = maxWidth < width ? width : maxWidth;
        maxHeight = maxHeight < height ? height : maxHeight;

        return {
          data,
          width,
          height,
          colorSpace: 'srgb',
        };
      });

      // FIXME
      format = PIXI.RGBA_ASTC_4x4_Format;

      texture = new PIXI.CompressedTexture(
        mipmaps as unknown as ImageData[], maxWidth, maxHeight, format, type, mapping, wrapS, wrapT, magFilter, minFilter
      );
      this.width = maxWidth;
      this.height = maxHeight;
    } else if (sourceType === TextureSourceType.video) {
      texture = new PIXI.VideoTexture(
        (options as Texture2DSourceOptionsVideo).video,
        mapping, wrapS, wrapT, magFilter, minFilter, format, type
      );
    } else if (sourceType === TextureSourceType.framebuffer) {
      const { data } = options as Texture2DSourceOptionsFrameBuffer;

      if (data) {
        const width = data.width ?? 0;
        const height = data.height ?? 0;

        texture = new PIXI.FramebufferTexture(width, height, format as PIXI.PixelFormat);
        this.width = width;
        this.height = height;
      }
    } else if (sourceType === TextureSourceType.none) {
      texture = new PIXI.DataTexture(new Uint8Array(4).fill(255), 1, 1);
      texture.wrapS = PIXI.MirroredRepeatWrapping;
      texture.wrapT = PIXI.MirroredRepeatWrapping;
      this.width = this.height = 1;
    }
    if (texture) {
      texture.flipY = !!(flipY);

      return texture;
    }
    throw new Error('使用未知的数据类型创建纹理');
  }

}

