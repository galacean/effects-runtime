import type { JSONValue } from '@galacean/effects';
import { Player } from '@galacean/effects';
import type { GizmoVFXItem } from '@galacean/effects-plugin-editor-gizmo';
import '@galacean/effects-plugin-editor-gizmo';
import '@galacean/effects-plugin-model';
import test_scene from './json/wireframe-mode.json';

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    renderFramework: 'webgl2',
    interactive: true,
    env: 'editor',
    onItemClicked: e => {
      const { player, id } = e;
      const composition = player.getCompositions()[0];
      const item = composition.items.find(item => item.id === String(id)) as GizmoVFXItem;

      console.info('itemId: ' + item.id);
      console.info('hitBoundingKey: ' + item.hitBounding?.key);
    },
  });

  await player.loadScene(test_scene as unknown as JSONValue);
})();
