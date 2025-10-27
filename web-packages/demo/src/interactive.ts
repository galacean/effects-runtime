import { Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*2rNdR76aFvMAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
      interactive: true,
    });

    player.on('play', ({ time }) => {
      console.info(`[player play] - player started playing at ${time}`);
    });
    player.on('resume', () => {
      console.info('[player resume] - player resumed.');
    });
    player.on('click', e => {
      console.info(`[player click] - item [${e.name}] clicked.`);
    });
    player.on('pointerdown', e => {
      console.info(`[player pointerdown] - item [${e.pointerCurrentRaycast.item?.name}] pointerdown.`);
    });
    player.on('pointerup', e => {
      console.info(`[player pointerup] - item [${e.pointerCurrentRaycast.item?.name}] pointerup.`);
    });
    player.on('pointermove', e => {
      console.info('[player pointermove]', e.position, e.delta);
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

    composition.on('play', () => {
      console.info('[composition play] - composition started playing');
    });
    composition.on('pause', () => {
      console.info('[composition pause] - composition paused');
    });
    composition.on('click', e => {
      console.info(`[composition click] - item [${e.item?.name}] click.`);
    });
    composition.on('pointerdown', e => {
      console.info(`[composition pointerdown] - item [${e.pointerCurrentRaycast.item?.name}] pointerdown.`);
    });
    composition.on('pointerup', e => {
      console.info(`[composition pointerup] - item [${e.pointerCurrentRaycast.item?.name}] pointerup.`);
    });
    item?.on('click', e => {
      console.info(`[item click] - item [${e.name}] clicked.`);
    });
    item?.on('pointerdown', () => {
      console.info(`[item pointerdown] - item [${item.name}] clicked.`);
    });
    item?.on('pointerup', () => {
      console.info(`[item pointerup] - item [${item.name}] clicked.`);
    });
  } catch (e) {
    console.error('biz', e);
  }
})();
