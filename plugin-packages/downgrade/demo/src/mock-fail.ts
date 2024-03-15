import { Player } from '@galacean/effects';
import { getDowngradeResult } from '@galacean/effects-plugin-downgrade';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*liH3SI2hhHUAAAAAAAAAAAAADlB4AQ';
const imageUrl = 'https://mdn.alipayobjects.com/huamei_n0ji1n/afts/img/A*cN99R7HAgrIAAAAAAAAAAAAADuJ6AQ/original';

(async () => {
  console.info('downgrade');

  const container = document.getElementById('J-container');
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
  });

  const downgrade = getDowngradeResult();

  try {
    const scene = await player.loadScene(json, {
      pluginData: {
        downgrade,
      },
    });
  } catch (e) {
    console.error('biz', e);
    // @ts-expect-error
    container.innerHTML = `<img src="${imageUrl}" />`;
  }
})();
