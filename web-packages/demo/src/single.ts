import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.applause.url;

(async () => {
  try {
    const player = new Player({
      container: document.getElementById('J-container'),
    });

    const comp = await player.loadScene(json);

    player.gotoAndStop(0.5);
    const item = comp.getItemByName('盖子');

  } catch (e) {
    console.error('biz', e);
  }
})();

