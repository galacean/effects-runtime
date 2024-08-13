import { Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*2rNdR76aFvMAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
      interactive: true,
    });

    player.on('click', e => {
      console.info(`item [${e.name}] clicked.`);
    });
    player.on('message', e => {
      console.info(`item [${e.name}] trigger message, type [${e.phrase}].`);
    });

    await player.loadScene(json);
  } catch (e) {
    console.error('biz', e);
  }
})();
