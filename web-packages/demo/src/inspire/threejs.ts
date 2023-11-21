// @ts-nocheck
import { registerPlugin, AbstractPlugin, VFXItem, isWebGL2 } from '@galacean/effects-threejs';
import { createThreePlayer, renderbyThreeDisplayObject } from '../common/three-display-object';

// 假装注册陀螺仪插件，兼容有陀螺仪的合成报错
registerPlugin('orientation-transformer', AbstractPlugin, VFXItem);

const container = document.getElementById('J-container');
let player;

window.addEventListener('message', async event => {
  const { type, json, playerOptions } = event.data;

  switch (type) {
    case 'init': {
      player = createThreePlayer({
        container,
        ...playerOptions,
        onItemClicked: item => console.info(`item ${item.name} has been clicked`, item),
      });

      break;
    }
    case 'play': {
      console.debug(`effects-threejs 渲染模式：${isWebGL2(player.renderer.getContext()) ? 'webgl2' : 'webgl'}`);
      void renderbyThreeDisplayObject(player, json);

      break;
    }
    case 'resume': {
      player.resume();

      break;
    }
  }
});
