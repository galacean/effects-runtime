import { Player } from '@galacean/effects';

// 大量粒子
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*aCeuQ5RQZj4AAAAAAAAAAAAADlB4AQ';
// 塔奇
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*uU2JRIjcLIcAAAAAAAAAAAAADlB4AQ';
// const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/TAJIINQOUUKP/-799304223-0ee5d.json';
const container = document.getElementById('J-container');

document.getElementById('J-button')!.addEventListener('click', () => {
  (async () => {
    try {
      container?.classList.add('active');

      const player = new Player({
        container,
        // renderFramework: 'webgl2',
      });
      const composition = await player.loadScene(json);

      for (const key in composition.statistic) {
        const p = document.createElement('li');

        // @ts-expect-error
        p.innerHTML = `${key}: ${composition.statistic[key]}`;
        document.getElementById('J-statistic')?.appendChild(p);
      }
    } catch (e) {
      console.error('biz', e);
    }
  })();
});
