import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*vO0wT4S4shEAAAAAAAAAAAAAelB4AQ';
// const jsons = [
//   'https://gw.alipayobjects.com/os/gltf-asset/mars-cli/ILDKKFUFMVJA/1705406034-80896.json',
//   'https://mdn.alipayobjects.com/mars/afts/file/A*2rNdR76aFvMAAAAAAAAAAAAADlB4AQ',
//   'https://mdn.alipayobjects.com/mars/afts/file/A*u-NFTK_DS0IAAAAAAAAAAAAAelB4AQ',
//   {
//     url: 'https://mdn.alipayobjects.com/mars/afts/file/A*2rNdR76aFvMAAAAAAAAAAAAADlB4AQ',
//     options: {
//       autoplay: true,
//     },
//   },
//   {
//     url: 'https://mdn.alipayobjects.com/mars/afts/file/A*u-NFTK_DS0IAAAAAAAAAAAAAelB4AQ',
//     options: {
//       autoplay: false,
//     },
//   },
//   'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*qTquTKYbk6EAAAAAAAAAAAAADsF2AQ',
// ];
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
