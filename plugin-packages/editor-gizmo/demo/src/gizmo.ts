import { Player } from '@galacean/effects';
import { transformGizmoScene } from './assets';
import { attachEditor } from './editor';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), renderFramework: 'webgl2', interactive: true, env: 'editor' });
  const composition = await player.loadScene(JSON.parse(transformGizmoScene));

  attachEditor(player, composition);
})();
