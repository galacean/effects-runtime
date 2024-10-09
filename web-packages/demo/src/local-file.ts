import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({ container });
    const composition = await player.loadScene('/assets/find-flower/flower.json');

    setTimeout(() => {
      composition.setSpeed(-1);
      composition.gotoAndPlay(3);
    }, 5000);
  } catch (e) {
    console.error('biz', e);
  }
})();
