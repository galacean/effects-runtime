import { Player } from '@galacean/effects';
import { primaryJSON, sceneJSON } from './assets';
import { GizmoComponent } from '@galacean/effects-plugin-editor-gizmo';

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    env: 'editor',
    interactive: true,
  });

  player.on('item-click', e => {
    const { player, id } = e;
    const composition = player.getCompositions()[0];
    const item = composition.items.find(item => item.id === String(id))!;

    console.info('itemId: ' + item.id);
    console.info('hitBoundingKey: ' + item.getComponent(GizmoComponent)?.hitBounding?.key);
  });

  const json = JSON.parse(primaryJSON);

  json.compositions[0].items = JSON.parse(sceneJSON);
  await player.loadScene(json);
})();
