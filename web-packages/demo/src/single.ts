import { Player } from '@galacean/effects';

// 动态文本
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*40vJRJf5nAAAAAAAAAAAAAAADlB4AQ';
// 动态换图
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*T1U4SqWhvioAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    await player.loadScene('https://gw.alipayobjects.com/os/gltf-asset/97436498253707/pre.json');
  } catch (e) {
    console.error('biz', e);
  }
})();
