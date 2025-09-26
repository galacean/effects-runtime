import type { Texture2DSourceOptionsVideo } from '@galacean/effects';
import { Asset, Player, Texture, spec } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';
import { checkAutoplayPermission, VideoComponent } from '@galacean/effects-plugin-multimedia';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*dyZDQKl9KMMAAAAAQDAAAAgAelB4AQ';
let player: Player;
const container = document.getElementById('J-container');
const addButton = document.getElementById('J-add');
const updateButton = document.getElementById('J-update');
const inputEle = document.getElementById('J-input') as HTMLInputElement;

(async () => {
  try {
    player = new Player({
      container,
      fps: 130,
      onError (e) {
        console.error(e.cause, e);
      },
    });

    await checkAutoplayPermission();

    await player.loadScene(json, { renderLevel: spec.RenderLevel.B });
  } catch (e) {
    console.error('biz', e);
  }
})();

addButton?.addEventListener('click', async () => {
  const value = inputEle.value;

  if (value) {
    const item = player.getCompositionByName('新建合成3')?.getItemByName('video_6');
    const texture = await Texture.fromVideo(value, player.renderer.engine);

    if (!item) { return; }

    const videoComponent = item.addComponent(VideoComponent);

    item.composition?.textures.push(texture);
    videoComponent.item = item;
    const videoAsset = new Asset(item.engine);

    videoAsset.data = (texture.source as Texture2DSourceOptionsVideo).video;

    videoComponent.fromData({
      options: {
        //@ts-expect-error
        video: videoAsset,
      },
      renderer: {
        texture,
      },
    });
  }
});

updateButton?.addEventListener('click', async () => {
  const value = inputEle.value;

  if (value) {
    const videoItem = player.getCompositionByName('新建合成3')?.getItemByName('video_6');

    if (videoItem) {
      const videoComponent = videoItem.getComponent(VideoComponent);

      await videoComponent.setTexture(value);
    }
  }
});
