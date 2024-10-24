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
      console.info(`[player click] - item [${e.name}] clicked.`);
    });
    player.on('message', e => {
      console.info(`[player message] - item [${e.name}] trigger message, type [${e.phrase}].`);
    });
    player.on('update', e => {
      document.getElementById('J-playerState')!.innerText = `[player update] - player is ${e.playing ? 'playing' : 'paused'}`;
    });
    player.on('pause', () => {
      console.info('[player pause] - player is paused.');
    });

    document.getElementById('J-pauseBtn')?.addEventListener('click', () => {
      player.pause();
    });
    document.getElementById('J-resumeBtn')?.addEventListener('click', () => {
      void player.resume();
    });

    const composition = await player.loadScene(json);
    const item = composition.getItemByName('lotteryBtn');

    item?.on('click', e => {
      console.info(`[item click] - item [${e.name}] clicked.`);
    });
  } catch (e) {
    console.error('biz', e);
  }
})();
