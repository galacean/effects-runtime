import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({ container });

    const comp = await player.loadScene('./assets/find-flower/flower.json');

    comp.gotoAndPlay(4);

    comp.setSpeed(-1);
  } catch (e) {
    console.error('biz', e);
  }
})();
