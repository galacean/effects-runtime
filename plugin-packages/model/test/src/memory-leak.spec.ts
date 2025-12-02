import { Player, registerPlugin, AbstractPlugin, VFXItem, spec, unregisterPlugin } from '@galacean/effects';
import { JSONConverter } from '@galacean/effects-plugin-model';
import sceneList from './scene-list';
import { sleep, GPUMemoryTool } from '../../../../web-packages/test/memory/src/common';

const { expect } = chai;

class CustomePlugin extends AbstractPlugin { }

registerPlugin('orientation-transformer', CustomePlugin);

describe('显存泄漏（单合成）', function () {
  this.timeout(60 * 1000);

  let memoryTool: GPUMemoryTool;
  let canvas: HTMLCanvasElement;

  before(() => {
    canvas = document.createElement('canvas');
    memoryTool = new GPUMemoryTool();
    memoryTool.inject();
  });

  after(() => {
    memoryTool.uninject();
    // @ts-expect-error
    memoryTool = null;
    canvas.remove();
    // @ts-expect-error
    canvas = null;

    unregisterPlugin('orientation-transformer');
  });

  // @ts-expect-error
  Math.seedrandom('effects-runtime');
  const keyList = Object.keys(sceneList);

  keyList.forEach(key => {
    // @ts-expect-error
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

      await player.loadScene(jsonScene, { timeout: 100, speed });

      const comp = player.getCompositions()[0];
      let durationScale = 1.0;

      if (comp.rootItem.endBehavior === spec.EndBehavior.restart) {
        durationScale = 1 + 5 * Math.random();
      }
      const duration = (comp.rootItem.duration - durationScale + 5) * Math.random();

      await sleep(duration * 1000 / speed);
      player.pause();
      player.dispose();
      const stats = memoryTool.checkWebGLLeak();

      expect(stats).to.eql({});
    });
  });
});
