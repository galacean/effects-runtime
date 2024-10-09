import type { Engine } from '@galacean/effects';

export interface PluginData {
  hookTimeInfo: <T>(label: string, fn: () => Promise<T>) => Promise<T>,
  engine?: Engine,
  assets: Record<string, any>,
}
