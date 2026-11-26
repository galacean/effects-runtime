import { Player, Transform, glContext } from '@galacean/effects';
import { createGeometry, GeometryType } from '@galacean/effects-plugin-editor-gizmo';
import { createShapeGeometry } from '../../src/3d/shape';
import { primaryJSON } from './assets';
import { attachEditor, ShapeGizmo3D } from './editor';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), env: 'editor', interactive: true });
  const composition = await player.loadScene(JSON.parse(primaryJSON));
  const viewport = attachEditor(player, composition).editor3D;
  const transform = new Transform({ rotation: [0, 45, 45] });
  const size = { width: 1, height: 1, depth: 1 };
  const box = createGeometry(viewport.engine, GeometryType.Box, size, glContext.TRIANGLES);
  const outline = createShapeGeometry(viewport.engine, { shape: 'Box', ...size, center: [0, 0.5, 0] });

  viewport.sceneGizmos.push(
    new ShapeGizmo3D(viewport, box, transform, [0, 0, 0]),
    new ShapeGizmo3D(viewport, outline, transform, [1, 1, 0]),
  );
})();
