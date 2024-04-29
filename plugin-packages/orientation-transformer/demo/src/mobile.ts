import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-orientation-transformer';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*ss_NQJcDY8wAAAAAAAAAAAAADlB4AQ';
const bg = 'https://mdn.alipayobjects.com/mars/afts/file/A*DeAMQ6K7POoAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
  });

  await player.loadScene([
    bg, json,
  ]);
})();
