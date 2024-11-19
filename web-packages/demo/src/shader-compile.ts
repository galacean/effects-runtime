import type { Composition } from '@galacean/effects';
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

// 大量粒子
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*aCeuQ5RQZj4AAAAAAAAAAAAADlB4AQ';
// 新年烟花
const json = [
  'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/ILDKKFUFMVJA/1705406034-80896.json',
  'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*qTquTKYbk6EAAAAAAAAAAAAADsF2AQ',
];
// 混合测试
// const json = [
//   'https://mdn.alipayobjects.com/mars/afts/file/A*QyX8Rp-4fmUAAAAAAAAAAAAADlB4AQ',
//   'https://mdn.alipayobjects.com/mars/afts/file/A*bi3HRobVsk8AAAAAAAAAAAAADlB4AQ',
//   'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*sEdkT5cdXGEAAAAAAAAAAAAADsF2AQ',
// ];
// 塔奇
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*uU2JRIjcLIcAAAAAAAAAAAAADlB4AQ';
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
      const compositions = await player.loadScene(Array.isArray(json) ? json : [json]) as unknown as Composition[];

      compositions.forEach(composition => {
        const dt = document.createElement('dt');

        dt.innerHTML = `>>> composition: ${composition.name}`;
        document.getElementById('J-statistic')?.appendChild(dt);

        for (const key in composition.statistic) {
          const p = document.createElement('dd');

          // @ts-expect-error
          p.innerHTML = `${key}: ${composition.statistic[key]}`;
          document.getElementById('J-statistic')?.appendChild(p);
        }
      });
    } catch (e) {
      console.error('biz', e);
    }
  })();
});
