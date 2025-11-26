import { Player, spec } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*Aqq2S5MW5m8AAAAAQQAAAAgAelB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });
    const composition = await player.loadScene(json, {
      variables: {
      },
    });

  } catch (e) {
    console.error('biz', e);
  }
})();
