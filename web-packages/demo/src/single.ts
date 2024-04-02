import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import inspireList from './assets/inspire-list';

const json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240402015523979/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240329095904692/mars-preview.json';

const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json, {
      autoplay: false,
    });

    player.gotoAndStop(0.5);
    setTimeout(() => {
      player.gotoAndStop(0.1);

    }, 300);
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

// dat gui 参数及修改
function setDatGUI () {
  // const gui = new dat.GUI();
}
