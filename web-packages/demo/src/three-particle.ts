import { createThreePlayer, renderbyThreeDisplayObject } from './common/three-display-object';
import inspireList from './assets/inspire-list';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*2rNdR76aFvMAAAAAAAAAAAAADlB4AQ';

(async () => {
  const threePlayer = createThreePlayer({
    container: document.getElementById('J-container'),
    pixelRatio: window.devicePixelRatio,
  });

  void renderbyThreeDisplayObject(threePlayer, json);
})();
