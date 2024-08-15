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
    player.on('update', e => {
      document.getElementById('J-playerState')!.innerText = `player is ${e.playing ? 'playing' : 'paused'}`;
    });

    document.getElementById('J-pauseBtn')?.addEventListener('click', () => {
      player.pause();
    });
    document.getElementById('J-resumeBtn')?.addEventListener('click', () => {
      void player.resume();
    });

    await player.loadScene(json);
  } catch (e) {
    console.error('biz', e);
  }
})();
