import { Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*aCeuQ5RQZj4AAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

const button = document.createElement('button');

document.body.appendChild(button);

button.innerHTML = 'Loading';

(async () => {
  try {
    const player = new Player({
      container,
      env:'editor',
    });

    const comp = await player.loadScene(json, { autoplay:true });

    player.interactive = true;
    button.innerHTML = 'Play';
    button.onclick = ()=>{
      comp.play();
    };
  } catch (e) {
    console.error('biz', e);
  }
})();
