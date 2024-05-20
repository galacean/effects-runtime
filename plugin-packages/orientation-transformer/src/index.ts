import type { VFXItemContent } from '@galacean/effects';
import { VFXItem, logger, registerPlugin } from '@galacean/effects';
import { OrientationPluginLoader } from './orientation-plugin-loader';

declare global {
  interface Window {
    ge: any,
  }
}

registerPlugin('orientation-transformer', OrientationPluginLoader, VFXItem<VFXItemContent>);

export { getAdapter, closeDeviceMotion, openDeviceMotion } from './orientation-plugin-loader';
export { OrientationAdapterAcceler } from './orientation-adapter-acceler';
export * from './orientation-component';

export const version = __VERSION__;

logger.info('plugin orientation transformer version: ' + version);
