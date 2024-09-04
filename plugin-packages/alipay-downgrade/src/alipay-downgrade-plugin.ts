import type { Player, SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin, logger } from '@galacean/effects';
import { getDefaultRenderLevel } from './utils';

export class AlipayDowngradePlugin extends AbstractPlugin {
  static glLostOccurred = false;

  static async onPlayerCreated (player: Player) {
    if (AlipayDowngradePlugin.glLostOccurred) {
      console.warn('gl lost happened, new player will be destroyed.');

      player.dispose();
    }
  }

  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions = {}) {
    if (AlipayDowngradePlugin.glLostOccurred) {
      return Promise.reject('gl lost happened');
    }

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
