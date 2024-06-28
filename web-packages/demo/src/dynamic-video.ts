import { Player, TextComponent } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*kENFRbxlKcUAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    const composition = await player.loadScene(json, {
      variables: {
        video: 'https://gw.alipayobjects.com/v/huamei_p0cigc/afts/video/A*7gPzSo3RxlQAAAAAAAAAAAAADtN3AQ',
      },
    });

    const textItem = composition.getItemByName('text_3');
    const textComponent = textItem?.getComponent(TextComponent);

    textComponent?.setTextColor([255, 0, 0, 1]);
  } catch (e) {
    console.error('biz', e);
  }
})();
