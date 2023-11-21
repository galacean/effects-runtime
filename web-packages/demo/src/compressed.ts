import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.compressed.url;
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
      pixelRatio: window.devicePixelRatio,
    });

    await player.loadScene(json, {
      useCompressedTexture: true,
    });
  } catch (e) {
    console.error('biz', e);
  }
})();
