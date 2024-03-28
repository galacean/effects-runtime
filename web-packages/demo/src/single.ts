import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.applause.url;

(async () => {
  try {
    const player = new Player({
      container: document.getElementById('J-container'),
    });

    await player.loadScene(json);
  } catch (e) {
    console.error('biz', e);
  }
})();

