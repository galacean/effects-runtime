import { EffectEventName, Player } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*GpjhQKmxI1MAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
      interactive: true,
      onItemClicked: item => {
        console.log('onItemClicked', item);
      },
    });

    const composition = await player.loadScene(json);
    // player.once(EffectEventName.ITEM_CLICK, item => {
    //   console.log('item', item);
    // });
    player.on(EffectEventName.ITEM_CLICK, item => {
      console.log('first item', item);
    });

    composition.on(EffectEventName.COMPOSITION_END, (e) => {
      console.log('composition end', e);
    })

    const name = composition.getItemByName('interact_232');
    name?.on(EffectEventName.ITEM_CLICK, item => {
      console.log('name item', item);
    });

  } catch (e) {
    console.error('biz', e);
  }
})();
