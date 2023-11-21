import { Player } from '@galacean/effects';
import { simpleJSON } from './assets';

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    env: 'editor',
  });

  await player.loadScene(JSON.parse(simpleJSON));
})();
