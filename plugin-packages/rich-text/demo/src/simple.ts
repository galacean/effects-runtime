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
        'richText_1': '<color=#ef951aff>Galacean\nEffects\n\n富文本</color>',
      },
    });
    const text = composition.getItemByName('richText_1')?.getComponent(RichTextComponent);

    setTimeout(() => {
      text?.setOverflow(spec.TextOverflow.display);
      text?.setText('<color=#ef951aff>Galacean</color> <b>Effects</b>\n<color=#00ff00ff><i>富文本</i></color>');
    }, 2000);
  } catch (e) {
    console.error('biz', e);
  }
})();
