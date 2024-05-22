import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.turnplate.url;

(async () => {
  try {
    const player = createPlayer();

    await player.loadScene(json, {});

  } catch (e) {
    console.error('biz', e);
  }
})();

function createPlayer () {
  const player = new Player({
    container: document.getElementById('J-container'),
    interactive: true,
    onPlayableUpdate: ({ player, playing }) => {
    },
    // manualRender: true,
    renderFramework: 'webgl',
    // env: 'editor',
    notifyTouch: true,
    onPausedByItem: data => {
      console.info('onPausedByItem', data);
    },
    onItemClicked: data => {
      console.info(`item ${data.name} has been clicked`);
    },
    // reportGPUTime: console.debug,
  });

  return player;
}
