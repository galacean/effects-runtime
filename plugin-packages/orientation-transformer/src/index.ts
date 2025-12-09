import * as EFFECTS from '@galacean/effects';
import { logger, registerPlugin } from '@galacean/effects';
import { OrientationPluginLoader } from './orientation-plugin-loader';

registerPlugin('orientation-transformer', OrientationPluginLoader);

export { getAdapter, closeDeviceMotion, openDeviceMotion, OrientationPluginLoader } from './orientation-plugin-loader';
export { OrientationAdapterAcceler } from './orientation-adapter-acceler';
export * from './orientation-component';

/**
 * 插件版本号
 */
export const version = __VERSION__;

logger.info(`Plugin orientation transformer version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 Orientation Transformer 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the Orientation Transformer plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!'
  );
}
