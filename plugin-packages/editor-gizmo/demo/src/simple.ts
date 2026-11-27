import { Player } from '@galacean/effects';
import { simpleJSON } from './assets';
import { attachEditor, showEmitters } from './editor';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), env: 'editor', interactive: true });
  const composition = await player.loadScene(JSON.parse(simpleJSON));
  const editor = attachEditor(player, composition);

  showEmitters(editor, composition);
})();
