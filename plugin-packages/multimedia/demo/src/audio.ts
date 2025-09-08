import { Asset, Player } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';
import { AudioComponent, checkAutoplayPermission, loadAudio } from '@galacean/effects-plugin-multimedia';

const json = '/assets/audio.json';
const container = document.getElementById('J-container');
const addButton = document.getElementById('J-add');
const updateButton = document.getElementById('J-update');
const inputEle = document.getElementById('J-input') as HTMLInputElement;
let player: Player;

(async () => {
  try {
    player = new Player({
      container,
    });

    await checkAutoplayPermission();

    await player.loadScene(json, { autoplay:true }).then(()=>{
      // debugger
      player.gotoAndPlay(3);
      setTimeout(() => {
        player.pause();
      }, 1000);

      setTimeout(() => {
        void player.resume();
      }, 2000);
    });
  } catch (e) {
    console.error('biz', e);
  }
})();

addButton?.addEventListener('click', async () => {
  const value = inputEle.value;

  if (value) {
    const item = player.getCompositionByName('comp1')?.getItemByName('video');
    const audio = await loadAudio(value);
    const audioAsset = new Asset<HTMLAudioElement | AudioBuffer>(player.renderer.engine);

    audioAsset.data = audio;

    if (!item) {
      return;
    }
    const audioComponent = item.addComponent(AudioComponent);

    audioComponent.item = item;
    audioComponent.fromData({
      options: {
        //@ts-expect-error
        audio: audioAsset,
      },
    });
  }
});

updateButton?.addEventListener('click', async () => {
  const value = inputEle.value;

  if (value) {
    const audioComponent = player
      .getCompositionByName('comp1')
      ?.getItemByName('audio')
      ?.getComponent(AudioComponent);

    if (audioComponent) {
      audioComponent.setAudioSource(await loadAudio(value));
    }
  }
});
