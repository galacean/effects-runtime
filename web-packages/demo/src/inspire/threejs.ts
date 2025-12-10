// @ts-nocheck
import { registerPlugin, Plugin, isWebGL2 } from '@galacean/effects-threejs';
import { createThreePlayer, renderbyThreeDisplayObject } from '../common/three-display-object';

// 假装注册陀螺仪插件，兼容有陀螺仪的合成报错
registerPlugin('orientation-transformer', Plugin);

const container = document.getElementById('J-container');
let player;

window.addEventListener('message', async event => {
  const { type, json, playerOptions } = event.data;

  switch (type) {
    case 'init': {
      player = createThreePlayer({
        container,
        ...playerOptions,
      });

      break;
    }
    case 'play': {
      console.debug(`effects-threejs 渲染模式：${isWebGL2(player.renderer.getContext()) ? 'webgl2' : 'webgl'}`);
      void renderbyThreeDisplayObject(player, json);

      break;
    }
    case 'pause': {
      player.pause();

      break;
    }
    case 'resume': {
      player.resume();

      break;
    }
  }
});
