import { createThreePlayer, renderbyThreeDisplayObject } from './common/three-display-object';
import inspireList from './assets/inspire-list';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*-C-CT4k3JWEAAAAAAAAAAAAADlB4AQ';
// const json = inspireList.WuFu1.url;

(async () => {
  const threePlayer = createThreePlayer({
    container: document.getElementById('J-container'),
    pixelRatio: window.devicePixelRatio,
  });

  void renderbyThreeDisplayObject(threePlayer, json);
})();
