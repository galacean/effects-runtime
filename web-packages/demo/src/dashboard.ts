import type { Composition } from '@galacean/effects';
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
  // jsons.forEach(async json => {
  //   try {
  //     const container = createContainer();
  //     const player = new Player({
  //       container,
  //       // renderFramework: 'webgl',
  //     });

  //     await player.loadScene(json);
  //   } catch (e) {
  //     console.error('biz', e);
  //     // do something
  //   }
  // });

  try {
    const container = createContainer();
    const player = new Player({
      container,
    });
    const compositions = await player.loadScene([
      'https://mdn.alipayobjects.com/mars/afts/file/A*kgZpSZrwf44AAAAAAAAAAAAADlB4AQ',
      'https://mdn.alipayobjects.com/mars/afts/file/A*L0_gRYNia70AAAAAAAAAAAAADlB4AQ',
      'https://mdn.alipayobjects.com/mars/afts/file/A*1LmLT4UawyMAAAAAAAAAAAAADlB4AQ',
      'https://mdn.alipayobjects.com/mars/afts/file/A*pUKbR68CeEMAAAAAAAAAAAAADlB4AQ',
    ], { autoplay: false }) as unknown as Composition[];

    // compositions[0].on('end', () => {
    //   console.log('end');
    // });
    player.playSequence(compositions);
  } catch (e) {
    console.error('biz', e);
  }
})();

function createContainer () {
  const container = document.createElement('div');

  container.classList.add('cell');
  document.body.appendChild(container);

  return container;
}
