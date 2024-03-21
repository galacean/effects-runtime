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
    const label = document.createElement('label');

    label.innerText = JSON.stringify(downgrade, undefined, 2);
    document.body.appendChild(label);
  } catch (e) {
    console.error('biz', e);
    // @ts-expect-error
    container.innerHTML = `<img src="${imageUrl}" />`;

    const label = document.createElement('label');

    label.innerText = JSON.stringify(downgrade, undefined, 2);
    const labelMessage = document.createElement('label');

    // @ts-expect-error
    labelMessage.innerText = JSON.stringify(e.message, undefined, 2);
    container?.appendChild(label);
    container?.appendChild(document.createElement('br'));
    container?.appendChild(labelMessage);
  }
})();
