import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-orientation-transformer';
import { compatibleCalculateItem } from '../common/utils';

const container = document.getElementById('J-container');
let player: Player;

window.addEventListener('message', async event => {
  const { type, json, playerOptions, currentTime, speed } = event.data;

  switch (type) {
    case 'init': {
      player = new Player({
        container,
        ...playerOptions,
        onItemClicked: item => console.info(`item ${item.name} has been clicked`, item),
      });

      break;
    }
    case 'play': {
      player.destroyCurrentCompositions();
      const scene = await player.loadScene(json, {
        autoplay: false,
        speed,
      });

      console.debug(`player 渲染模式：${player.renderer.engine.gpuCapability.type}`);
      compatibleCalculateItem(scene);
      void player.gotoAndPlay(currentTime);

      break;
    }
    case 'pause': {
      if (player.hasPlayable) {
        player.pause();
      }

      break;
    }
    case 'resume': {
      void player.resume();

      break;
    }
  }
});
