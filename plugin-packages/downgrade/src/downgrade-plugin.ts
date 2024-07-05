import type { SceneLoadOptions } from '@galacean/effects';
import { isIOS, logger, spec } from '@galacean/effects';
import { AbstractPlugin } from '@galacean/effects';

export class DowngradePlugin extends AbstractPlugin {
  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions = {}) {
    const downgradeResult = options.pluginData?.['downgrade'];

    if (downgradeResult) {
      if (downgradeResult.downgrade) {
        throw new Error(`downgraded, reason: ${downgradeResult.reason}`);
      }
    } else {
      logger.warn('No downgrade result in pluginData of SceneLoadOptions');
    }

    if (!options.renderLevel) {
      if (downgradeResult) {
        options.renderLevel = downgradeResult.renderLevel;
      } else {
        options.renderLevel = isIOS() ? spec.RenderLevel.S : spec.RenderLevel.B;
      }
    }
  }
}
