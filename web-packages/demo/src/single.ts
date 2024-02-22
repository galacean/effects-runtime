import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import inspireList from './assets/inspire-list';
import { TreeGui } from './gui/tree-gui';

const json = 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240222051658521/mars-preview.json';
// 'https://mmtcdp.stable.alipay.net/graph_jupitercyc/uri/file/as/20240221055727706/mars-preview.json';
// 'https://mdn.alipayobjects.com/mars/afts/file/A*v5nvSbp7ysAAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

const treeGui = new TreeGui();

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json, {
    });

    treeGui.setComposition(comp);
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
