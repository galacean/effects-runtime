import { Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*bl40RLWLKisAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
      interactive: true,
    });

    const composition = await player.loadScene(json);
  } catch (e) {
    console.error('biz', e);
  }
})();
