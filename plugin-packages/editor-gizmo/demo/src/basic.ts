import { Player } from '@galacean/effects';
import { primaryJSON, basicGeometry } from './assets';
import { attachEditor, GeometryGizmo3D } from './editor';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), renderFramework: 'webgl2', env: 'editor', interactive: true });
  const composition = await player.loadScene(JSON.parse(primaryJSON));
  const editor = attachEditor(player, composition);

  for (const example of basicGeometry) { editor.editor3D.sceneGizmos.push(new GeometryGizmo3D(editor.editor3D, example)); }
})();
