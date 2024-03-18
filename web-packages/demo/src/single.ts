import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import inspireList from './assets/inspire-list';

const json = 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240318064851336/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240305030946984/mars-preview.json'; // 1条路径
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304060128455/mars-preview.json'; // 定格
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304052625290/mars-preview.json'; // 首尾复制
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304051328538/mars-preview.json'; // 中间线性
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240304043452170/mars-preview.json'; // 4个控制点 不带直线
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json, {
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

// dat gui 参数及修改
function setDatGUI () {
  // const gui = new dat.GUI();
}
