import { Player, TextComponent } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*cUOFTpkoAf0AAAAAAAAAAAAADlB4AQ';
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
    const textItem = compostion.getItemByName('text_2');
    const textComponent = textItem?.getComponent(TextComponent);

    textComponent?.setTextColor([255, 0, 0, 1]);

    setTimeout(() => {
      textComponent?.setText('基于 Web\n效果丰富，氛围粒子、陀螺仪特效、3D 模型渲染\n100%还原');
    }, 1500);
  } catch (e) {
    console.error('biz', e);
  }
})();
