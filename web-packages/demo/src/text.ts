import { Player, TextComponent } from '@galacean/effects';

const json = 'https://g.alicdn.com/ani-assets/5bcd4da9b51e051c3422bdbcee7fa4ff/0.0.1/mars.json';
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
    const textItem = compostion.getItemByName('text_1');
    const textComponent = textItem?.getComponent(TextComponent);

    textComponent?.setTextColor([255, 0, 0, 1]);

    let lotteryTimes = 999;

    textComponent?.setText(`${lotteryTimes}`); // 设置初始值

    const timer = setInterval(() => {
      lotteryTimes += 1;
      textComponent?.setText(`${lotteryTimes}`);
    }, 1000); // 每秒增加1
  } catch (e) {
    console.error('biz', e);
  }
})();
