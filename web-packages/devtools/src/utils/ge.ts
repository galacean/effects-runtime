import { Player } from '@galacean/effects';

export async function initGEPlayer (canvas: HTMLCanvasElement) {
  const player = createPlayer(canvas);
  // console.log(canvas)

  const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*oF1NRJG7GU4AAAAAAAAAAAAADlB4AQ');
}

function createPlayer (canvas: HTMLCanvasElement) {
  const player = new Player({
    canvas,
    interactive: true,
    // renderFramework: 'webgl',
    // env: 'editor',
    notifyTouch: true,
    // onPausedByItem: (data) => {
    // console.info('onPausedByItem', data);
    // },
    // onItemClicked: (data) => {
    // console.info(`item ${data.name} has been clicked`);
    // },
    // reportGPUTime: console.debug,
  });

  return player;
}
