import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-ffd';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*trEcQ7My81EAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    await player.loadScene(json);
  } catch (e) {
    console.error('biz', e);
  }
})();
