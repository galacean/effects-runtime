import { Player } from '@galacean/effects';
import type { GizmoVFXItem } from '@galacean/effects-plugin-editor-gizmo';
import { primaryJSON, gizmoJSON } from './assets';

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
  const json = JSON.parse(primaryJSON);

  json.compositions[0].items = JSON.parse(gizmoJSON);
  await player.loadScene(json);
})();
