import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';

const json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240410102826011/mars-preview.json';
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240409084951679/mars-preview.json';

// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240409083607425/mars-preview.json';

// json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240409075831453/mars-preview.json';// 一段speed
// json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240409080452290/mars-preview.json'; // 2段速度曲线
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
