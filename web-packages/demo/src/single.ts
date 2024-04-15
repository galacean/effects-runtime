import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';

const json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240415102836129/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412091108408/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412060511057/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412054047595/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412042629845/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240412110717169/mars-preview.json';
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240410104505760/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240410104505760/mars-preview.json';
const container = document.getElementById('J-container');

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

// dat gui 参数及修改
function setDatGUI () {
  // const gui = new dat.GUI();
}
