import { logger, registerPlugin } from '@galacean/effects';
import { DowngradeVFXItem } from './downgrade-vfx-item';
import { DowngradePlugin } from './downgrade-plugin';

export * from './utils';

export const version = __VERSION__;

registerPlugin('downgrade', DowngradePlugin, DowngradeVFXItem, true);

logger.info('plugin downgrade version: ' + version);
