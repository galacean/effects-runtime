import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*L806QJv14k0AAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,

    });

    await player.loadScene(json, {
      reusable: true,
    });
  } catch (e) {
    console.error('biz', e);
  }
})();
