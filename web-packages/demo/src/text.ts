import { Player, TextComponent } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*NYWHSYcgzJkAAAAAQfAAAAgAelB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    const compostion = await player.loadScene(json, {
      variables: {
        text_1: 'Galacean Effects'.toLocaleUpperCase().split('').reverse().join(''),
      },
    });
    const textItem = compostion.getItemByName('text_3');
    const textComponent = textItem?.getComponent(TextComponent);

    //textComponent?.setTextColor([255, 0, 0, 1]);
    textComponent?.setOutlineEnabled(true);
    textComponent?.setOutlineWidth(0);
    textComponent?.setOutlineColor([0, 255, 255, 1]);

  } catch (e) {
    console.error('biz', e);
  }
})();
