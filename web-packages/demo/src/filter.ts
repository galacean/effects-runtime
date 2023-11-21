import { Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*9IytQIW9BIMAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  const player = createPlayer();

  await player.loadScene(json);

})();

function createPlayer () {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    renderFramework: 'webgl',
    env: 'editor',
    onPausedByItem: data => {
      console.info('onPausedByItem', data);
    },
  });

  return player;
}
