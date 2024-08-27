import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-orientation-transformer';
const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/GRPXATAUECLT/49510158-65ef1.json';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    await player.loadScene(json);
  } catch (e) {
    console.error('biz', e);
  }
})();
