import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-editor-gizmo';
import '@galacean/effects-plugin-model';
import test_scene from './json/wireframe-mode.json';
import { GizmoComponent } from '@galacean/effects-plugin-editor-gizmo';
import { JSONConverter } from '@galacean/effects-plugin-model';

(async () => {
  const player = new Player({
    container: document.getElementById('J-container'),
    renderFramework: 'webgl2',
    interactive: true,
    env: 'editor',
  });

  player.on('click', e => {
    const { player, id } = e;
    const composition = player.getCompositions()[0];
    const item = composition.items.find(item => item.id === String(id))!;

    console.info('itemId: ' + item.id);
    console.info('hitBoundingKey: ' + item.getComponent(GizmoComponent)?.hitBounding?.key);
  });
  const converter = new JSONConverter(player.renderer);
  const scene = await converter.processScene(test_scene);

  await player.loadScene(scene);
})();
