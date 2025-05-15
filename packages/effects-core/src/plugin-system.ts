import type * as spec from '@galacean/effects-specification';
import type { Composition } from './composition';
import type { Plugin, PluginConstructor } from './plugins';
import type { RenderFrame, Renderer } from './render';
import type { Scene, SceneLoadOptions } from './scene';
import { addItem, removeItem, logger } from './utils';
import type { VFXItemConstructor } from './vfx-item';

export const pluginLoaderMap: Record<string, PluginConstructor> = {};
export const defaultPlugins: string[] = [];

const pluginCtrlMap: Record<string, VFXItemConstructor> = {};

/**
 * 注册 plugin
 * @param name
 * @param pluginClass class of plugin
 * @param itemClass class of item
 * @param isDefault load
 */
export function registerPlugin (
  name: string,
  pluginClass: PluginConstructor,
  itemClass: VFXItemConstructor,
) {
  if (pluginCtrlMap[name]) {
    logger.error(`Duplicate registration for plugin ${name}.`);
  }

  pluginCtrlMap[name] = itemClass;
  pluginLoaderMap[name] = pluginClass;

  addItem(defaultPlugins, name);
}
export function unregisterPlugin (name: string) {
  delete pluginCtrlMap[name];
  delete pluginLoaderMap[name];
  removeItem(defaultPlugins, name);
}

export class PluginSystem {
  readonly plugins: Plugin[];

  constructor (pluginNames: string[]) {
    const loaders: Record<string, PluginConstructor> = {};
    const loaded: PluginConstructor[] = [];
    const addLoader = (name: string) => {
      const loader = pluginLoaderMap[name];

      if (!loaded.includes(loader)) {
        loaded.push(loader);
        loaders[name] = loader;
      }
    };

    defaultPlugins.forEach(addLoader);
    pluginNames.forEach(addLoader);
    this.plugins = Object.keys(loaders)
      .map(name => {
        const CTRL = pluginLoaderMap[name];

        if (!CTRL) {
          throw new Error(`The plugin '${name}' not found.` + getPluginUsageInfo(name));
        }

        const loader = new CTRL();

        loader.name = name;

        return loader;
      })
      .sort((a, b) => a.order - b.order);
  }

  initializeComposition (composition: Composition, scene: Scene) {
    this.plugins.forEach(loader => loader.onCompositionConstructed(composition, scene));
  }

  destroyComposition (comp: Composition) {
    this.plugins.forEach(loader => loader.onCompositionDestroyed(comp));
  }

  resetComposition (comp: Composition, renderFrame: RenderFrame) {
    this.plugins.forEach(loader => loader.onCompositionReset(comp, renderFrame));
  }

  async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions): Promise<void[]> {
    return this.callStatic('processRawJSON', json, options);
  }

  async processAssets (json: spec.JSONScene, options?: SceneLoadOptions) {
    return this.callStatic<{ assets: spec.AssetBase[], loadedAssets: unknown[] }>('processAssets', json, options);
  }

  precompile (
    compositions: spec.CompositionData[],
    renderer: Renderer,
  ) {
    for (const plugin of this.plugins) {
      plugin.precompile(compositions, renderer);
    }
  }

  async loadResources (scene: Scene, options: SceneLoadOptions) {
    return this.callStatic('prepareResource', scene, options);
  }

  private async callStatic<T> (name: string, ...args: any[]): Promise<T[]> {
    const pendings = [];
    const plugins = this.plugins;

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      const ctrl = pluginLoaderMap[plugin.name];

      if (name in ctrl) {
        pendings.push(Promise.resolve<T>(ctrl[name]?.(...args)));
      }
    }

    return Promise.all(pendings);
  }
}

const pluginInfoMap: Record<string, string> = {
  'alipay-downgrade': '@galacean/effects-plugin-alipay-downgrade',
  'downgrade': '@galacean/effects-plugin-downgrade',
  'editor-gizmo': '@galacean/effects-plugin-editor-gizmo',
  'model': '@galacean/effects-plugin-model',
  'video': '@galacean/effects-plugin-multimedia',
  'audio': '@galacean/effects-plugin-multimedia',
  'orientation-transformer': '@galacean/effects-plugin-orientation-transformer',
  'rich-text': '@galacean/effects-plugin-rich-text',
  'spine': '@galacean/effects-plugin-spine',
};

function getPluginUsageInfo (name: string) {
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
