import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-orientation-transformer';

const json = 'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/TCFWNOIAYQRL/-891621161-b18e1.json';
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
  });

  await player.loadScene(json);
})();
