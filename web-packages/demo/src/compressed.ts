import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.compressed.url;
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onError: (err, ...args) => {
      console.error('biz', err.message);
    },
  });

  await player.loadScene(json, {
    useCompressedTexture: true,
  });
})();
