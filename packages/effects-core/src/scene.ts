import type * as spec from '@galacean/effects-specification';
import type { Texture } from './texture';
import type { PluginSystem } from './plugin-system';
import type { PickEnum } from './utils';
import { isObject } from './utils';

export type ImageSource = spec.TemplateImage | spec.Image | spec.CompressedImage;
export type SceneRenderLevel = PickEnum<spec.RenderLevel, spec.RenderLevel.A | spec.RenderLevel.B | spec.RenderLevel.S>;

/**
 * 场景类型
 */
export interface Scene {
  readonly jsonScene: spec.JSONScene,
  readonly bins: ArrayBuffer[],
  readonly pluginSystem: PluginSystem,
  readonly renderLevel?: SceneRenderLevel,
  readonly storage: Record<string, any>,

  textureOptions: Record<string, any>[],
  images: ImageSource[],
  consumed?: boolean,
  textures?: Texture[],
  /**
   * 加载总耗时
   */
  totalTime?: number,
  /**
   * 加载开始时间
   */
  startTime?: number,
  /**
   * 加载分段时长
   */
  timeInfos: Record<string, number>,
  url: SceneType,
  usedImages: Record<number, boolean>,
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
   * 是否使用压缩纹理
   */
  useCompressedTexture?: boolean,

  /**
   * 渲染分级。
   * 分级之后，只会加载当前渲染等级的资源。
   * 当渲染等级被设置为 B 后，player 的 fps 会降到 30 帧
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
   */
  speed?: number,
}

/**
 * 接受用于加载的数据类型
 */
export type SceneURLType = { url: string };
export type SceneType = string | Scene | SceneURLType | Record<string, any>;
export type SceneWithOptionsType = { options: SceneLoadOptions };
export type SceneLoadType = SceneType | SceneWithOptionsType;

export function isSceneJSON (scene: any): scene is Scene {
  return isObject(scene) && 'jsonScene' in scene;
}

export function isSceneURL (scene: any): scene is Scene {
  return isObject(scene) && 'url' in scene;
}

export function isSceneWithOptions (scene: any): scene is SceneWithOptionsType {
  return isObject(scene) && 'options' in scene;
}
