import { Player } from '@galacean/effects';
import { getDowngradeResult } from '@galacean/effects-plugin-alipay-downgrade';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*liH3SI2hhHUAAAAAAAAAAAAADlB4AQ';
const imageUrl = 'https://mdn.alipayobjects.com/huamei_n0ji1n/afts/img/A*cN99R7HAgrIAAAAAAAAAAAAADuJ6AQ/original';

(async () => {
  const container = document.getElementById('J-container');
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
  });

  const downgrade = await getDowngradeResult('test');

  document.getElementById('J-downgradeResult')!.innerHTML = JSON.stringify(downgrade, undefined, 2);

  try {
    const scene = await player.loadScene(json, {
      pluginData: {
        downgrade,
      },
    });
  } catch (e: any) {
    console.error('biz', e);
    document.getElementById('J-errorMessage')!.innerHTML = JSON.stringify(e.message, undefined, 2);
    container!.innerHTML = `<img src="${imageUrl}" />`;
  }
})();
