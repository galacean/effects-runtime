import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*vO0wT4S4shEAAAAAAAAAAAAAelB4AQ';
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
    interactive: true,
    onError: (err, ...args) => {
      console.error(err.message);
    },
  });

  await player.loadScene(json);

})();
