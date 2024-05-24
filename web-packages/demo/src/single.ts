import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*fqAMRYy9g1QAAAAAAAAAAAAADlB4AQ';

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json);

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
