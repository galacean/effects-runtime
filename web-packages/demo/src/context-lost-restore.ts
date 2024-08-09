import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.book.url;
const container = document.getElementById('J-container');
const lostButton = document.getElementById('J-lost') as HTMLButtonElement;
const restoreButton = document.getElementById('J-restore') as HTMLButtonElement;
const memoryButton = document.getElementById('J-memory') as HTMLButtonElement;
const gpuTimes: number[] = [];
let gpuFrame = 0;
let max = 0;
let isWebGLLost = false;
let allocateTimeout: any;

(async () => {
  try {
    const player = createPlayer();
    const scene = await player.loadScene(json);

    player.on('webglcontextlost', e => {
      console.info('WEBGL_CONTEXT_LOST', e);
    });
    player.on('webglcontextrestored', () => {
      console.info('WEBGL_CONTEXT_RESTORED');
    });
    scene.onEnd = () => {
      document.getElementById('J-gpuInfo')!.innerText = `
        frame: ${gpuFrame}
        gpu avg: ${(gpuTimes.reduce((x, y) => { return x + y; }, 0) / gpuFrame).toFixed(2)}ms
        gpu max: ${max.toFixed(2)}ms`;

    };

    player.canvas.addEventListener('webglcontextlost', e => {
      isWebGLLost = true;
      if (allocateTimeout) {
        window.clearTimeout(allocateTimeout);
        allocateTimeout = null;
      }
    });
    player.canvas.addEventListener('webglcontextrestored', e => {
      isWebGLLost = false;
    });

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

    memoryButton?.addEventListener('click', () => {
      void allocateMemoryForLost(gl);
    });
  } catch (e) {
    console.info(e);
  }
})();

function createPlayer () {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    reportGPUTime: (time: number) => {
      gpuTimes.push(time);
      gpuFrame++;
      max = Math.max(time, max);
    },
  });

  player.on('webglcontextlost', e => {
    console.info('trigger onWebGLContextLost set by user');
  });
  player.on('webglcontextrestored', () => {
    console.info('trigger onWebGLContextRestored set by user');
  });

  return player;
}

const texSize = 8192;
const texData = new Uint8Array(texSize * texSize * 4);

async function allocateMemoryForLost (gl: WebGLRenderingContext) {
  if (!isWebGLLost) {
    allocateTextureMemory(gl, 500);
    allocateTimeout = setTimeout(() => { memoryButton.click(); }, 3000);
  }
}

function allocateTextureMemory (gl: WebGLRenderingContext, count: number) {
  console.info('allocateTextureMemory', count);
  for (let i = 0; i < count; i++) {
    if (isWebGLLost) {
      break;
    }
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize, texSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
  }
}
