import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*NXOAQ6Su4sMAAAAAAAAAAAAADlB4AQ';
// 'https://mdn.alipayobjects.com/mars/afts/file/A*ZrU7SIuNOdkAAAAAAAAAAAAADlB4AQ';
// 'https://mdn.alipayobjects.com/mars/afts/file/A*_DqDToRcM7oAAAAAAAAAAAAADlB4AQ';
// 'https://mdn.alipayobjects.com/mars/afts/file/A*VPbASpxweKAAAAAAAAAAAAAADlB4AQ';
// 'https://mdn.alipayobjects.com/mars/afts/file/A*a8bbR4Zew5AAAAAAAAAAAAAADlB4AQ';
// 'https://mdn.alipayobjects.com/mars/afts/file/A*Ok3cRL6zvRoAAAAAAAAAAAAADlB4AQ';
// 'https://mdn.alipayobjects.com/mars/afts/file/A*J7LRRI073y4AAAAAAAAAAAAADlB4AQ';

(async () => {
  try {
    const player = createPlayer();

    await player.loadScene(json);

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
    onRenderError: e => {
      console.info(`render error: ${e.message}`);
    },
    // reportGPUTime: console.debug,
  });

  return player;
}
