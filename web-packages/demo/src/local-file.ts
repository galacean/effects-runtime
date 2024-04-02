import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({ container });

    await player.loadScene('./assets/find-flower/flower.json');
  } catch (e) {
    console.error('biz', e);
  }
})();
