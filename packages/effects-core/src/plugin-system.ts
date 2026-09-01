import type { Composition } from './composition';
import type { Plugin, PluginConstructor } from './plugins';
import type { Scene, SceneLoadOptions } from './scene';
import { logger } from './utils';
import type { Engine } from './engine';

export const pluginLoaderMap: Record<string, PluginConstructor> = {};

const plugins: Plugin[] = [];

/**
 * 注册 plugin
 * @param name
 * @param pluginClass class of plugin
 * @param itemClass class of item
 * @param isDefault load
 */
export function registerPlugin (name: string, pluginClass: PluginConstructor) {
  if (pluginLoaderMap[name]) {
    logger.error(`Duplicate registration for plugin ${name}.`);
  }

  pluginLoaderMap[name] = pluginClass;

  const pluginInstance = new pluginClass();

  pluginInstance.name = name;

  plugins.push(pluginInstance);
  plugins.sort((a, b) => a.order - b.order);
}

/**
 * 注销 plugin
 */
export function unregisterPlugin (name: string) {
  delete pluginLoaderMap[name];
  const pluginIndex = plugins.findIndex(plugin => plugin.name === name);

  if (pluginIndex !== -1) {
    plugins.splice(pluginIndex, 1);
  }
}

export class PluginSystem {
  static getPlugins (): Plugin[] {
    return plugins;
  }

  static notifyCompositionCreating (composition: Composition, scene?: Scene) {
    plugins.forEach(plugin => plugin.onCompositionCreating(composition, scene));
  }

  static notifyCompositionCreated (composition: Composition, scene?: Scene) {
    plugins.forEach(plugin => plugin.onCompositionCreated(composition, scene));
  }

  static notifyCompositionDestroy (composition: Composition) {
    plugins.forEach(plugin => plugin.onCompositionDestroy(composition));
  }

  static notifyEngineCreated (engine: Engine) {
    plugins.forEach(plugin => plugin.onEngineCreated(engine));
  }

  static notifyEngineDestroy (engine: Engine) {
    plugins.forEach(plugin => plugin.onEngineDestroy(engine));
  }

  static async notifyAssetsLoadStart (scene: Scene, options?: SceneLoadOptions) {
    return Promise.all(
      plugins.map(plugin => plugin.onAssetsLoadStart(scene, options)),
    );
  }

  static notifyAssetsLoadFinish (scene: Scene, options: SceneLoadOptions, engine: Engine) {
    plugins.forEach(plugin => plugin.onAssetsLoadFinish(scene, options, engine));
  }
}

const pluginInfoMap: Record<string, string> = {
  'alipay-downgrade': '@galacean/effects-plugin-alipay-downgrade',
  'downgrade': '@galacean/effects-plugin-downgrade',
  'editor-gizmo': '@galacean/effects-plugin-editor-gizmo',
  'ffd': '@galacean/effects-plugin-ffd',
  'ktx2': '@galacean/effects-plugin-ktx2',
  'model': '@galacean/effects-plugin-model',
  'video': '@galacean/effects-plugin-multimedia',
  'audio': '@galacean/effects-plugin-multimedia',
  'orientation-transformer': '@galacean/effects-plugin-orientation-transformer',
  'rich-text': '@galacean/effects-plugin-rich-text',
  'spine': '@galacean/effects-plugin-spine',
};

export function getPluginUsageInfo (name: string) {
  const info = pluginInfoMap[name];

  if (info) {
    return `
请按如下命令进行操作（Please follow the commands below to proceed）：
1、使用 npm 安装插件（Install Plugin）：npm i ${info}@latest --save
2、导入插件（Import Plugin）：import '${info}'`;
  } else {
    return '';
  }
}
