import { Player, spec } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';
import { RichTextComponent, escape } from '@galacean/effects-plugin-rich-text';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*trEcQ7My81EAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const boldInput = prompt('请输入要加粗的文本') || '我是粗体字';
    const colorInput = prompt('请输入要加红色的文本') || '我是红色字';
    const italicInput = prompt('请输入要加斜体的文本') || '我是斜体字';

    const customText1 = `<b>${escape(colorInput)}</b>\n<color=#ef951aff>${escape(boldInput)}</color>\n<i>${escape(italicInput)}</i>`;
    const customText2 = `<b>${escape(colorInput)}\n<color=#ef951aff>${escape(boldInput)}\n<i>${escape(italicInput)}</i></color></b>`;

    const player = new Player({
      container,
    });

    const composition = await player.loadScene(json, {
      variables: {
        'richText_1': customText1,
      },
    });

    const text = composition.getItemByName('richText_1')?.getComponent(RichTextComponent);

    setTimeout(() => {
      text?.setOverflow(spec.TextOverflow.display);
      text?.setText(customText2);
    }, 2000);
  } catch (e) {
    console.error('biz', e);
  }
})();
