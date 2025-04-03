import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
import inspireList from './assets/inspire-list';

const json = inspireList.midAutumn;
// 'https://mdn.alipayobjects.com/mars/afts/file/A*vO0wT4S4shEAAAAAAAAAAAAAelB4AQ';
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
