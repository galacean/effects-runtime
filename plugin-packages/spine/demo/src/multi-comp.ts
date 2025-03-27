import type { Composition } from '@galacean/effects';
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-orientation-transformer';

const startEle = document.getElementById('J-start')!;
const pauseEle = document.getElementById('J-pause')!;
const multiEle = document.getElementById('J-multi')!;
const jsonList = [
  'https://mdn.alipayobjects.com/mars/afts/file/A*rYpQSo4PD6YAAAAAAAAAAAAAelB4AQ',
  'https://mdn.alipayobjects.com/mars/afts/file/A*6fYqTZWauTkAAAAAAAAAAAAADlB4AQ',
  'https://mdn.alipayobjects.com/mars/afts/file/A*zLD0TY-GQ2cAAAAAAAAAAAAAelB4AQ',
];

(async () => {
  try {
    await start();
  } catch (e) {
    console.error(e);
  }
})();

async function start () {
  let currentIndex = 0;
  const player = new Player({
    container: document.getElementById('J-container'),
    pixelRatio: 2,
    interactive: true,
  });

  player.on('pause', () => {
    console.info('Player paused');
  });
  const comps: Composition[] = await player.loadScene(jsonList, {
    reusable: true,
    autoplay:false,
  }) as unknown as Composition[];

  pauseEle.onclick = () => {
    player.pause();
  };

  startEle.onclick = () => {
    void player.resume();
  };

  multiEle.onclick = () => {
    comps[currentIndex++].play();
    currentIndex %= jsonList.length;
  };

  window.addEventListener('unload', () => {
    player.dispose();
  });
}
