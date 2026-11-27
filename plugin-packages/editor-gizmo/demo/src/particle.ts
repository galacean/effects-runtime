import { Player } from '@galacean/effects';
import { particleJSON } from './assets';
import { attachEditor, showEmitters } from './editor';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), env: 'editor', interactive: true });
  const composition = await player.loadScene(JSON.parse(particleJSON));
  const editor = attachEditor(player, composition);

  showEmitters(editor, composition);
})();
