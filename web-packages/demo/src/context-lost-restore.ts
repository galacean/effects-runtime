import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.book.url;
const container = document.getElementById('J-container');
const lostButton = document.getElementById('J-lost') as HTMLButtonElement;
const restoreButton = document.getElementById('J-restore') as HTMLButtonElement;
const gpuTimes: number[] = [];
let gpuFrame = 0;
let max = 0;

(async () => {
  try {
    const player = createPlayer();

    const scene = await player.loadScene(json);

    scene.handleEnd = () => {
      document.getElementById('J-gpuInfo')!.innerText = `
        frame: ${gpuFrame}
        gpu avg: ${(gpuTimes.reduce((x, y) => { return x + y; }, 0) / gpuFrame).toFixed(2)}ms
        gpu max: ${max.toFixed(2)}ms`;

    };

    //@ts-expect-error
    const gl = player.renderer.glRenderer.gl;
    const ext = gl.getExtension('WEBGL_lose_context');

    lostButton?.addEventListener('click', () => {
      ext?.loseContext();
      lostButton.disabled = true;
      restoreButton.disabled = false;
    });

    restoreButton?.addEventListener('click', () => {
      ext?.restoreContext();
      lostButton.disabled = false;
      restoreButton.disabled = true;
    });
  } catch (e) {
    console.info(e);
  }
})();

function createPlayer () {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onWebGLContextLost: () => {
      console.info('trigger onWebGLContextLost set by user');
    },
    onWebGLContextRestored: () => {
      console.info('trigger onWebGLContextRestored set by user');
    },
    reportGPUTime: (time: number) => {
      gpuTimes.push(time);
      gpuFrame++;
      max = Math.max(time, max);
    },
  });

  return player;
}
