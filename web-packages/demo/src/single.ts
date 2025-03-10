import { AssetManager, Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*SmtETIh6bcAAAAAAAAAAAAAAelB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const assetManager = new AssetManager();
    const player = new Player({
      container,
      interactive: true,
    });
    // const converter = new JSONConverter(player.renderer, true);
    // const data = await converter.processScene(json);
    // const scene = await assetManager.loadScene(json);

    await player.loadScene(json);

    // player.gotoAndStop(3);

  } catch (e) {
    console.error('biz', e);
  }
})();
