import type {
  Texture2DSourceOptionsCompressed, Texture2DSourceOptionsData,
  Texture2DSourceOptionsFramebuffer, Texture2DSourceOptionsImage,
  Texture2DSourceOptionsVideo, TextureSourceOptions,
} from '@galacean/effects-core';
import { glContext, GPUTexture, TextureSourceType } from '@galacean/effects-core';
import * as THREE from 'three';

/**
 * Three.js 纹理资源，原生 Renderer 和上下文仍由宿主管理。
 */
export class GPUTextureThree extends GPUTexture {
  /**
   * THREE 纹理对象
   */
  texture: THREE.Texture;

  /**
   * 将 WebGL 纹理过滤器枚举类型映射到 THREE 纹理过滤器枚举类型
   * @param filter - WebGL 纹理过滤器枚举类型
   * @returns THREE 纹理过滤器枚举类型
  */
  static toThreeJsTextureFilter (filter?: GLenum): THREE.TextureFilter {
    switch (filter) {
      case glContext.LINEAR:
        return THREE.LinearFilter;
      default:
        return THREE.NearestFilter;
    }
  }

  /**
   * 将 WebGL 纹理环绕方式枚举类型映射到 THREE 纹理环绕方式枚举类型
   * @param wrap - WebGL 纹理环绕方式枚举类型
   * @returns THREE 纹理环绕方式枚举类型
   */
  static toThreeJsTextureWrap (wrap?: GLenum): THREE.Wrapping {
    switch (wrap) {
      case glContext.MIRRORED_REPEAT:
        return THREE.MirroredRepeatWrapping;
      case glContext.REPEAT:
        return THREE.RepeatWrapping;
      default:
        return THREE.ClampToEdgeWrapping;
    }
  }

  override initialize (source: TextureSourceOptions): void {
    this.texture = this.createTextureByType(source);
    this.texture.needsUpdate = true;
    this.initialized = true;
  }

  override update (source: TextureSourceOptions, options: TextureSourceOptions = source): void {
    if (!this.texture) {
      this.width = this.height = 0;

      return;
    }
    // VideoTexture already refreshes its image through the host renderer.
    if (source.sourceType === TextureSourceType.video && options !== source) {
      return;
    }
    this.texture.dispose();
    this.initialize({ ...source, ...options } as TextureSourceOptions);
  }

  // VideoTexture and the host renderer manage frame uploads and context recovery.
  override offloadData (): void {}
  override restore (): void {}

  /**
   * 组装纹理选项
   * @param options - 纹理选项
   * @returns 组装后的纹理选项
   */
  private assembleOptions (options: TextureSourceOptions): TextureSourceOptions {
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
      ...options,
      target,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: GPUTextureThree.toThreeJsTextureFilter(options.minFilter),
      magFilter: GPUTextureThree.toThreeJsTextureFilter(options.magFilter),
      wrapS: GPUTextureThree.toThreeJsTextureWrap(options.wrapS),
      wrapT: GPUTextureThree.toThreeJsTextureWrap(options.wrapT),
    };
  }

  /**
   * 释放纹理占用的内存
   */
  override dispose (): void {
    if (this.texture) {
      this.texture.dispose();
    }
    this.destroyed = true;
  }

  private createTextureByType (options: TextureSourceOptions): THREE.Texture {
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
    const mapping = THREE.UVMapping;
    let { format } = assembleOptions;
    let texture: THREE.Texture | undefined = undefined;

    if (sourceType === TextureSourceType.data) {
      const { data } = options as Texture2DSourceOptionsData;

      texture = new THREE.DataTexture(
        data.data, data.width, data.height,
        format, type, mapping, wrapS, wrapT, magFilter, minFilter
      );
      this.width = data.width;
      this.height = data.height;
    } else if (sourceType === TextureSourceType.image) {
      const { image } = options as Texture2DSourceOptionsImage;

      texture = new THREE.Texture(
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
      format = THREE.RGBA_ASTC_4x4_Format;

      texture = new THREE.CompressedTexture(
        mipmaps as unknown as ImageData[], maxWidth, maxHeight, format, type, mapping, wrapS, wrapT, magFilter, minFilter
      );
      this.width = maxWidth;
      this.height = maxHeight;
    } else if (sourceType === TextureSourceType.video) {
      texture = new THREE.VideoTexture(
        (options as Texture2DSourceOptionsVideo).video,
        mapping, wrapS, wrapT, magFilter, minFilter, format, type
      );
    } else if (sourceType === TextureSourceType.framebuffer) {
      const { data } = options as Texture2DSourceOptionsFramebuffer;

      if (data) {
        const width = data.width ?? 0;
        const height = data.height ?? 0;

        texture = new THREE.FramebufferTexture(width, height, format as THREE.PixelFormat);
        this.width = width;
        this.height = height;
      }
    } else if (sourceType === TextureSourceType.none) {
      texture = new THREE.DataTexture(new Uint8Array(4).fill(255), 1, 1);
      texture.wrapS = THREE.MirroredRepeatWrapping;
      texture.wrapT = THREE.MirroredRepeatWrapping;
      this.width = this.height = 1;
    }
    if (texture) {
      texture.flipY = !!flipY;

      return texture;
    }
    throw new Error('Create a texture using an unknown data type.');
  }

}

