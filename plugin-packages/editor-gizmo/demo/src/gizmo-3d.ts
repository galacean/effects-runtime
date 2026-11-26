import { Player } from '@galacean/effects';
import { attachEditor } from './editor';
import { loadModelScene } from './model-scene';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), renderFramework: 'webgl2', interactive: true, env: 'editor' });
  const composition = await loadModelScene(player);

  attachEditor(player, composition);
})();
