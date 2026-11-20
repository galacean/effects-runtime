import * as spec from '@galacean/effects-specification';
import { getStandardJSON } from './fallback';
import { glContext } from './gl';
import { passRenderLevel } from './pass-render-level';
import { PluginSystem, getPluginUsageInfo, pluginLoaderMap } from './plugin-system';
import type { JSONValue } from './downloader';
import { Downloader, loadWebPOptional, loadImage, loadVideo, loadMedia, loadAVIFOptional } from './downloader';
import type { ImageLike, SceneLoadOptions } from './scene';
import { Scene } from './scene';
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
export class AssetManager {
  /**
   * 相对 url 的基本路径
   */
  private baseUrl: string;
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

  static async loadScene (jsonScene: spec.JSONScene | string, options?: SceneLoadOptions): Promise<Scene> {
    const assetManager = new AssetManager(options);

    return assetManager.loadScene(jsonScene);
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
    this.options = {
      ...options,
      useCompressedTexture: options.useCompressedTexture ?? true,
      useHevcVideo: options.useHevcVideo ?? true,
    };
    if (!this.options.pluginData) {
      this.options.pluginData = {};
    }
    const { timeout = 10 } = this.options;

    this.timeout = timeout;
  }

  /**
   * 场景创建，通过 json 创建出场景对象，并进行提前编译等工作
   * @param url - json 的 URL 链接或者 json 对象
   * @param renderer - 可选的 renderer 对象，用于判断压缩纹理支持情况
   * @returns 准备好的场景数据
   */
  async loadScene (url: Scene.LoadType, renderer?: Renderer): Promise<Scene> {
    let rawJSON: Scene.LoadType;
    const options = { ...this.options };
    const assetUrl = isString(url) ? url : this.id;
    const startTime = performance.now();
    const timeInfoMessages: string[] = [];
    const gpuInstance = renderer?.engine.displayServer.renderingDevice.gpuCapability;
    const isKTX2Supported = gpuInstance?.detail.ktx2Support ?? false;
    const timeInfos: Record<string, number> = {};
    let loadTimer: number;
    let cancelLoading = false;

    const waitPromise = new Promise<Scene>((resolve, reject) => {
      loadTimer = window.setTimeout(() => {
        cancelLoading = true;
        const totalTime = performance.now() - startTime;

        reject(new Error(`Load time out: totalTime: ${totalTime.toFixed(4)}ms ${timeInfoMessages.join(' ')}, url: ${assetUrl}.`));
      }, this.timeout * 1000);
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
      let sourceUrl = '';

      if (isString(url)) {
        // 兼容相对路径
        const link = new URL(url, location.href).href;

        sourceUrl = url;
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

      if (rawJSON instanceof Scene) {
        scene = rawJSON;
        scene.options = options;
      } else {
        // TODO: JSONScene 中 bins 的类型可能为 ArrayBuffer[]
        const { jsonScene } = await hookTimeInfo('processJSON', () => this.processJSON(rawJSON as JSONValue));

        scene = new Scene(jsonScene, options);
        scene.timeInfos = timeInfos;
        scene.url = sourceUrl;

        await hookTimeInfo('plugin:onAssetsLoadStart', () => PluginSystem.notifyAssetsLoadStart(scene, options));

        const { bins = [], images, fonts } = jsonScene;

        const [loadedBins, loadedImages] = await Promise.all([
          hookTimeInfo('processBins', () => this.processBins(bins, options)),
          hookTimeInfo('processImages', () => this.processImages(images, options, isKTX2Supported)),
          hookTimeInfo('processFontURL', () => this.processFontURL(fonts as spec.FontDefine[])),
        ]);

        scene.bins.push(...loadedBins);
        scene.images.push(...loadedImages);
        const loadedTextures = await hookTimeInfo('processTextures', () => this.processTextures(scene));

        scene.textureOptions.push(...loadedTextures);

        // 加载结束钩子需要看到降级插件计算出的渲染等级。
        scene.renderLevel = options.renderLevel;

        await hookTimeInfo('plugin:onAssetsLoadFinish', async () => {
          PluginSystem.notifyAssetsLoadFinish(scene, options);
        });
      }

      scene.prepare();

      const totalTime = performance.now() - startTime;

      logger.info(`Load asset: totalTime: ${totalTime.toFixed(4)}ms ${timeInfoMessages.join(' ')}, url: ${assetUrl}.`);
      window.clearTimeout(loadTimer);
      scene.totalTime = totalTime;
      scene.startTime = startTime;
      // 各部分分段时长
      scene.timeInfos = timeInfos;

      return scene;
    };

    return Promise.race([waitPromise, loadResourcePromise()]);
  }

  private async processJSON (json: JSONValue) {
    const jsonScene = getStandardJSON(json);
    const { plugins = [] } = jsonScene;

    for (const customPluginName of plugins) {
      if (!pluginLoaderMap[customPluginName]) {
        throw new Error(`The plugin '${customPluginName}' not found.` + getPluginUsageInfo(customPluginName));
      }
    }

    return {
      jsonScene,
    };
  }

  private async processBins (bins: (spec.BinaryFile | ArrayBuffer)[], options: SceneLoadOptions) {
    const { renderLevel } = options;
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
    options: SceneLoadOptions,
    canUseKTX2 = false,
  ): Promise<ImageLike[]> {
    const { useCompressedTexture, variables, disableWebP, disableAVIF } = options;
    const isKTX2PluginRegistered = !!pluginLoaderMap.ktx2;
    const canUseCompressedTexture = useCompressedTexture && canUseKTX2 && isKTX2PluginRegistered;
    const baseUrl = this.baseUrl;

    if (
      useCompressedTexture &&
      canUseKTX2 &&
      !isKTX2PluginRegistered &&
      images.some(img => 'ktx2' in img && img.ktx2)
    ) {
      logger.warn('The plugin \'ktx2\' is not found, unable to use compressed textures.' + getPluginUsageInfo('ktx2'));
    }

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
      const ktx2URL = (ktx2 && canUseCompressedTexture) ? new URL(ktx2, baseUrl).href : undefined;

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

    return Promise.all(jobs);
  }

  private async processTextures (scene: Scene) {
    const { bins, images, videos, jsonScene } = scene;
    const { images: imageDefinitions, videos: videoDefinitions = [], textures = [] } = jsonScene;
    const imageSources: Record<string, ImageLike> = Object.create(null);

    for (let i = 0; i < videos.length; i++) {
      imageSources[videoDefinitions[i].id] = videos[i];
    }
    for (let i = 0; i < images.length; i++) {
      imageSources[imageDefinitions[i].id] = images[i];
    }
    const jobs = textures.map(async (textureOptions, idx) => {
      if (textureOptions instanceof Texture) {
        return textureOptions;
      }
      if ('mipmaps' in textureOptions) {
        try {
          return await deserializeMipmapTexture(textureOptions, bins, imageSources, jsonScene.bins);
        } catch (e) {
          throw new Error(`Load texture ${idx} fails, error message: ${e}.`);
        }
      }

      const { source, id } = textureOptions;
      let image: ImageLike | undefined;
      let imageId = '';

      if (isObject(source)) {
        imageId = source.id as string;
        image = imageSources[imageId];
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

        logger.info('Loading KTX2 texture.');

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
