import type {
  Disposable, RestoreHandler,
  Texture2DSourceOptionsCompressed,
  Texture2DSourceOptionsData,
  Texture2DSourceOptionsImage,
  Texture2DSourceOptionsImageMipmaps,
  Texture2DSourceOptionsVideo,
  TextureConfigOptions,
  TextureCubeSourceOptionsImage,
  TextureCubeSourceOptionsImageMipmaps,
  TextureDataType,
  TextureSourceOptions,
  Texture2DSourceOptionsFrameBuffer,
  spec, Engine,
} from '@galacean/effects-core';
import {
  getDefaultTextureFactory,
  glContext,
  nearestPowerOfTwo,
  Texture,
  TextureSourceType,
  isWebGL2,
  throwDestroyedError,
  canvasPool,
  LOG_TYPE,
} from '@galacean/effects-core';
import type { GLPipelineContext } from './gl-pipeline-context';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLEngine } from './gl-engine';

type HTMLImageLike = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

const FORMAT_HALF_FLOAT: Record<string, number> = {
  [glContext.RGBA]: 34842, //RGBA16F
  [glContext.RGB]: 34843, //RGB16F
  [glContext.ALPHA]: 33325, //R16F
  [glContext.RED]: 33325, //R16F
  [glContext.LUMINANCE_ALPHA]: 33327, //RG16F
  [glContext.LUMINANCE]: 33325,
};
const FORMAT_FLOAT: Record<string, number> = {
  [glContext.RGBA]: 34836, //RGBA32F
  [glContext.RGB]: 34837, //RGB32F
  [glContext.ALPHA]: 33326, //R32F
  [glContext.RED]: 33326, //R32F
  [glContext.LUMINANCE_ALPHA]: 33328, //RG32F,
  [glContext.LUMINANCE]: 33326, //R32F
};
let flipCanvas: HTMLCanvasElement;

export class GLTexture extends Texture implements Disposable, RestoreHandler {
  textureBuffer: WebGLTexture | null;
  target: GLenum;

  private pipelineContext: GLPipelineContext;
  private initialized = false;

  constructor (engine: Engine, source: TextureSourceOptions) {
    super();
    const opts = this.assembleOptions(source);
    const { sourceType, sourceFrom, name = '' } = opts;

    this.source = opts;
    this.sourceType = sourceType;
    this.sourceFrom = sourceFrom;
    this.name = name;
    this.engine = engine;
  }

  /** 绑定当前Texture对象。*/
  bind (force?: boolean) {
    this.pipelineContext.bindTexture(this.target, this.textureBuffer, force);
  }

  /** 初始化Texture的GPU资源。*/
  override initialize (): void {
    if (this.initialized) {
      return;
    }
    const glEngine = this.engine as GLEngine ;

    glEngine.addTexture(this);
    const pipelineContext = glEngine.getGLPipelineContext();

    this.pipelineContext = pipelineContext;
    const gl = pipelineContext.gl;
    const { target = gl.TEXTURE_2D, name } = this.source;

    this.textureBuffer = gl.createTexture();
    if (this.textureBuffer) {
      assignInspectorName(this.textureBuffer, name);
    }
    this.target = target;
    this.update(this.source);
    this.release();
    this.initialized = true;
  }

  clone (): GLTexture {
    const clonedTexture = new GLTexture(this.engine, this.source);

    clonedTexture.sourceFrom = this.sourceFrom;
    clonedTexture.sourceType = this.sourceType;
    clonedTexture.width = this.width;
    clonedTexture.height = this.height;

    return clonedTexture;
  }

  release () {
    const { sourceType } = this.source;

    switch (sourceType) {
      case TextureSourceType.image:
        // @ts-expect-error
        delete (this.source as Texture2DSourceOptionsImage).image;
        // @ts-expect-error
        delete (this.source as TextureCubeSourceOptionsImage).cube;

        break;
      case TextureSourceType.data:
        // @ts-expect-error
        delete (this.source as Texture2DSourceOptionsData).data;

        break;
      case TextureSourceType.compressed:
        // @ts-expect-error
        delete this.source.mipmaps;

        break;
      case TextureSourceType.mipmaps:
        // @ts-expect-error
        delete this.source.mipmaps;

        break;
    }
  }

  update (sourceOptions: TextureSourceOptions) {
    if (!this.pipelineContext || !this.textureBuffer) {
      this.width = 0;
      this.height = 0;

      return;
    }

    const target = this.target;
    const source = this.source;
    const gl = this.pipelineContext.gl;
    const { detail } = this.engine.gpuCapability;
    const { sourceType } = source;
    const { data } = source as Texture2DSourceOptionsData;
    const { cube } = source as TextureCubeSourceOptionsImage;
    const { image } = source as Texture2DSourceOptionsImage;
    const { video } = source as Texture2DSourceOptionsVideo;
    const { mipmaps } = source as Texture2DSourceOptionsImageMipmaps;
    const { mipmaps: cubeMipmaps } = source as TextureCubeSourceOptionsImageMipmaps;
    const { data: optionsData } = sourceOptions as Texture2DSourceOptionsFrameBuffer;
    const { cube: optionsCube } = sourceOptions as TextureCubeSourceOptionsImage;
    const { generateMipmap } = sourceOptions as Texture2DSourceOptionsImage;
    const { mipmaps: optionsMipmaps } = sourceOptions as Texture2DSourceOptionsCompressed;
    let { format, type, internalFormat } = source as Required<TextureSourceOptions>;
    let width = 0;
    let height = 0;

    // TODO 原GLState的textureUnitDict参数未处理。
    this.bind(sourceType === TextureSourceType.video);

    // 选择 type 和 format
    if (type === glContext.HALF_FLOAT) {
      type = detail.halfFloatTexture;
      if (!type) {
        console.error({
          content: 'half float texture is not support',
          type: LOG_TYPE,
        });
      }
      if (isWebGL2(gl) && internalFormat === format) {
        if (format === glContext.LUMINANCE) {
          format = glContext.RED;
        }
        internalFormat = FORMAT_HALF_FLOAT[format];
      }
      if (!detail.halfFloatLinear) {
        source.minFilter = source.magFilter = gl.NEAREST;
        console.warn({
          content: 'half float linear not support,change to NEAREST',
          type: LOG_TYPE,
        });
      }
    } else if (type === gl.FLOAT) {
      type = detail.floatTexture;
      if (!type) {
        console.error({
          content: 'float texture is not support',
          type: LOG_TYPE,
        });
      }
      if (isWebGL2(gl) && internalFormat === format) {
        if (format === glContext.LUMINANCE) {
          format = glContext.RED;
        }
        internalFormat = FORMAT_FLOAT[format];
      }
      if (!detail.floatLinear) {
        source.minFilter = gl.NEAREST;
        source.magFilter = gl.NEAREST;
        console.warn({
          content: 'float linear not support,change to NEAREST',
          type: LOG_TYPE,
        });
      }
    }

    // 处理是否RGB透明度相乘和Y轴反转, 默认值都为false。
    if (source.premultiplyAlpha === undefined) {
      source.premultiplyAlpha = false;
    }
    // gl的状态可能在外面被改变了，这里必须重新设置
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, source.premultiplyAlpha);
    if (source.flipY === undefined) {
      source.flipY = false;
    }
    // gl的状态可能在外面被改变了，这里必须重新设置
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, source.flipY);

    // 根据不同的 TextureSourceType 传输对应贴图数据到GPU。
    if (sourceType === TextureSourceType.framebuffer) {
      if (optionsData) {
        width = optionsData.width ?? 0;
        height = optionsData.height ?? 0;
        if (width && height && (this.width !== width || this.height !== height)) {
          gl.texImage2D(target, 0, internalFormat, width, height, 0, format, type, null);
        }
      } else {
        // FIXME: warning有点多先注释掉，没有大小的update需要排查一下
        // console.warn('No image size for setup framebuffer texture');
      }
    } else if (sourceType === TextureSourceType.data) {
      if (target === gl.TEXTURE_CUBE_MAP) {
        optionsCube.forEach((data, key) => {
          const [x, y] = this.texImage2DData(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X + key, 0, internalFormat, format, type, data as TextureDataType);

          width = Math.max(x, width);
          height = Math.max(y, height);
        });
      } else {
        [width, height] = this.texImage2DData(gl, target, 0, internalFormat, format, type, data);
      }
    } else if (sourceType === TextureSourceType.image || sourceType === TextureSourceType.video) {
      if (target === gl.TEXTURE_CUBE_MAP) {
        cube.forEach((image, key) => {
          const [x, y] = this.texImage2D(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X + key, 0, internalFormat, format, type, image as HTMLImageElement);

          width = Math.max(x, width);
          height = Math.max(y, height);
        });
      } else if (target === gl.TEXTURE_2D) {
        const imageData = image ?? video;

        [width, height] = this.texImage2D(gl, target, 0, internalFormat, format, type, imageData);
      }
      if (generateMipmap) {
        if ((isPowerOfTwo(width) && isPowerOfTwo(height)) || isWebGL2(gl)) {
          gl.generateMipmap(target);
        }
      }
    } else if (sourceType === TextureSourceType.mipmaps) {
      let ret;

      if (target === gl.TEXTURE_2D) {
        mipmaps.forEach((mipmap, level) => {
          if ('data' in mipmap) {
            ret = this.texImage2DData(gl, target, level, internalFormat, format, type, mipmap);
          } else {
            ret = this.texImage2D(gl, target, level, internalFormat, format, type, mipmap);
          }
          if (level === 0) {
            [width, height] = ret;
          }
        });
      } else if (target === gl.TEXTURE_CUBE_MAP) {
        cubeMipmaps.forEach((mipmap, level) => {
          mipmap.forEach((face, key) => {
            if ('data' in face) {
              ret = this.texImage2DData(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X + key, level, internalFormat, format, type, face);
            } else {
              ret = this.texImage2D(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X + key, level, internalFormat, format, type, face);
            }
            if (level === 0) {
              [width, height] = ret;
            }
          });
        });
      }
    } else if (sourceType === TextureSourceType.compressed) {
      if (optionsMipmaps) {
        width = optionsMipmaps[0].width;
        height = optionsMipmaps[0].height;
        optionsMipmaps.forEach((mipmap, idx) => {
          gl.compressedTexImage2D(
            target,
            idx,
            internalFormat,
            mipmap.width,
            mipmap.height,
            0,
            mipmap.data);
        });
      }
    }
    this.width = width;
    this.height = height;
    this.setTextureFilters(gl, target, source);
  }

  setTextureFilters (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    target: GLenum,
    options: TextureConfigOptions,
  ) {
    const { anisotropic = 4, wrapS = gl.CLAMP_TO_EDGE, wrapT = gl.CLAMP_TO_EDGE } = options;
    const gpuCapability = this.engine.gpuCapability;

    if (this.target === gl.TEXTURE_2D) {
      gpuCapability.setTextureAnisotropic(gl, this.target, anisotropic);
    }
    const isPot = isWebGL2(gl) || (isPowerOfTwo(this.width) && isPowerOfTwo(this.height));
    const minFiler = options.minFilter ? options.minFilter : gl.NEAREST;
    const magFilter = options.magFilter ? options.magFilter : gl.NEAREST;

    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, minFiler);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, isPot ? wrapS : gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, isPot ? wrapT : gl.CLAMP_TO_EDGE);
  }

  private texImage2D (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    target: GLenum,
    level: number,
    internalformat: GLenum,
    format: GLenum,
    type: GLenum,
    image: HTMLImageLike,
  ): spec.vec2 {
    const { sourceType, minFilter, magFilter, flipY, wrapS, wrapT } = this.source;
    const maxSize = this.engine.gpuCapability.detail.maxTextureSize ?? 2048;
    let img = image;

    if (sourceType !== TextureSourceType.video) {
      let shouldResize = minFilter !== gl.NEAREST || magFilter !== gl.NEAREST || wrapS !== gl.CLAMP_TO_EDGE || wrapT !== gl.CLAMP_TO_EDGE;

      shouldResize = shouldResize || image.width > maxSize || image.height > maxSize;
      if (shouldResize) {
        // fix android webgl1 img lost error
        setTimeout(() => {
          img = this.resizeImage(image);
        });
      }
    }
    gl.texImage2D(target, level, internalformat, format, type, img);
    const size: spec.vec2 = [img.width, img.height];

    if (flipCanvas) {
      flipCanvas.width = flipCanvas.height = 1;
    }

    if (sourceType === TextureSourceType.video) {
      const { videoWidth, videoHeight } = image as HTMLVideoElement;

      return [videoWidth, videoHeight];
    }

    return size;
  }

  private texImage2DData (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    target: GLenum,
    level: number,
    internalformat: GLenum,
    format: GLenum,
    type: GLenum,
    data: TextureDataType,
  ): spec.vec2 {
    const { data: bufferView, width, height } = data;
    // Uint8ClampedArray is incompatible in android
    const neoBuffer = format === gl.UNSIGNED_BYTE ? new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength / bufferView.BYTES_PER_ELEMENT) : bufferView;

    gl.texImage2D(target, level, internalformat, width, height, 0, format, type, neoBuffer);

    return [width, height];
  }

  private resizeImage (image: HTMLImageLike, targetWidth?: number, targetHeight?: number): HTMLCanvasElement | HTMLImageElement {
    const { detail } = this.engine.gpuCapability;
    const maxSize = detail.maxTextureSize ?? 2048;

    const gl = this.pipelineContext.gl;

    if (isWebGL2(gl) && (image.width < maxSize && image.height < maxSize)) {
      return image as HTMLImageElement;
    }

    const canvas = resizeImageByCanvas(image, maxSize, targetWidth, targetHeight);

    if (canvas) { return canvas; }

    return image as HTMLImageElement;
  }

  override async reloadData (): Promise<void> {
    if (this.offloaded) {
      await getDefaultTextureFactory().reload(this);
    }
  }

  override offloadData () {
    if (!(this.initialized && getDefaultTextureFactory().canOffloadTexture(this.source.sourceFrom))) {
      return;
    }
    const target = this.target;
    const gl = this.pipelineContext.gl;

    if (gl && this.textureBuffer) {
      const data = new Uint8Array([255]);

      this.bind();
      if (target === gl.TEXTURE_2D) {
        gl.texImage2D(target, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
      } else if (target === gl.TEXTURE_CUBE_MAP) {
        const faces = [
          gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
          gl.TEXTURE_CUBE_MAP_POSITIVE_X,
          gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
          gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        ];

        for (let i = 0; i < faces.length; i++) {
          gl.texImage2D(faces[i], 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
        }
      }
      // rewrite mipmap
      gl.generateMipmap(target);
      this.width = 1;
      this.height = 1;
    }
    this.offloaded = true;
  }

  override async uploadCurrentVideoFrame () {
    if (
      this.source.sourceType === TextureSourceType.video &&
      this.source.video &&
      this.initialized
    ) {
      const video = this.source.video;

      if (video.paused) {
        await video.play();
      }
      this.update({ video: this.source.video });

      return true;
    }

    return false;
  }

  updateSource (opts: TextureSourceOptions): void {
    // @ts-expect-error
    this.source = this.assembleOptions({ ...this.source, ...opts });
    this.sourceType = this.source.sourceType;
    this.sourceFrom = this.source.sourceFrom;
    this.update(this.source);
  }

  restore () {
    // TODO
  }

  dispose (): void {
    /**
     * 原先Player是允许多次调用dispose，并且不会报错
     * dispose之后assignRenderer会报错
     */
    if (this.pipelineContext && this.textureBuffer) {
      this.pipelineContext.gl.deleteTexture(this.textureBuffer);
    }
    if (
      this.source.sourceType === TextureSourceType.video &&
      this.source.video &&
      this.initialized
    ) {
      this.source.video.pause();
      this.source.video.src = '';
      this.source.video.load();
    }
    this.width = 0;
    this.height = 0;
    this.textureBuffer = null;
    this.destroyed = true;
    this.update = () => {
      console.error({
        content: 'this this texture has been destroyed',
        type: LOG_TYPE,
      });
    };
    this.initialize = throwDestroyedError as unknown as () => void;

    if (this.engine !== undefined) {
      this.engine.removeTexture(this);
    }
  }
}

function resizeImageByCanvas (
  image: HTMLImageLike,
  maxSize: number,
  targetWidth?: number,
  targetHeight?: number,
): HTMLCanvasElement | undefined {
  const { width, height } = image;
  const nw = Math.min(maxSize, targetWidth || nearestPowerOfTwo(width));
  const nh = Math.min(maxSize, targetHeight || nearestPowerOfTwo(height));

  if (nh !== height || nw !== width) {
    const canvas = canvasPool.getCanvas();
    const ctx = canvas.getContext('2d');

    canvas.width = nw;
    canvas.height = nh;
    ctx?.drawImage(image, 0, 0, width, height, 0, 0, nw, nh);
    console.warn({
      content: `image resize from ${width}x${height} to ${nw}x${nh}`,
      type: LOG_TYPE,
    });

    return canvas;
  }
}

function isPowerOfTwo (value: number) {
  return (value & (value - 1)) === 0 && value !== 0;
}
