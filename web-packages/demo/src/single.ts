import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import inspireList from './assets/inspire-list';

const json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240322072832872/mars-preview.json'; // 拖尾和随机
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240322042710121/mars-preview.json'; // 环绕
// 'https://mdn.alipayobjects.com/mars/afts/file/A*tGq0T4zX_8gAAAAAAAAAAAAADlB4AQ';
// 'http://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240321041512636/mars-preview.json';

const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json, {
      autoplay: false,
    });

    setTimeout(() => {
      comp.play();
    }, 1000);

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
