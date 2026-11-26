import { glContext, Player, Transform } from '@galacean/effects';
import { createGeometry, GeometryType } from '@galacean/effects-plugin-editor-gizmo';
import { primaryJSON, sceneGeometry } from './assets';
import { attachEditor, GeometryGizmo3D, ShapeGizmo3D } from './editor';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), env: 'editor', interactive: true });
  const composition = await player.loadScene(JSON.parse(primaryJSON));
  const viewport = attachEditor(player, composition).editor3D;
  const grid = createGeometry(viewport.engine, GeometryType.FloorGrid, { sideLength: 5, parts: 10 }, glContext.LINES);

  for (const example of sceneGeometry) { viewport.sceneGizmos.push(new GeometryGizmo3D(viewport, example)); }
  viewport.sceneGizmos.push(new ShapeGizmo3D(viewport, grid, new Transform({ rotation: [82, 0, 0] }), [1, 1, 1]));
})();
