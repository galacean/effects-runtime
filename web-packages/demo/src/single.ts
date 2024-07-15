import { Player, PlayerEffectEventName } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*iBwcRJO5U9gAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
      interactive: true,
      onItemClicked: item => {
        console.info('onItemClicked', item);
      },
    });

    const composition = await player.loadScene(json);

    // player.once(EffectEventName.ITEM_CLICK, item => {
    //   console.log('item', item);
    // });
    player.on(PlayerEffectEventName.ITEM_CLICK, item => {
      console.info('first item', item);
    });

    composition.on(PlayerEffectEventName.COMPOSITION_END, e => {
      console.info('composition end', e);
    });

    const name = composition.getItemByName('interact_232');

    name?.on(PlayerEffectEventName.ITEM_CLICK, item => {
      console.info('name item', item);
    });

  } catch (e) {
    console.error('biz', e);
  }
})();
