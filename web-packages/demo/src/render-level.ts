import type { SceneRenderLevel } from '@galacean/effects';
import { Player, spec } from '@galacean/effects';
import { Stats } from '@galacean/effects-plugin-stats';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*GC99RbcyZiMAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');
const selectEle = document.getElementById('J-select') as HTMLSelectElement;

(async () => {
  try {
    let player = new Player({
      container,
    });

    new Stats(player);

    await player.loadScene(json, {
      renderLevel: spec.RenderLevel.B,
    });

    // 切换机型
    selectEle?.addEventListener('change', async () => {
      const renderLevel = selectEle.value as SceneRenderLevel;

      player.dispose();
      player = new Player({
        container,
      });
      new Stats(player);
      await player.loadScene(json, {
        renderLevel,
      });
    });
  } catch (e) {
    console.error('biz', e);
  }
})();
