import { Player } from '@galacean/effects';
import { primaryJSON, basicJSON } from './assets';

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    renderFramework: 'webgl2',
  });
  const json = JSON.parse(primaryJSON);

  json.compositions[0].items = JSON.parse(basicJSON);
  const scene = await player.loadScene(json);
})();
