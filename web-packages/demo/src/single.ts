import { EventEmitter, Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-model';
import inspireList from './assets/inspire-list';

// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*GsUXQJUTRqoAAAAAAAAAAAAADlB4AQ';
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*Wu__ToIiGLkAAAAAAAAAAAAADlB4AQ';

const container = document.getElementById('J-container');

(async () => {
  try {
    const player = createPlayer();

    const comp = await player.loadScene(json, {
    // autoplay: false,
    });

    comp.onEnd = () => {
      // console.log('end');
    };

    const event = new EventEmitter();

    //@ts-expect-error
    event.on('TEXT', prop => {
      console.info('text....');
      console.info('====', prop.a);
      console.info('====', prop.b);
    });

    event.emit('TEXT', {
      a: 'abc',
      b: 'bac',
    });

    // player.gotoAndStop(0);
  } catch (e) {
    console.error('biz', e);
  }
})();

function createPlayer () {
  const player = new Player({
    container,
    interactive: true,
    onPlayableUpdate: ({ player, playing }) => {
    },
    // renderFramework: 'webgl',
    env: 'editor',
    notifyTouch: true,
    onPausedByItem: data => {
      console.info('onPausedByItem', data);
    },
    onItemClicked: data => {
      console.info(`item ${data.name} has been clicked`);
    },
    // reportGPUTime: console.debug,
  });

  return player;
}

// dat gui 参数及修改
function setDatGUI () {
  // const gui = new dat.GUI();
}
