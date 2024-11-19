import { AssetManager, Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import { JSONConverter } from '@galacean/effects-plugin-model';

// const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/YDITHDADWXXM/1601633123-e644d.json';
// 蒙版
// const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/HCQBCOWGHRQC/273965510-c5c29.json';
// 蒙版新数据
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*36ybTZJI4JEAAAAAAAAAAAAADlB4AQ';
// 普通拖尾
// const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/RYYAXEAYMIYJ/1314733612-96c0b.json';
// 图贴拖尾
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*VRedS5UU8DAAAAAAAAAAAAAADlB4AQ';
// 3D
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*sA-6TJ695dYAAAAAAAAAAAAADlB4AQ';
// 特效元素
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*GmmoRYoutZ4AAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const assetManager = new AssetManager();
    const player = new Player({
      container,
      interactive: true,
    });
    // const converter = new JSONConverter(player.renderer, true);
    // const data = await converter.processScene(json);
    // const scene = await assetManager.loadScene(json);

    await player.loadScene(json);

  } catch (e) {
    console.error('biz', e);
  }
})();
