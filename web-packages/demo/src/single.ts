import { Player, SpriteComponent, Texture } from '@galacean/effects';
import inspireList from './assets/inspire-list';

const json = inspireList.wufu2022.url;
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*enfjQrKbio8AAAAAAAAAAAAADlB4AQ';

(async () => {
  try {
    const player = new Player({
      container: document.getElementById('J-container'),
    });

    // await player.loadScene(json);
    const comp = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*kJqJRIV7dyMAAAAAAAAAAAAADlB4AQ');

    const item = comp.getItemByName('sprite_1');
    // const sprite = item?.getComponent(SpriteComponent);
    // sprite?.setColor([1, 1, 0, 1]);
    // const texture = await Texture.fromURL('https://mdn.alipayobjects.com/mars/afts/img/A*ZbcvRItTn8AAAAAAAAAAAAAADlB4AQ/original', player.renderer.engine);

    // sprite?.setTexture(texture);
    // console.log('item', sprite);
    // player.gotoAndStop(0.5);
    // const item = comp.getItemByName('盖子');
  } catch (e) {
    console.error('biz', e);
  }
})();

