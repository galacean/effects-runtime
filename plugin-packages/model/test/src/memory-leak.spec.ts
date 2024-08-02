// @ts-nocheck
import { Player, registerPlugin, AbstractPlugin, VFXItem, spec } from '@galacean/effects';

import sceneList from './scene-list';
import { sleep, GPUMemoryTool } from '../../../../web-packages/test/memory/src/common';
import { JSONConverter } from '@galacean/effects-plugin-model';

const { expect } = chai;

registerPlugin('orientation-transformer', AbstractPlugin, VFXItem, true);

describe('显存泄漏（单合成）', function () {
  this.timeout(60 * 1000);

  let memoryTool;
  let canvas;

  before(() => {
    canvas = document.createElement('canvas');
    memoryTool = new GPUMemoryTool();
    memoryTool.inject();
  });

  after(() => {
    memoryTool.uninject();
    memoryTool = null;
    canvas.remove();
    canvas = null;
  });

  Math.seedrandom('effects-runtime');
  const keyList = Object.keys(sceneList);

  keyList.forEach(key => {
    const { url, name } = sceneList[key];

    it(name, async () => {
      memoryTool.clear();
      const player = new Player({
        canvas,
        renderFramework: 'webgl2',
      });
      const speed = 0.5 + 4.5 * Math.random();
      const converter = new JSONConverter(player.renderer);
      const jsonScene = await converter.processScene(url);
      const scene = await player.loadScene(jsonScene, { timeout: 100, speed });

      player.play();
      const comp = player.getCompositions()[0];
      let durationScale = 1.0;

      if (comp.rootItem.endBehavior === spec.END_BEHAVIOR_RESTART) {
        durationScale = 1 + 5 * Math.random();
      }
      const duration = (comp.rootItem.duration - durationScale + 5) * Math.random();

      await sleep(duration * 1000 / speed);
      player.pause();
      player.dispose(true);
      const stats = memoryTool.checkWebGLLeak();

      expect(stats).to.eql({});
    });
  });
});
