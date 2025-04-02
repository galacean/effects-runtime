import { createThreePlayer, renderbyThreeDisplayObject } from './common/three-display-object';
import inspireList from './assets/inspire-list';

const json = inspireList.woman.url;

(async () => {
  const threePlayer = createThreePlayer({
    container: document.getElementById('J-container'),
    pixelRatio: window.devicePixelRatio,
  });

  void renderbyThreeDisplayObject(threePlayer, [
    json,
    'https://mdn.alipayobjects.com/mars/afts/file/A*u-NFTK_DS0IAAAAAAAAAAAAAelB4AQ',
    'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*qTquTKYbk6EAAAAAAAAAAAAADsF2AQ',
  ]);
})();
