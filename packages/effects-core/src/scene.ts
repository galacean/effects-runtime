import * as spec from '@galacean/effects-specification';
import { CompositionComponent } from './components/composition-component';
import type { Composition } from './composition';
import { EffectsPackage } from './effects-package';
import { passRenderLevel } from './pass-render-level';
import { SceneLoader } from './scene-loader';
import { Texture } from './texture';
import type { VFXItem } from './vfx-item';
import type { Disposable, PickEnum } from './utils';
import { assertExist, isObject } from './utils';

export type ImageLike = spec.HTMLImageLike | ArrayBuffer | Texture;
export type SceneRenderLevel = PickEnum<spec.RenderLevel, spec.RenderLevel.A | spec.RenderLevel.B | spec.RenderLevel.S>;

/** Loaded scene resources and prepared definitions that can be instantiated repeatedly. */
export class Scene implements Disposable {
  readonly jsonScene: spec.JSONScene;
  readonly storage: Record<string, any> = {};
  /** @internal Prepared definitions shared by instances of this scene. */
  objectsDataCache = new Map<string, spec.EffectsObjectData>();
  options: SceneLoadOptions;
  renderLevel?: SceneRenderLevel;
  textureOptions: Record<string, any>[] = [];
  images: ImageLike[] = [];
  videos: HTMLVideoElement[] = [];
  audios: (HTMLAudioElement | AudioBuffer)[] = [];
  bins: ArrayBuffer[] = [];
  /** 加载总耗时。 */
  totalTime?: number;
  /** 加载开始时间。 */
  startTime?: number;
  /** 加载分段时长。 */
  timeInfos: Record<string, number> = {};
  /** 场景资源的来源地址，从 JSON 对象创建时为空。 */
  url: string = '';
  private disposed = false;

  constructor (jsonScene: spec.JSONScene, options: SceneLoadOptions = {}) {
    this.jsonScene = jsonScene;
    this.options = options;
  }

  /** Apply scene load policies before instantiating its objects. */
  prepare (): void {
    this.renderLevel = this.options.renderLevel ?? this.renderLevel;
    const { objectsDataCache } = this;
    const variables = this.options.variables ?? {};

    this.prepareAssets();
    for (const item of this.jsonScene.items) {
      if (!passRenderLevel(item.renderLevel, this.renderLevel)) {
        const degraded = { ...item, components: [], type: spec.ItemType.null };

        delete (degraded as { refId?: string }).refId;
        objectsDataCache.set(String(item.id), degraded);
        continue;
      }
      const textVariable = variables[item.name] as string;

      if (textVariable === undefined || textVariable === null) {
        continue;
      }
      for (const { id } of item.components ?? []) {
        const componentData = objectsDataCache.get(String(id)) as spec.TextComponentData | undefined;

        if (componentData?.dataType === spec.DataType.TextComponent || componentData?.dataType === spec.DataType.RichTextComponent) {
          const overridden = { ...componentData, options: { ...componentData.options, text: textVariable } };

          objectsDataCache.set(String(id), overridden);
        }
      }
    }
  }

  /** Instantiate the prepared scene into an unparented hierarchy or an existing root. */
  instantiate (composition: Composition, root?: VFXItem): VFXItem {
    if (this.disposed) {
      throw new Error('Cannot instantiate a disposed scene.');
    }
    const { compositionId, compositions } = this.jsonScene;
    const data = compositions.find(entry => entry.id === compositionId) ?? compositions[0];

    assertExist(data);
    const rootItem = SceneLoader.instantiateComposition(data, composition.engine, this, root);

    if (!root) {
      const component = rootItem.getComponent(CompositionComponent) ?? rootItem.addComponent(CompositionComponent);

      component.playOnStart = this.options.autoplay ?? true;
      component.endBehavior = rootItem.endBehavior;
    }

    return rootItem;
  }

  /** Release source media after all instances using this scene have been destroyed. */
  dispose (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const video of this.videos) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    for (const image of this.images) {
      if (image instanceof HTMLVideoElement) {
        image.pause();
        image.removeAttribute('src');
        image.load();
      }
    }
  }

  /** Register the scene definitions and loaded assets together. */
  private prepareAssets (): void {
    const { jsonScene, images, videos, audios, bins, textureOptions = [] } = this;
    const {
      items = [], materials = [], shaders = [], geometries = [], components = [],
      animations = [], bins: binaryDatas = [], miscs = [], compositions,
      videos: videoDefinitions = [], audios: audioDefinitions = [], images: imageDefinitions,
    } = jsonScene;
    const definitions = this.objectsDataCache;
    const add = (data: spec.EffectsObjectData) => definitions.set(String(data.id), data);

    for (const compositionData of compositions) {
      add(compositionData as unknown as spec.EffectsObjectData);
    }
    for (const vfxItemData of items) {
      add(vfxItemData);
    }
    for (const materialData of materials) {
      add(materialData);
    }
    for (const shaderData of shaders) {
      add(shaderData);
    }
    for (const geometryData of geometries) {
      add(geometryData);
    }
    for (const componentData of components) {
      add(componentData);
    }
    for (const animationData of animations) {
      add(animationData);
    }
    for (const miscData of miscs) {
      add(miscData);
    }
    for (let i = 0; i < binaryDatas.length; i++) {
      const binaryData = binaryDatas[i];
      const binaryBuffer = bins[i];

      if (binaryData.dataType === spec.DataType.BinaryAsset) {
        if (binaryData.id) {
          const data = { ...binaryData, buffer: binaryBuffer };

          add(data);
        }
      } else {
        const effectsPackage = new EffectsPackage();

        effectsPackage.deserializeFromBinary(new Uint8Array(binaryBuffer));
        for (const effectsObjectData of effectsPackage.exportObjectDatas) {
          add(effectsObjectData);
        }
      }
    }
    for (const textureData of textureOptions) {
      if (!(textureData instanceof Texture)) {
        add(textureData as spec.EffectsObjectData);
      }
    }
    for (let i = 0; i < videos.length; i++) {
      const input = { id: videoDefinitions[i].id, dataType: 'DataAsset' as spec.DataType, data: videos[i] };

      add(input);
    }
    for (let i = 0; i < audios.length; i++) {
      const input = { id: audioDefinitions[i].id, dataType: 'DataAsset' as spec.DataType, data: audios[i] };

      add(input);
    }
    for (let i = 0; i < images.length; i++) {
      const input = { id: imageDefinitions[i].id, dataType: 'DataAsset' as spec.DataType, data: images[i] };

      add(input);
    }
  }
}

export namespace Scene {
  type URLType = { url: string, options?: SceneLoadOptions };

  /**
   * 接受用于加载的数据类型
   */
  export type LoadType = string | Scene | URLType | spec.JSONScene | Record<string, unknown>;

  // JSON 对象
  export function isJSONObject (scene: any): scene is Scene {
    return scene instanceof Scene;
  }

  export function isURL (scene: any): scene is URLType {
    return isObject(scene) && 'url' in scene;
  }

  export function isWithOptions (scene: any): scene is URLType {
    return isObject(scene) && 'options' in scene;
  }
}

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
  variables?: spec.TemplateVariables,

  /**
   * 是否优先使用压缩纹理
   * 当资源存在且当前环境支持时使用，否则回退到普通图片
   * 需要注册 KTX2 loader，例如 import '@galacean/effects-plugin-ktx2'
   * @default true
   */
  useCompressedTexture?: boolean,

  /**
   * 是否优先使用 Hevc 视频
   * 当资源存在且当前环境支持时使用，否则回退到普通视频
   * @default true
   */
  useHevcVideo?: boolean,

  /**
   * 渲染分级。
   * 分级之后，只会加载当前渲染等级的资源。
   * @default 'S'
   */
  renderLevel?: SceneRenderLevel,

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
   * @default 1
   */
  speed?: number,
  /**
   * 是否禁用 AVIF 图片
   * @default undefined
   */
  disableAVIF?: boolean,
  /**
   * 是否禁用 WebP 图片
   * @default undefined
   */
  disableWebP?: boolean,
}
