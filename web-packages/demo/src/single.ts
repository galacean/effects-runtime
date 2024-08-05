import { Player, EffectEventName } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*bl40RLWLKisAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
      interactive: true,
    });

    const composition = await player.loadScene(json);

    // player.once(EffectEventName.ITEM_CLICK, item => {
    //   console.log('item', item);
    // });
    player.on(EffectEventName.ITEM_CLICK, item => {
      console.info('first item', item);
    });

    player.on(EffectEventName.ITEM_MESSAGE, message => {
      console.info('message', message);
    });

    composition.on(EffectEventName.COMPOSITION_END, e => {
      console.info('composition end', e);
    });

    const name = composition.getItemByName('interact_232');

    name?.on(EffectEventName.ITEM_CLICK, item => {
      console.info('name item', item);
    });

  } catch (e) {
    console.error('biz', e);
  }
})();
