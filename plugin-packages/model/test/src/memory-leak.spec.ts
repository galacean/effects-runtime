// @ts-nocheck
import { Player, registerPlugin, AbstractPlugin, VFXItem, spec } from '@galacean/effects';

import sceneList from './scene-list';
import { sleep, GPUMemoryTool } from '../../../../web-packages/test/memory/src/common';

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
      const scene = await player.loadScene(url, { timeout: 100, speed });

      player.play();
      const comp = player.getCompositions()[0];
      let durationScale = 1.0;

      if (comp.content.endBehavior === spec.END_BEHAVIOR_RESTART) {
        durationScale = 1 + 5 * Math.random();
      }
      const duration = (comp.content.duration - durationScale + 5) * Math.random();

      await sleep(duration * 1000 / speed);
      player.pause();
      player.dispose(true);
      const stats = memoryTool.checkWebGLLeak();

      expect(stats).to.eql({});
    });
  });
});

describe('显存泄漏（多合成）', function () {
  this.timeout(15 * 60 * 1000);

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

  const maxSceneCount = 3;
  const keyList = Object.keys(sceneList);

  for (let i = 0; i < 15; i++) {
    const count = 2 + Math.floor(Math.random() * maxSceneCount);
    const nameList: string[] = [];
    const indexList: number[] = [];

    for (let j = 0; j < count; j++) {
      const index = Math.min(Math.floor(Math.random() * keyList.length), keyList.length - 1);

      indexList.push(index);
      nameList.push(sceneList[keyList[index]].name);
    }
    it(nameList.join('####'), async () => {
      memoryTool.clear();
      const player = new Player({
        canvas,
        renderFramework: 'webgl2',
      });
      //
      const effectsScenes: Scene[] = [];

      const speed = 0.5 + 2.0 * Math.random();

      for (let j = 0; j < count; j++) {
        const index = indexList[j];
        const { url } = sceneList[keyList[index]];
        const scene = await player.loadScene(url, { timeout: 100, speed, multipleCompositions: true });

        effectsScenes.push(scene);
      }
      //
      let leftTime = 0;

      for (let j = 0; j < count; j++) {
        const scene = effectsScenes[j];

        player.play();
        const comp = player.getCompositions()[0];
        let durationScale = 1.0;

        if (comp.content.endBehavior === spec.END_BEHAVIOR_RESTART) {
          durationScale = 1 + 5 * Math.random();
        }
        leftTime = Math.max(leftTime, comp.content.duration * durationScale);
        const sleepTime = Math.max(0, (leftTime + 5) * Math.random());

        await sleep(sleepTime * 1000 / speed);
        leftTime -= sleepTime;
      }
      await sleep((leftTime + 8) * Math.random() * 1000 / speed);
      player.pause();
      player.dispose(true);
      const stats = memoryTool.checkWebGLLeak();

      expect(stats).to.eql({});
    });
  }
});
