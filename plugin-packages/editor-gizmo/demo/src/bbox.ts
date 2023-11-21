import { Player } from '@galacean/effects';
import { primaryJSON, bboxJSON } from './assets';

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    env: 'editor',
  });
  const json = JSON.parse(primaryJSON);

  json.compositions[0].items = JSON.parse(bboxJSON);
  const scene = await player.loadScene(json);
})();
