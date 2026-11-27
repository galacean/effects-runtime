import { Player } from '@galacean/effects';
import { ModelWireframeRenderer } from '../../../model/demo/src/wireframe';
import { attachEditor } from './editor';
import { loadModelScene } from './model-scene';

(async () => {
  const player = new Player({ container: document.getElementById('J-container'), renderFramework: 'webgl2', interactive: true, env: 'editor' });
  const composition = await loadModelScene(player, true);
  const wireframe = new ModelWireframeRenderer();

  attachEditor(player, composition);
  player.renderer.addRendererFeature(wireframe);
  wireframe.setScene(composition, true);
})();
