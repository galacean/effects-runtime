import type * as spec from '@galacean/effects-specification';
import type { JSONValue } from './downloader';
import type { Texture } from './texture';
import type { PluginSystem } from './plugin-system';
import { isObject } from './utils';

export type ImageSource = spec.TemplateImage | spec.Image | spec.CompressedImage;

/**
 *
 */
export interface Scene {
  readonly jsonScene: spec.JSONScene,
  readonly images: ImageSource[],
  readonly textureOptions: Record<string, any>[],
  readonly bins: ArrayBuffer[],
  readonly pluginSystem: PluginSystem,
  readonly renderLevel?: spec.RenderLevel,
  readonly storage: Record<string, any>,

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
  url: string | JSONValue,
}

export function isScene (scene: any): scene is Scene {
  // TODO: 判断不太优雅，后期试情况优化
  return isObject(scene) && 'jsonScene' in scene;
}
