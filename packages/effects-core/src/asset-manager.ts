import * as spec from '@galacean/effects-specification';
import { getStandardJSON } from './fallback';
import { glContext } from './gl';
import { passRenderLevel } from './pass-render-level';
import type { PrecompileOptions } from './plugin-system';
import { PluginSystem } from './plugin-system';
import type { JSONValue } from './downloader';
import { Downloader, loadWebPOptional, loadImage, loadVideo, loadMedia, loadAVIFOptional } from './downloader';
import type { ImageSource, Scene, SceneLoadOptions, SceneRenderLevel, SceneType } from './scene';
import { isSceneJSON } from './scene';
import type { Disposable } from './utils';
import { isObject, isString, logger, isValidFontFamily, isCanvas, base64ToFile } from './utils';
import type { TextureSourceOptions } from './texture';
import { deserializeMipmapTexture, TextureSourceType, getKTXTextureOptions, Texture } from './texture';
import type { Renderer } from './render';
import { COMPRESSED_TEXTURE } from './render';
import { combineImageTemplate, getBackgroundImage } from './template-image';
import { ImageAsset } from './image-asset';
import type { Engine } from './engine';

let seed = 1;

/**
 * 资源管理器
 * 用于加载和动效中所有的资源文件，包括图片、插件、图层粒子数据等
 */
export class AssetManager implements Disposable {
  /**
   * 相对url的基本路径
   */
  private baseUrl: string;
  /**
   * 图像资源，用于创建和释放GPU纹理资源
   */
  private assets: Record<string, any> = {};

  /**
   * 自定义文本缓存，随页面销毁而销毁
   */
  static fonts: Set<string> = new Set();

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
   * 构造函数
   * @param options - 场景加载参数
   * @param downloader - 资源下载对象
   */
  constructor (
    private options: SceneLoadOptions = {},
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
   * 根据用户传入的参数修改场景数据
   */
  private updateSceneData (items: spec.VFXItemData[]): void {
    const variables = this.options.variables;

    if (!variables || Object.keys(variables).length === 0) {
      return;
    }

    items.forEach(item => {
      if (item.type === spec.ItemType.text) {
        const textVariable = variables[item.name] as string;

        if (textVariable) {
          item.content.options.text = textVariable;
        }
      }
    });
  }

  /**
   * 场景创建，通过 json 创建出场景对象，并进行提前编译等工作
   * @param url - json 的 URL 链接或者 json 对象
   * @param renderer - renderer 对象，用于获取管理、编译 shader 及 GPU 上下文的参数
   * @param options - 扩展参数
   * @returns
   */
  async loadScene (
    url: SceneType,
    renderer?: Renderer,
    options?: { env: string },
  ): Promise<Scene> {
    let rawJSON: SceneType | JSONValue;
    const assetUrl = isString(url) ? url : this.id;
    const startTime = performance.now();
    const timeInfoMessages: string[] = [];
    const gpuInstance = renderer?.engine.gpuCapability;
    const asyncShaderCompile = gpuInstance?.detail?.asyncShaderCompile ?? false;
    const compressedTexture = gpuInstance?.detail.compressedTexture ?? COMPRESSED_TEXTURE.NONE;
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

      // url 为 JSONValue 或 Scene 对象
      if (isObject(url)) {
        // TODO: 原 JSONLoader contructor 判断是否兼容
        rawJSON = url;
        this.baseUrl = location.href;
      } else {
        // 兼容相对路径
        url = new URL(url as string, location.href).href;
        this.baseUrl = url;
        rawJSON = await hookTimeInfo('loadJSON', () => this.loadJSON(url as string));
      }

      if (isSceneJSON(rawJSON)) {
        // 已经加载过的 可能需要更新数据模板
        scene = {
          ...rawJSON,
        };

        if (
          this.options &&
          this.options.variables &&
          Object.keys(this.options.variables).length !== 0
        ) {
          const { images: rawImages } = rawJSON.jsonScene;
          const images = scene.images;

          for (let i = 0; i < rawImages.length; i++) {
            // 仅重新加载数据模板对应的图片
            if (images[i] instanceof HTMLCanvasElement) {
              images[i] = rawImages[i];
            }
          }
          scene.images = await hookTimeInfo('processImages', () => this.processImages(images, compressedTexture));
          // 更新 TextureOptions 中的 image 指向
          for (let i = 0; i < scene.images.length; i++) {
            scene.textureOptions[i].image = scene.images[i];
          }

          this.updateSceneData(scene.jsonScene.items);
        }
      } else {
        // TODO: JSONScene 中 bins 的类型可能为 ArrayBuffer[]
        const { usedImages, jsonScene, pluginSystem } = await hookTimeInfo('processJSON', () => this.processJSON(rawJSON as JSONValue));
        const { bins = [], images, compositions, fonts } = jsonScene;

        const [loadedBins, loadedImages] = await Promise.all([
          hookTimeInfo('processBins', () => this.processBins(bins)),
          hookTimeInfo('processImages', () => this.processImages(images, compressedTexture)),
          hookTimeInfo(`${asyncShaderCompile ? 'async' : 'sync'}Compile`, () => this.precompile(compositions, pluginSystem, renderer, options)),
        ]);

        if (renderer) {
          for (let i = 0; i < images.length; i++) {
            const imageAsset = new ImageAsset(renderer.engine);

            imageAsset.data = loadedImages[i];
            imageAsset.setInstanceId(images[i].id);
            renderer.engine.addInstance(imageAsset);
          }
        }

        await hookTimeInfo('processFontURL', () => this.processFontURL(fonts as spec.FontDefine[]));
        const loadedTextures = await hookTimeInfo('processTextures', () => this.processTextures(loadedImages, loadedBins, jsonScene, renderer!.engine));

        this.updateSceneData(jsonScene.items);

        scene = {
          timeInfos,
          url: url,
          renderLevel: this.options.renderLevel,
          storage: {},
          pluginSystem,
          jsonScene,
          usedImages,
          images: loadedImages,
          textureOptions: loadedTextures,
          bins: loadedBins,
        };

        // 触发插件系统 pluginSystem 的回调 prepareResource
        await hookTimeInfo('processPlugins', () => pluginSystem.loadResources(scene, this.options));
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

  private async precompile (
    compositions: spec.CompositionData[],
    pluginSystem?: PluginSystem,
    renderer?: Renderer,
    options?: PrecompileOptions,
  ) {
    if (!renderer || !renderer.getShaderLibrary()) {
      return;
    }
    const shaderLibrary = renderer?.getShaderLibrary();

    await pluginSystem?.precompile(compositions, renderer, options);

    await new Promise(resolve => {
      shaderLibrary?.compileAllShaders(() => {
        resolve(null);
      });
    });
  }

  private async processJSON (json: JSONValue) {
    const jsonScene = getStandardJSON(json);
    const { plugins = [], compositions: sceneCompositions, imgUsage, images } = jsonScene;
    const pluginSystem = new PluginSystem(plugins);

    await pluginSystem.processRawJSON(jsonScene, this.options);

    const { renderLevel } = this.options;
    const usedImages: Record<number, boolean> = {};

    if (imgUsage) {
      // TODO: 考虑放到独立的 fix 文件
      fixOldImageUsage(usedImages, sceneCompositions, imgUsage, images, renderLevel);
    } else {
      images?.forEach((_, i) => {
        usedImages[i] = true;
      });
    }

    return {
      usedImages,
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
    // 对老数据的兼容
    if (!fonts) {
      return;
    }

    const jobs = fonts.map(async font => {
      // 数据模版兼容判断
      if (font.fontURL && !AssetManager.fonts.has(font.fontFamily)) {
        if (!isValidFontFamily(font.fontFamily)) {
          // 在所有设备上提醒开发者
          console.warn(`Risky font family: ${font.fontFamily}.`);
        }
        try {
          const url = new URL(font.fontURL, this.baseUrl).href;
          const fontFace = new FontFace(font.fontFamily ?? '', 'url(' + url + ')');

          await fontFace.load();
          //@ts-expect-error
          document.fonts.add(fontFace);
          AssetManager.fonts.add(font.fontFamily);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          logger.warn(`Invalid font family or font source: ${JSON.stringify(font.fontURL)}.`);
        }
      }
    });

    return Promise.all(jobs);
  }

  private async processImages (
    images: any,
    compressedTexture: COMPRESSED_TEXTURE = 0,
  ): Promise<ImageSource[]> {
    const { useCompressedTexture, variables } = this.options;
    const baseUrl = this.baseUrl;
    const jobs = images.map(async (img: spec.Image, idx: number) => {
      const { url: png, webp, avif } = img;
      // eslint-disable-next-line compat/compat
      const imageURL = new URL(png, baseUrl).href;
      // eslint-disable-next-line compat/compat
      const webpURL = webp && new URL(webp, baseUrl).href;
      // eslint-disable-next-line compat/compat
      const avifURL = avif && new URL(avif, baseUrl).href;

      if ('template' in img) {
        // 1. 数据模板
        const template = img.template as spec.TemplateContent;
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
              return resultImage;
            } else {
              // 如果是加载图片且是数组，设置变量，视频情况下不需要
              if (background && Array.isArray(url) && variables) {
                variables[background.name] = resultImage.src;
              }

              return await combineImageTemplate(
                resultImage,
                template,
                variables,
              );
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            throw new Error(`Failed to load. Check the template or if the URL is ${isVideo ? 'video' : 'image'} type, URL: ${url}, Error: ${(e as any).message}.`);
          }
        }
      } else if ('compressed' in img && useCompressedTexture && compressedTexture) {
        // 2. 压缩纹理
        const { compressed } = img as spec.CompressedImage;
        let src;

        if (compressedTexture === COMPRESSED_TEXTURE.ASTC) {
          src = compressed.astc;
        } else if (compressedTexture === COMPRESSED_TEXTURE.PVRTC) {
          src = compressed.pvrtc;
        }
        if (src) {
          const bufferURL = new URL(src, baseUrl).href;

          this.assets[idx] = { url: bufferURL, type: TextureSourceType.compressed };

          return this.loadBins(bufferURL);
        }
      } else if ('sourceType' in img) {
        // TODO: 确定是否有用
        return img;
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

      this.assets[idx] = { url, type: TextureSourceType.image };

      return image;
    });

    return Promise.all(jobs);
  }

  private async processTextures (
    images: any,
    bins: ArrayBuffer[],
    jsonScene: spec.JSONScene,
    engine: Engine
  ) {
    const textures = jsonScene.textures ?? images.map((img: never, source: number) => ({ source })) as spec.SerializedTextureSource[];
    const jobs = textures.map(async (texOpts, idx) => {
      if (texOpts instanceof Texture) {
        return texOpts;
      }
      if ('mipmaps' in texOpts) {
        try {
          return await deserializeMipmapTexture(texOpts, bins, engine, jsonScene.bins);
        } catch (e) {
          throw new Error(`Load texture ${idx} fails, error message: ${e}.`);
        }
      }
      const { source } = texOpts;

      let image: any;

      if (isObject(source)) { // source 为 images 数组 id
        //@ts-expect-error
        image = engine.assetLoader.loadGUID<ImageAsset>(source.id).data;
      } else if (typeof source === 'string') { // source 为 base64 数据
        image = await loadImage(base64ToFile(source));
      }

      if (image) {
        const tex = createTextureOptionsBySource(image, this.assets[idx]);

        tex.id = texOpts.id;
        tex.dataType = spec.DataType.Texture;

        return tex.sourceType === TextureSourceType.compressed ? tex : { ...tex, ...texOpts };
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
    for (const key in this.assets) {
      const asset = this.assets[key];

      asset?.dispose?.();
    }
    this.assets = {};
    this.timers = [];
  }
}

function fixOldImageUsage (
  usedImages: Record<number, boolean>,
  compositions: spec.CompositionData[],
  imgUsage: Record<string, number[]>,
  images: any,
  renderLevel?: SceneRenderLevel,
) {
  for (let i = 0; i < compositions.length; i++) {
    const id = compositions[i].id;
    const ids = imgUsage[id];

    if (ids) {
      for (let j = 0; j < ids.length; j++) {
        const id = ids[j];
        const tag = images[id].renderLevel;

        if (passRenderLevel(tag, renderLevel)) {
          usedImages[id] = true;
        }
      }
    }
  }
}

function createTextureOptionsBySource (image: any, sourceFrom: TextureSourceOptions): Record<string, any> {
  if (image instanceof Texture) {
    return image.source;
  } else if (
    image instanceof HTMLImageElement ||
    isCanvas(image)
  ) {
    return {
      image,
      sourceType: TextureSourceType.image,
      sourceFrom,
      keepImageSource: true,
      minFilter: glContext.LINEAR,
      magFilter: glContext.LINEAR,
    };
  } else if (image instanceof HTMLVideoElement) {
    // 视频
    return {
      sourceType: TextureSourceType.video,
      video: image,
      minFilter: glContext.LINEAR,
      magFilter: glContext.LINEAR,
    };
  } else if (image instanceof ArrayBuffer) {
    // 压缩纹理
    return {
      ...getKTXTextureOptions(image),
      sourceFrom,
    };
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
    };
  }

  throw new Error('Invalid texture options.');
}
