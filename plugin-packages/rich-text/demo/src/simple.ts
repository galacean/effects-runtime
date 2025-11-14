import { Player, spec } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*trEcQ7My81EAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });
    const composition = await player.loadScene(json, {
      variables: {
        richText_1: '<color=red>Galacean\nEffects\n\n富文11本</color>',
      },
    });

  } catch (e) {
    console.error('biz', e);
  }
})();
