import { logger, registerPlugin } from '@galacean/effects';
import { AlipayDowngradePlugin } from './alipay-downgrade-plugin';
import { DowngradeVFXItem } from './downgrade-vfx-item';

export * from './utils';
export * from './native-log';
export * from './types';

export const version = __VERSION__;

registerPlugin('alipay-downgrade', AlipayDowngradePlugin, DowngradeVFXItem, true);

logger.info('plugin alipay downgrade version: ' + version);
