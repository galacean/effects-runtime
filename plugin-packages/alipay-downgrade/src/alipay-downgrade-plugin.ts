import type { SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin, logger } from '@galacean/effects';
import { getDefaultRenderLevel } from './utils';

export class AlipayDowngradePlugin extends AbstractPlugin {
  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions = {}) {
    const downgradeResult = options.pluginData?.['downgrade'];

    if (downgradeResult) {
      if (downgradeResult.downgrade) {
        throw new Error(`Downgraded, reason: ${downgradeResult.reason}`);
      }
    } else {
      logger.warn('No downgrade result in pluginData of SceneLoadOptions.');
    }

    if (!options.renderLevel) {
      options.renderLevel = downgradeResult?.level ?? getDefaultRenderLevel();
    }
  }
}
