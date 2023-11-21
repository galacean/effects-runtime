import { Player } from '@galacean/effects';
import cubeTextures from './assets/cube-textures';

const jsons = [
  // 方块
  'https://mdn.alipayobjects.com/mars/afts/file/A*Cm9XQKBkH9MAAAAAAAAAAAAADlB4AQ',
  // 最简单
  'https://mdn.alipayobjects.com/mars/afts/file/A*OQ8LQZDuWe0AAAAAAAAAAAAADlB4AQ',
  // 预合成
  'https://mdn.alipayobjects.com/mars/afts/file/A*HLCjSZj3m9IAAAAAAAAAAAAADlB4AQ',
  // 流星
  'https://mdn.alipayobjects.com/mars/afts/file/A*nQuiRaqh8p0AAAAAAAAAAAAADlB4AQ',
  // 扫光
  'https://mdn.alipayobjects.com/mars/afts/file/A*9OhBSZjlD1kAAAAAAAAAAAAADlB4AQ',
  // 老版本数据
  'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/KOKXVLUKRNST/1640600625-99890.json',
  // 少量图层
  'https://mdn.alipayobjects.com/mars/afts/file/A*NIyGSLAC5AIAAAAAAAAAAAAADlB4AQ',
  // 多个粒子
  'https://mdn.alipayobjects.com/mars/afts/file/A*vWajS5AH-lcAAAAAAAAAAAAADlB4AQ',
  // 相机动画
  'https://mdn.alipayobjects.com/mars/afts/file/A*9p3pR44ySfUAAAAAAAAAAAAADlB4AQ',
  // // 2022 集五福
  'https://mdn.alipayobjects.com/mars/afts/file/A*dnU-SprU5pAAAAAAAAAAAAAADlB4AQ',
];

// @ts-expect-error
jsons.push(cubeTextures);

(async () => {
  jsons.forEach(async json => {
    try {
      const player = createPlayer();
      const scene = player.loadScene(json);

      // await sleep(50);
      // player.pause({ offloadTexture: true });

      // await sleep(2000);
      // await player.resume();
    } catch (e) {
      console.error('biz', e);
      // do something
    }
  });
})();

function createPlayer () {
  const container = document.createElement('div');

  container.classList.add('cell');
  document.body.appendChild(container);

  const player = new Player({
    container,
    pixelRatio: 1,
    onPausedByItem: data => {
      console.info('onPausedByItem', data);
    },
    renderFramework: 'webgl',
  });

  return player;
}

function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
