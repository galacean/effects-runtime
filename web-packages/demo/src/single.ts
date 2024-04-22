import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

// 滤镜
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*9IytQIW9BIMAAAAAAAAAAAAADlB4AQ';
// 粒子滤镜
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*rEYJT47ECfwAAAAAAAAAAAAADlB4AQ';

(async () => {
  try {
    const player = new Player({
      container: document.getElementById('J-container'),
    });

    // await player.loadScene(json);
    const comp = await player.loadScene(json);

    // player.gotoAndStop(0.5);
    // const item = comp.getItemByName('盖子');
  } catch (e) {
    console.error('biz', e);
  }
})();

