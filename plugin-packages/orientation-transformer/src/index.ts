import { logger, registerPlugin } from '@galacean/effects';
import { OrientationPluginLoader } from './orientation-plugin-loader';
import { TransformVFXItem } from './transform-vfx-item';

declare global {
  interface Window {
    ge: any,
  }
}

registerPlugin('orientation-transformer', OrientationPluginLoader, TransformVFXItem);

export { getAdapter, closeDeviceMotion, openDeviceMotion, OrientationPluginLoader } from './orientation-plugin-loader';
export { OrientationAdapterAcceler } from './orientation-adapter-acceler';
export { TransformVFXItem } from './transform-vfx-item';

export const version = __VERSION__;

logger.info('plugin orientation transformer version: ' + version);
