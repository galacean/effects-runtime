import { Player, spec } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*GC99RbcyZiMAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');
const selectEle = document.getElementById('J-select') as HTMLSelectElement;

(async () => {
  try {
    const player = new Player({
      container,
    });

    await player.loadScene(json, {
      renderLevel: spec.RenderLevel.B,
    });

    // 切换机型
    selectEle?.addEventListener('change', async () => {
      const renderLevel = selectEle.value as spec.RenderLevel;

      player.getCompositions().forEach(composition => composition.dispose());
      await player.loadScene(json, {
        renderLevel,
      });
    });
  } catch (e) {
    console.error('biz', e);
  }
})();
