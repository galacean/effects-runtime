import * as spec from '@galacean/effects-specification';
import { getStandardJSON } from './fallback';
import { glContext } from './gl';
import { passRenderLevel } from './pass-render-level';
import { PluginSystem } from './plugin-system';
import type { JSONValue } from './downloader';
import { Downloader, loadWebPOptional, loadImage, loadVideo, loadMedia, loadAVIFOptional } from './downloader';
import type { ImageLike, SceneLoadOptions } from './scene';
import { Scene } from './scene';
import type { Disposable } from './utils';
import { isObject, isString, logger, isValidFontFamily, isCanvas, base64ToFile } from './utils';
import type { TextureSourceOptions, Texture2DSourceOptionsCompressed } from './texture';
import { deserializeMipmapTexture, TextureSourceType, Texture } from './texture';
import type { Renderer } from './render';
import { combineImageTemplate, getBackgroundImage } from './template-image';
import { textureLoaderRegistry } from './texture/texture-loader';

let seed = 1;

/**
 * 资源管理器
 * 用于加载和动效中所有的资源文件，包括图片、插件、图层粒子数据等
 */
export class AssetManager implements Disposable {
  /**
   * 相对 url 的基本路径
   */
  private baseUrl: string;
  /**
   * 图像资源，用于创建和释放 GPU 纹理资源
   */
  private assets: Record<string, ImageLike> = {};
  /**
   * TextureSource 来源
   */
  private sourceFrom: Record<string, { url: string, type: TextureSourceType }> = {};
  /**
   * 自定义文本缓存，随页面销毁而销毁
   */
  private static fontCache: Set<string> = new Set();

  private id = seed++;
  /**
   * 加载超时时间
   * @default 10
   */
  private timeout: number;
  /**
   * 场景加载的超时定时器
   */
  private timers: number[] = [];

  /**
   * 字体加载方法
   * @param fonts - 字体定义数组
   * @param [baseUrl=location.href] - URL 的 base 字段
   * @returns
   */
  static async loadFontFamily (
    fonts: spec.FontDefine[],
    baseUrl = location.href,
  ) {
    // 对老数据的兼容
    if (!fonts) {
      return;
    }

    const jobs = fonts.map(async font => {
      // 数据模版兼容判断
      if (font.fontURL && !AssetManager.fontCache.has(font.fontFamily)) {
        if (!isValidFontFamily(font.fontFamily)) {
          // 在所有设备上提醒开发者
          console.warn(`Risky font family: ${font.fontFamily}.`);
        }
        try {
          const url = new URL(font.fontURL, baseUrl).href;
          const fontFace = new FontFace(font.fontFamily ?? '', 'url(' + url + ')');

          await fontFace.load();
          document.fonts.add(fontFace);
          AssetManager.fontCache.add(font.fontFamily);
        } catch (_) {
          logger.warn(`Invalid font family or font source: ${JSON.stringify(font.fontURL)}.`);
        }
      }
    });

    return Promise.all(jobs);
  }

  /**
   * 构造函数
   * @param options - 场景加载参数
   * @param downloader - 资源下载对象
   */
  constructor (
    public options: SceneLoadOptions = {},
    private readonly downloader = new Downloader(),
  ) {
    this.updateOptions(options);
  }

  updateOptions (options: SceneLoadOptions = {}) {
    this.options = options;
    if (!options.pluginData) {
      options.pluginData = {};
    }
    const { timeout = 10 } = options;

    this.timeout = timeout;
  }

  /**
   * 场景创建，通过 json 创建出场景对象，并进行提前编译等工作
   * @param url - json 的 URL 链接或者 json 对象
   * @param renderer - renderer 对象，用于获取管理、编译 shader 及 GPU 上下文的参数
   * @param options - 扩展参数
   * @returns
   */
  async loadScene (
    url: Scene.LoadType,
    renderer?: Renderer,
    options?: { env?: string },
  ): Promise<Scene> {
    let rawJSON: Scene.LoadType;
    const assetUrl = isString(url) ? url : this.id;
    const startTime = performance.now();
    const timeInfoMessages: string[] = [];
    const gpuInstance = renderer?.engine.gpuCapability;
    const isKTX2Supported = gpuInstance?.detail.ktx2Support ?? false;
    const timeInfos: Record<string, number> = {};
    let loadTimer: number;
    let cancelLoading = false;

    const waitPromise = new Promise<Scene>((resolve, reject) => {
      loadTimer = window.setTimeout(() => {
        cancelLoading = true;
        this.removeTimer(loadTimer);
        const totalTime = performance.now() - startTime;

        reject(new Error(`Load time out: totalTime: ${totalTime.toFixed(4)}ms ${timeInfoMessages.join(' ')}, url: ${assetUrl}.`));
      }, this.timeout * 1000);
      this.timers.push(loadTimer);
    });

    const hookTimeInfo = async<T> (label: string, func: () => Promise<T>) => {
      if (!cancelLoading) {
        const st = performance.now();

        try {
          const result = await func();
          const time = performance.now() - st;

          timeInfoMessages.push(`[${label}: ${time.toFixed(2)}]`);
          timeInfos[label] = time;

          return result;
        } catch (e) {
          throw new Error(`Load error in ${label}, ${e}.`);
        }
      }
      throw new Error('Load canceled.');
    };
    const loadResourcePromise = async () => {
      let scene: Scene;

      if (isString(url)) {
        // 兼容相对路径
        const link = new URL(url, location.href).href;

        this.baseUrl = link;
        rawJSON = await hookTimeInfo('loadJSON', () => this.loadJSON(link) as unknown as Promise<spec.JSONScene>);

        // 小程序环境下，如果产物是相对路径，adapter 返回的是字符串，需要兼容
        if (isString(rawJSON)) {
          rawJSON = JSON.parse(rawJSON);
        }
      } else {
        // url 为 spec.JSONScene 或 Scene 对象
        rawJSON = url;
        this.baseUrl = location.href;
      }

      if (Scene.isJSONObject(rawJSON)) {
        scene = {
          ...rawJSON,
        };
      } else {
        // TODO: JSONScene 中 bins 的类型可能为 ArrayBuffer[]
        const { jsonScene, pluginSystem } = await hookTimeInfo('processJSON', () => this.processJSON(rawJSON as JSONValue));
        const { bins = [], images, fonts } = jsonScene;

        await hookTimeInfo('selectVideoCodec', () => this.processVideoURL(jsonScene));
        const [loadedBins, loadedImages] = await Promise.all([
          hookTimeInfo('processBins', () => this.processBins(bins)),
          hookTimeInfo('processImages', () => this.processImages(images, isKTX2Supported)),
          hookTimeInfo('plugin:processAssets', () => this.processPluginAssets(jsonScene, pluginSystem, options)),
          hookTimeInfo('processFontURL', () => this.processFontURL(fonts as spec.FontDefine[])),
        ]);
        const loadedTextures = await hookTimeInfo('processTextures', () => this.processTextures(loadedImages, loadedBins, jsonScene));

        scene = {
          timeInfos,
          url,
          renderLevel: this.options.renderLevel,
          storage: {},
          pluginSystem,
          jsonScene,
          bins: loadedBins,
          textureOptions: loadedTextures,
          textures: [],
          images: loadedImages,
          assets: this.assets,
        };

        // 触发插件系统 pluginSystem 的回调 prepareResource
        await hookTimeInfo('plugin:prepareResource', () => pluginSystem.loadResources(scene, this.options));
      }

      const totalTime = performance.now() - startTime;

      logger.info(`Load asset: totalTime: ${totalTime.toFixed(4)}ms ${timeInfoMessages.join(' ')}, url: ${assetUrl}.`);
      window.clearTimeout(loadTimer);
      this.removeTimer(loadTimer);
      scene.totalTime = totalTime;
      scene.startTime = startTime;
      // 各部分分段时长
      scene.timeInfos = timeInfos;

      return scene;
    };

    return Promise.race([waitPromise, loadResourcePromise()]);
  }

  getAssets () {
    return this.assets;
  }

  private async processJSON (json: JSONValue) {
    const jsonScene = getStandardJSON(json);
    const { plugins = [] } = jsonScene;
    const pluginSystem = new PluginSystem(plugins);

    await pluginSystem.processRawJSON(jsonScene, this.options);

    return {
      jsonScene,
      pluginSystem,
    };
  }

  private async processBins (bins: (spec.BinaryFile | ArrayBuffer)[]) {
    const { renderLevel } = this.options;
    const baseUrl = this.baseUrl;
    const jobs = bins.map(bin => {
      if (bin instanceof ArrayBuffer) {
        return bin;
      }
      if (passRenderLevel(bin.renderLevel, renderLevel)) {
        return this.loadBins(new URL(bin.url, baseUrl).href);
      }

      throw new Error(`Invalid bins source: ${JSON.stringify(bins)}.`);
    });

    return Promise.all(jobs);
  }

  private async processFontURL (fonts: spec.FontDefine[]) {
    return AssetManager.loadFontFamily(fonts, this.baseUrl);
  }

  private async processImages (
    images: spec.ImageSource[],
    canUseKTX2 = false,
  ): Promise<ImageLike[]> {
    const { useCompressedTexture, variables, disableWebP, disableAVIF } = this.options;
    const baseUrl = this.baseUrl;
    const jobs = images.map(async (img, idx: number) => {
      const { url: png, webp, avif } = img;
      const { ktx2 } = img as spec.CompressedImage;
      // eslint-disable-next-line compat/compat
      const imageURL = new URL(png, baseUrl).href;
      // eslint-disable-next-line compat/compat
      const webpURL = (!disableWebP && webp) ? new URL(webp, baseUrl).href : undefined;
      // eslint-disable-next-line compat/compat
      const avifURL = (!disableAVIF && avif) ? new URL(avif, baseUrl).href : undefined;
      // eslint-disable-next-line compat/compat
      const ktx2URL = (ktx2 && useCompressedTexture && canUseKTX2) ? new URL(ktx2, baseUrl).href : undefined;

      const id = img.id;

      if ('template' in img) {
        // 1. 数据模板
        const template = img.template;
        // 获取数据模板 background 参数
        const background = template.background;

        if (background) {
          const url = getBackgroundImage(template, variables);
          const isVideo = background.type === spec.BackgroundType.video;
          // 根据背景类型确定加载函数
          const loadFn = background && isVideo ? loadVideo : loadImage;

          // 处理加载资源
          try {
            const resultImage = await loadMedia(url as string | string[], loadFn);

            if (resultImage instanceof HTMLVideoElement) {
              this.sourceFrom[id] = { url: resultImage.src, type: TextureSourceType.video };

              return resultImage;
            } else {
              // 如果是加载图片且是数组，设置变量，视频情况下不需要
              if (background && Array.isArray(url) && variables) {
                variables[background.name] = resultImage.src;
              }

              this.sourceFrom[id] = { url: resultImage.src, type: TextureSourceType.image };

              return await combineImageTemplate(
                resultImage,
                template,
                variables,
              );
            }
          } catch (e) {
            throw new Error(`Failed to load. Check the template or if the URL is ${isVideo ? 'video' : 'image'} type, URL: ${url}, Error: ${(e as Error).message || e}.`);
          }
        }
      } else if ('ktx2' in img && ktx2URL) {
        // ktx2 压缩纹理
        this.sourceFrom[id] = { url: ktx2URL, type: TextureSourceType.compressed };

        return this.loadBins(ktx2URL);
      } else if (
        img instanceof HTMLImageElement ||
        img instanceof HTMLCanvasElement ||
        img instanceof HTMLVideoElement ||
        img instanceof Texture
      ) {
        return img;
      }

      const { url, image } = avifURL
        ? await loadAVIFOptional(imageURL, avifURL)
        : await loadWebPOptional(imageURL, webpURL);

      this.sourceFrom[id] = { url, type: TextureSourceType.image };

      return image;
    });
    const loadedImages = await Promise.all(jobs);

    this.assignImagesToAssets(images, loadedImages);

    return loadedImages;
  }

  private async processPluginAssets (
    jsonScene: spec.JSONScene,
    pluginSystem: PluginSystem,
    options?: SceneLoadOptions,
  ) {
    const pluginResult = await pluginSystem.processAssets(jsonScene, options);
    const { assets, loadedAssets } = pluginResult.reduce((acc, cur) => {
      acc.assets = acc.assets.concat(cur.assets);
      acc.loadedAssets = acc.loadedAssets.concat(cur.loadedAssets);

      return acc;
    }, { assets: [], loadedAssets: [] });

    for (let i = 0; i < assets.length; i++) {
      this.assets[assets[i].id] = loadedAssets[i] as ImageLike;
    }
  }

  private async processTextures (
    images: ImageLike[],
    bins: ArrayBuffer[],
    jsonScene: spec.JSONScene,
  ) {
    const textures = jsonScene.textures ?? images.map((img, source: number) => ({ source })) as spec.SerializedTextureSource[];
    const jobs = textures.map(async (textureOptions, idx) => {
      if (textureOptions instanceof Texture) {
        return textureOptions;
      }
      if ('mipmaps' in textureOptions) {
        try {
          return await deserializeMipmapTexture(textureOptions, bins, this.assets, jsonScene.bins);
        } catch (e) {
          throw new Error(`Load texture ${idx} fails, error message: ${e}.`);
        }
      }

      const { source, id } = textureOptions;
      let image: ImageLike | undefined;
      let imageId = '';

      if (isObject(source)) { // source 为 images 数组 id
        image = this.assets[source.id as string];
        imageId = source.id as string;
      } else if (typeof source === 'string') { // source 为 base64 数据
        image = await loadImage(base64ToFile(source));
      }

      if (image) {
        const texture = await createTextureOptionsBySource(image, this.sourceFrom[imageId], id);

        return texture.sourceType === TextureSourceType.compressed ? texture : { ...texture, ...textureOptions };
      }
      throw new Error(`Invalid texture source: ${source}.`);
    });

    return Promise.all(jobs);
  }

  private async processVideoURL (jsonScene: any): Promise<void> {
    if (!jsonScene?.videos || !Array.isArray(jsonScene.videos)) {return;}

    for (const video of jsonScene.videos) {
      const hevc = video.hevc as { url?: string, codec?: string } | undefined;

      if (!hevc?.url || !hevc?.codec) {return;}

      const codec = this.stringToHevcVideoCodec(hevc.codec);

      if (codec && this.canPlayHevcCodec(codec)) {
        video.url = hevc.url;
      }
    }
  }

  private stringToHevcVideoCodec (codecString: string): spec.HevcVideoCodec | undefined {
    // 传入的是完整的枚举值
    if (Object.values(spec.HevcVideoCodec).includes(codecString as spec.HevcVideoCodec)) {
      return codecString as spec.HevcVideoCodec;
    }
    // 传入的是枚举名称
    const enumKey = codecString as keyof typeof spec.HevcVideoCodec;

    if (enumKey in spec.HevcVideoCodec) {
      return spec.HevcVideoCodec[enumKey];
    }

    return undefined;
  }

  private canPlayHevcCodec (codecString: spec.HevcVideoCodec): boolean {
    const v = document.createElement('video');
    const contentType = `video/mp4; codecs="${codecString}"`;
    const result = v.canPlayType(contentType);

    return result === 'probably' || result === 'maybe';
  }

  private async loadJSON (url: string) {
    return new Promise<JSONValue>((resolve, reject) => {
      this.downloader.downloadJSON(
        url,
        resolve,
        (status, responseText) => {
          reject(`Couldn't load JSON ${JSON.stringify(url)}: status ${status}, ${responseText}`);
        });
    });
  }

  private async loadBins (url: string) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.downloader.downloadBinary(
        url,
        resolve,
        (status, responseText) => {
          reject(`Couldn't load bins ${JSON.stringify(url)}: status ${status}, ${responseText}`);
        });
    });
  }

  private assignImagesToAssets (images: spec.ImageSource[], loadedImages: ImageLike[]) {
    for (let i = 0; i < images.length; i++) {
      this.assets[images[i].id] = loadedImages[i];
    }
  }

  private removeTimer (id: number) {
    const index = this.timers.indexOf(id);

    if (index !== -1) {
      this.timers.splice(index, 1);
    }
  }
  /**
   * 销毁方法
   */
  dispose (): void {
    if (this.timers.length) {
      this.timers.map(id => window.clearTimeout(id));
    }
    this.assets = {};
    this.sourceFrom = {};
    this.timers = [];
  }
}

async function createTextureOptionsBySource (
  image: TextureSourceOptions | ImageLike,
  sourceFrom: { url: string, type: TextureSourceType },
  id?: string,
) {
  const options = {
    id,
    dataType: spec.DataType.Texture,
  };

  if (image instanceof Texture) {
    return {
      ...image.source,
      ...options,
    };
  } else if (
    image instanceof HTMLImageElement ||
    isCanvas(image as HTMLCanvasElement)
  ) {
    return {
      image,
      sourceType: TextureSourceType.image,
      sourceFrom,
      keepImageSource: true,
      minFilter: glContext.LINEAR,
      magFilter: glContext.LINEAR,
      ...options,
    };
  } else if (image instanceof HTMLVideoElement) {
    // 视频
    return {
      sourceType: TextureSourceType.video,
      video: image,
      minFilter: glContext.LINEAR,
      magFilter: glContext.LINEAR,
      ...options,
    };
  } else if (image instanceof ArrayBuffer) {
    // 压缩纹理
    const loader = textureLoaderRegistry.getLoader('ktx2');

    if (loader) {
      try {
        const textureData = await loader.loadFromBuffer(image) as Texture2DSourceOptionsCompressed;

        return {
          sourceType: textureData.sourceType,
          type: textureData.type,
          target: textureData.target,
          internalFormat: textureData.internalFormat,
          format: textureData.format,
          mipmaps: textureData.mipmaps,
          minFilter: glContext.LINEAR,
          magFilter: glContext.LINEAR,
          sourceFrom,
          ...options,
        };
      } catch (e) {
        throw new Error(`Failed to parse KTX2 from ${sourceFrom?.url ?? 'buffer'}: ${(e as Error).message || e}`);
      }
    } else {
      throw new Error('KTX2 loader not found. Please register it first.');
    }
  } else if (
    'width' in image &&
    'height' in image &&
    'data' in image
  ) {
    return {
      sourceType: TextureSourceType.data,
      data: image,
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
      minFilter: glContext.NEAREST,
      magFilter: glContext.NEAREST,
      ...options,
    };
  }

  throw new Error('Invalid texture options.');
}
