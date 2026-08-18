import { Player, spec, TextComponent } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*USLUS5p9X0IAAAAAQoAAAAgAelB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });
    const composition = await player.loadScene(json, {
      variables: {
        'richText_15': '富文本：\n【<color=#e92929ff>Auto Height</color>】\n【<i>右对齐</i>】\n【<color=#add633ff>尺寸适配</color>】\n【<b><color=#cd15f4ff>居中对齐</color></b>】\n【<size=60>字号60</size>】',
      },
    });
    const item19 = composition.getItemByName('text_19')?.getComponent(TextComponent);
    const item10 = composition.getItemByName('richText_10')?.getComponent(RichTextComponent);
    const item8 = composition.getItemByName('richText_8')?.getComponent(RichTextComponent);

    item19?.setOutlineColor([0, 255, 0, 0.5]);
    item10?.setTextColor([255, 255, 0, 1]);
    item8?.setTextColor([255, 0, 0, 1]);
    item8?.setOverflow(spec.TextOverflow.visible);
    item8?.setTextAlign(spec.TextAlignment.left);
  } catch (e) {
    console.error('biz', e);
  }
})();
