import { Player, Transform } from '@galacean/effects';
import { createGridGeometry } from '@galacean/effects-plugin-editor-gizmo';
import { primaryJSON, sceneGeometry } from './assets';
import { attachEditor, GeometryGizmo3D, ShapeGizmo3D } from './editor';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), env: 'editor', interactive: true });
  const composition = await player.loadScene(JSON.parse(primaryJSON));
  const viewport = attachEditor(player, composition).editor3D;
  const grid = createGridGeometry(viewport.engine, 5, 10);

  for (const example of sceneGeometry) { new GeometryGizmo3D(viewport, example); }
  new ShapeGizmo3D(viewport, grid, new Transform({ rotation: [82, 0, 0] }), [1, 1, 1]);
})();
