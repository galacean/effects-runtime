import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-orientation-transformer';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*boRsTqJ4QAkAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
  });

  await player.loadScene(json);
})();
