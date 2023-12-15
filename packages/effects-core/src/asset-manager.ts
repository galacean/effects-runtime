import type * as spec from '@galacean/effects-specification';
import { getStandardJSON } from '@galacean/effects-specification/dist/fallback';
import { LOG_TYPE } from './config';
import { glContext } from './gl';
import type { PrecompileOptions } from './plugin-system';
import { PluginSystem } from './plugin-system';
import type { JSONValue } from './downloader';
import { Downloader, loadWebPOptional, loadImage, loadVideo } from './downloader';
import { passRenderLevel } from './pass-render-level';
import type { Disposable } from './utils';
import { isObject, isString } from './utils';
import type { ImageSource, Scene } from './scene';
import type { TextureSourceOptions } from './texture';
import { deserializeMipmapTexture, TextureSourceType, getKTXTextureOptions, Texture } from './texture';
import type { Renderer } from './render';
import { COMPRESSED_TEXTURE } from './render';
import { combineImageTemplate, getBackgroundImage } from './template-image';

/**
 * 场景加载参数
 */
export interface SceneLoadOptions {
  /**
   * 动态数据的参数
   * key 是 JSON 中配置的字段名
   * value 是要使用的值，图片使用 url 链接
   * 图片链接可以使用数组传递，如果第一个加载失败，将尝试使用第二个地址
   *
   * @example
   * ``` ts
   * {
   *   variables: {
   *     bg: ['url','fallback_url'], // 如果两个图片都失败，将会触发加载失败
   *     fg: 'url' // 如果图片加载失败，将会触发加载失败,
   *     amount: 88.8,
   *     name: 'abc'
   *   }
   * }
   * ```
   */
  variables?: Record<string, number | string | string[]>,

  /**
   * 模板图片缩放倍数
   * @default 1 如果图片比较糊，可以用 2（但会增大图片内存）
   */
  templateScale?: number,

  /**
   * 是否使用压缩纹理
   */
  useCompressedTexture?: boolean,

  /**
   * 渲染分级。
   * 分级之后，只会加载当前渲染等级的资源。
   * 当渲染等级被设置为 B 后，player 的 fps 会降到 30 帧
   * @default 's'
   */
  renderLevel?: spec.RenderLevel,

  /**
   * 资源加载超时，时间单位秒
   * @default 10s
   */
  timeout?: number,

  /***
   * 用于给 plugin 的加载数据
   * key/value 的内容由 plugin 自己实现
   */
  pluginData?: Record<string, any>,

  /**
   * 场景加载时的环境（加载后把 env 结果写入 scene）
   * @default '' - 编辑器中为 'editor'
   */
  env?: string,

  /**
   * 加载后是否自动播放
   * @default true
   */
  autoplay?: boolean,
  /**
   * 合成播放完成后是否需要再使用，是的话生命周期结束后不会 `dispose`
   * @default false
   */
  reusable?: boolean,
  /**
   * 播放速度，当速度为负数时，合成倒播
   */
  speed?: number,
}

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
   * 插件系统
   */
  private pluginSystem: PluginSystem;
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
   * 场景创建
   * 通过 json 创建出场景对象，并进行提前编译等工作
   * @param url - json 的 URL 链接或者 json 对象
   * @param renderer - renderer 对象，用于获取管理、编译 shader 及 GPU 上下文的参数
   * @param options - 扩展参数
   * @returns
   */
  async loadScene (url: string | JSONValue, renderer?: Renderer, options?: { env: string }): Promise<Scene> {
    let rawJSON: JSONValue;
    const timeLabel = `Load asset: ${isString(url) ? url : this.id}`;
    const startTime = performance.now();
    const timeInfos: string[] = [];
    const gpuInstance = renderer?.engine.gpuCapability;
    const asyncShaderCompile = gpuInstance?.detail?.asyncShaderCompile ?? false;
    let loadTimer: number;
    let cancelLoading = false;
    const waitPromise = new Promise<Scene>((resolve, reject) =>
      loadTimer = window.setTimeout(() => {
        cancelLoading = true;
        reject(`Load time out: ${JSON.stringify(url)}`);
      }, this.timeout * 1000));
    const hookTimeInfo = async<T> (label: string, func: () => Promise<T>) => {
      if (!cancelLoading) {
        const st = performance.now();
        const result = await func();

        timeInfos.push(`[${label}: ${(performance.now() - st).toFixed(2)}]`);

        return result;
      }
      throw new Error('load canceled.');
    };
    const loadResourcePromise = async () => {
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
      // TODO: JSONScene 中 bins 的类型可能为 ArrayBuffer[]
      const { usedImages, jsonScene } = await hookTimeInfo('processJSON', () => this.processJSON(rawJSON));
      const { bins = [], images, compositions, fonts } = jsonScene;
      const [loadedBins, loadedImages] = await Promise.all([
        hookTimeInfo('processBins', () => this.processBins(bins)),
        hookTimeInfo('processImages', () => this.processImages(images, usedImages, gpuInstance?.detail.compressedTexture ?? 0)),
        hookTimeInfo(`${asyncShaderCompile ? 'async' : 'sync'} compile`, () => this.precompile(compositions, renderer, options)),
      ]);

      await hookTimeInfo('processFontURL', () => this.processFontURL(fonts as spec.FontDefine[]));

      const loadedTextures = await hookTimeInfo('processTextures', () => this.processTextures(loadedImages, loadedBins, jsonScene));

      const scene = {
        jsonScene,
        images: loadedImages,
        textureOptions: loadedTextures,
        bins: loadedBins,
        storage: {},
        pluginSystem: this.pluginSystem,
        renderLevel: this.options.renderLevel,
        totalTime: 0,
        startTime: 0,
        url,
      };

      // 触发插件系统 pluginSystem 的回调 prepareResource
      await hookTimeInfo('processPlugins', () => this.pluginSystem.loadResources(scene, this.options));

      const totalTime = performance.now() - startTime;

      console.info({
        content: `${timeLabel}: ${totalTime.toFixed(4)}ms, ${timeInfos.join(' ')}`,
        type: LOG_TYPE,
      });
      window.clearTimeout(loadTimer);
      scene.totalTime = totalTime;
      scene.startTime = startTime;

      return scene;
    };

    return Promise.race([waitPromise, loadResourcePromise()]);
  }

  private async precompile (compositions: spec.Composition[], renderer?: Renderer, options?: PrecompileOptions) {
    if (!renderer || !renderer.getShaderLibrary()) {
      return;
    }
    const shaderLibrary = renderer?.getShaderLibrary();

    await this.pluginSystem.precompile(compositions, renderer, options);

    await new Promise(resolve => {
      shaderLibrary!.compileAllShaders(() => {
        resolve(null);
      });
    });
  }

  private async processJSON (json: JSONValue) {
    // TODO: 后面切换到新的数据版本，就不用掉用 getStandardJSON 做转换了
    // if (IS_PRO) {
    //   if (/^0\./.test(json.version)) {
    //     throw Error('animation json need fallback');
    //   }
    //   this._json = json;
    // }
    const jsonScene = getStandardJSON(json);

    // FIXME: hack globalVolume，specification 更新后需移除
    // @ts-expect-error
    json.compositions.forEach((composition, i) => {
      if (composition.globalVolume) {
        // @ts-expect-error
        jsonScene.compositions[i].globalVolume = composition.globalVolume;
      }
    });
    const { plugins = [], compositions: sceneCompositions, imgUsage, images } = jsonScene;

    this.pluginSystem = new PluginSystem(plugins);
    await this.pluginSystem.processRawJSON(jsonScene, this.options);

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
    };
  }

  private async processBins (bins: (spec.BinaryFile | ArrayBuffer)[]) {
    const { renderLevel } = this.options;
    const jobs = bins.map(bin => {
      if (bin instanceof ArrayBuffer) {
        return bin;
      }
      if (passRenderLevel(bin.renderLevel, renderLevel)) {
        return this.loadBins(bin.url);
      }

      throw new Error(`Invalid bins source: ${JSON.stringify(bins)}`);
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
        const fontFace = new FontFace(font.fontFamily ?? '', 'url(' + font.fontURL + ')');

        try {
          await fontFace.load();
          //@ts-expect-error
          document.fonts.add(fontFace);
          AssetManager.fonts.add(font.fontFamily);
        } catch (e) {
          console.warn({
            content: `Invalid fonts source: ${JSON.stringify(font.fontURL)}`,
            type: LOG_TYPE,
          });
        }
      }
    });

    return Promise.all(jobs);
  }

  private async processImages (
    images: any,
    usage: Record<number, boolean>,
    compressedTexture: number,
  ): Promise<ImageSource[]> {
    const { useCompressedTexture, variables } = this.options;
    const baseUrl = this.baseUrl;
    const jobs = images.map(async (img: spec.Image, idx: number) => {
      if (usage[idx]) {
        const { url: png, webp } = img;
        const imageURL = new URL(png, baseUrl).href;
        const webpURL = webp && new URL(webp, baseUrl).href;

        if ('template' in img) {
          const template = img.template as (spec.TemplateContentV1 | spec.TemplateContentV2);
          let result: { image: HTMLImageElement, type?: string, url: string };

          // 新版数据模版
          if ('v' in template && template.v === 2 && template.background) {
            const url = getBackgroundImage(template, variables);

            if (url instanceof Array) {
              const { name } = template.background;

              try {
                result = {
                  image: await loadImage(url[0]),
                  url: url[0],
                };
              } catch (e) {
                result = {
                  image: await loadImage(url[1]),
                  url: url[1],
                };
              }

              if (variables) {
                variables[name] = result.url;
              }
            } else if (typeof url === 'string') {
              result = {
                image: await loadImage(url),
                url,
              };
            }
          } else {
            // 测试场景：'年兽大爆炸——8个彩蛋t1'
            result = await loadWebPOptional(imageURL, webpURL);
          }

          let templateImage;

          try {
            templateImage = await combineImageTemplate(
              result!.image,
              template,
              variables as Record<string, number | string>,
              this.options,
              img.oriY === -1,
            );
          } catch (e) {
            throw new Error(`image template fail: ${imageURL}`);
          }

          return templateImage;
        } else if ('type' in img && img.type === 'video') {
          const { loop } = img as spec.VideoImage;

          // 视频
          return loadVideo(img.url, { loop });
        } else if ('compressed' in img && useCompressedTexture && compressedTexture) {
          // 压缩纹理
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
          return img;
        } else if (
          img instanceof HTMLImageElement ||
          img instanceof HTMLCanvasElement ||
          img instanceof HTMLVideoElement ||
          img instanceof Texture
        ) {
          return img;
        }

        const { url, image } = await loadWebPOptional(imageURL, webpURL);

        this.assets[idx] = { url, type: TextureSourceType.image };

        return image;
      }

      return undefined;
    });

    return Promise.all(jobs);
  }

  private async processTextures (
    images: any,
    bins: ArrayBuffer[],
    jsonScene: spec.JSONScene,
  ) {
    const textures = jsonScene.textures ?? images.map((img: never, source: number) => ({ source })) as spec.SerializedTextureSource[];
    const jobs = textures.map((texOpts, idx) => {
      if (texOpts instanceof Texture) {
        return texOpts;
      }
      if ('mipmaps' in texOpts) {
        try {
          return deserializeMipmapTexture(texOpts, bins, jsonScene.bins);
        } catch (e) {
          throw new Error(`load texture ${idx} fails, error message: ${e}`);
        }
      }
      const { source } = texOpts;
      const image = images[source];

      if (image) {
        const tex = createTextureOptionsBySource(image, this.assets[idx]);

        return tex.sourceType === TextureSourceType.compressed ? tex : { ...tex, ...texOpts };
      }
      throw new Error(`Invalid texture source: ${source}`);
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

  /**
   * 销毁方法
   */
  dispose (): void {
    for (const key in this.assets) {
      const asset = this.assets[key];

      asset?.dispose?.();
    }
    this.assets = {};
  }
}

function fixOldImageUsage (
  usedImages: Record<number, boolean>,
  compositions: spec.Composition[],
  imgUsage: Record<string, number[]>,
  images: any,
  renderLevel?: string,
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
    image instanceof HTMLCanvasElement
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

  throw new Error('Invalid texture options');
}
