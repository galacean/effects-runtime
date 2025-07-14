import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-rich-text';

const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/ILDKKFUFMVJA/1705406034-80896.json';
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
    interactive: true,
    transparentBackground: true,
    onError: (err, ...args) => {
      console.error(err.message);
    },
  });

  const [_, card] = await player.loadScene([
    json,
    {
      url: 'https://mdn.alipayobjects.com/mars/afts/file/A*u-NFTK_DS0IAAAAAAAAAAAAAelB4AQ',
      options: {
        autoplay: false,
      },
    },
  ]);

  card.translateByPixel(0, -100);
  card.setRotation(0, 30, 0);
  card.play();

  // 改为点击触发即可
  setTimeout(async () => {
    const composition = await player.loadScene({
      url: 'https://mdn.alipayobjects.com/mars/afts/file/A*k6vyTpyAkykAAAAARYAAAAgAelB4AQ',
      options: {
        autoplay: false,
      },
    });

    composition.setPosition(0, -5, 0);
    composition.play();
  }, 3000);
})();
