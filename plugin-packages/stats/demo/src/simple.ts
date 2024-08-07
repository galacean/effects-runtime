import { Player } from '@galacean/effects';
import { Stats } from '@galacean/effects-plugin-stats';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*inNFR7AzLMAAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    new Stats(player);

    await player.loadScene(json);
    await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*PtWTT7WcpHgAAAAAAAAAAAAADlB4AQ');
    await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*02UWQ6BvLuAAAAAAAAAAAAAADlB4AQ');
    await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*aCeuQ5RQZj4AAAAAAAAAAAAADlB4AQ');
  } catch (e) {
    console.error('biz', e);
  }
})();
