import { Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*PubBSpHUbjYAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
    onError: (err, ...args) => {
      console.error('biz', err.message);
    },
  });

  await player.loadScene(json, {
    variables: {
      image: 'https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*ySrfRJvfvfQAAAAAAAAAAAAADvV6AQ/original',
    },
  });
})();
