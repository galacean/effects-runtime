import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-editor-gizmo';
import '@galacean/effects-plugin-model';
import test_scene from './json/wireframe-mode.json';
import { GizmoComponent } from '@galacean/effects-plugin-editor-gizmo';

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    renderFramework: 'webgl2',
    interactive: true,
    env: 'editor',
    onItemClicked: e => {
      const { player, id } = e;
      const composition = player.getCompositions()[0];
      const item = composition.items.find(item => item.id === String(id))!;

      console.info('itemId: ' + item.id);
      console.info('hitBoundingKey: ' + item.getComponent(GizmoComponent)?.hitBounding?.key);
    },
  });

  await player.loadScene(test_scene);
})();
