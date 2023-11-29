import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import { inspectLogger } from '@galacean/effects-plugin-alipay-downgrade';
import inspireList from './assets/inspire-list';

inspectLogger();
const json = inspireList.mask.url;
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json);
    const item = comp.getItemByName('mask');

  } catch (e) {
    console.error('biz', e);
  }
})();

function createPlayer () {
  const player = new Player({
    container,
    interactive: true,
    // renderFramework: 'webgl',
    env: 'editor',
    notifyTouch: true,
    onPausedByItem: data => {
      console.info('onPausedByItem', data);
    },
    onItemClicked: () => {

    },
    // reportGPUTime: console.debug,
  });

  return player;
}
