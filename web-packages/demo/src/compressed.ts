import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-ktx2';
import '@galacean/effects-plugin-spine';
import '@galacean/effects-plugin-ffd';

const json_webp = 'https://mdn.alipayobjects.com/mars/afts/file/A*EItSRLgtjNUAAAAAQbAAAAgAelB4AQ';
const json_ktx2 = 'https://mdn.alipayobjects.com/mars/afts/file/A*zpJ1R7y9YX8AAAAAQcAAAAgAelB4AQ';
const json_ktx2_spine = 'https://mdn.alipayobjects.com/mars/afts/file/A*mTBPSqc6ckUAAAAAQaAAAAgAelB4AQ';

const container = document.getElementById('J-container');

const usektx2 = true;

(async () => {
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onError: (err, ...args) => {
      console.error('biz', err.message);
    },
  });

  if (usektx2) {
    await player.loadScene(json_ktx2, {
      useCompressedTexture: true,
    });
  } else {
    await player.loadScene(json_webp, {
      useCompressedTexture: false,
    });
  }

})();
