import { Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*oTSPQKv88sMAAAAAAAAAAAAADlB4AQ';
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*ENGYTp2rE14AAAAAAAAAAAAADlB4AQ';
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
