import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import inspireList from './assets/inspire-list';
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*b-TmTKeXLgIAAAAAAAAAAAAADlB4AQ';
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*t73rS5K6bjAAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json, {
      variables: {
        btnText: 'https://mdn.alipayobjects.com/mars/afts/img/A*RHR4Qpzs5csAAAAAAAAAAAAADlB4AQ/original',
      },
    });
  } catch (e) {
    console.error('biz', e);
  }
})();

function createPlayer () {
  const player = new Player({
    container,
    interactive: true,
    onPlayableUpdate: ({ player, playing }) => {
    },
    // renderFramework: 'webgl',
    env: 'editor',
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

