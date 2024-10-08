import type { AssetManager, Renderer } from '@galacean/effects';

export interface PluginData {
  hookTimeInfo: (label: string, fn: () => Promise<any>) => Promise<any>,
  renderer?: Renderer,
  assetManager: AssetManager,
}
