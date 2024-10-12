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
        video: 'https://mdn.alipayobjects.com/huamei_p0cigc/afts/file/A*ZOgXRbmVlsIAAAAAAAAAAAAADoB5AQ',
        text_3: 'Dynamic Video',
      },
    });

    const textItem = composition.getItemByName('text_3');
    const textComponent = textItem?.getComponent(TextComponent);

    textComponent?.setTextColor([255, 0, 0, 1]);
  } catch (e) {
    console.error('biz', e);
  }
})();
