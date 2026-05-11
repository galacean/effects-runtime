import * as EFFECTS from '@galacean/effects';
import { logger, registerPlugin } from '@galacean/effects';
import { DomContentLoader } from './dom-content-loader';

export * from './dom-content-component';
export * from './dom-content-loader';
export * from './dom-to-texture';

export const version = __VERSION__;

registerPlugin('dom-content', DomContentLoader);

logger.info(`Plugin dom-content version: ${version}.`);

if (version !== EFFECTS.version) {
  console.error(
    '注意：请统一 DomContent 插件与 Player 版本，不统一的版本混用会有不可预知的后果！',
    '\nAttention: Please ensure the DomContent plugin is synchronized with the Player version. Mixing and matching incompatible versions may result in unpredictable consequences!',
  );
}
