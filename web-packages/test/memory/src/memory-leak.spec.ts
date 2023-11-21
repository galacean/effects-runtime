// @ts-nocheck
import { Player, registerPlugin, AbstractPlugin, VFXItem } from '@galacean/effects';
import sceneList from './scene-list';
import { sleep, GPUMemoryTool, shuffleArray } from './common';

const { expect } = chai;

registerPlugin('orientation-transformer', AbstractPlugin, VFXItem, true);

describe('single scene', function () {
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

  Math.seedrandom('mars-runtime');
  const keyList = Object.keys(sceneList);

  shuffleArray(keyList, 10, 50);
  for (let i = 0; i < 50; i++) {
    const { url, name } = sceneList[keyList[i]];

    it(name, async () => {
      memoryTool?.clear();
      const player = new Player({
        canvas,
        renderFramework: 'webgl2',
      });
      const speed = 0.5 + 4.5 * Math.random();
      const comp = await player.loadScene(url, { timeout: 100, speed });
      const duration = (comp.content.duration + 5) * Math.random();

      await sleep(duration * 1000 / speed);
      player.pause();
      player.dispose(true);
      const stats = memoryTool.checkWebGLLeak();

      expect(stats).to.eql({});
    });
  }
});

describe('multiple scenes', function () {
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

  Math.seedrandom('mars-runtime');

  const maxSceneCount = 3;
  const keyList = Object.keys(sceneList);

  for (let i = 0; i < 20; i++) {
    const count = 2 + Math.floor(Math.random() * maxSceneCount);
    const nameList: string[] = [];
    const indexList: number[] = [];

    for (let j = 0; j < count; j++) {
      const index = Math.min(Math.floor(Math.random() * keyList.length), keyList.length - 1);

      indexList.push(index);
      nameList.push(sceneList[keyList[index]].name);
    }
    it(nameList.join('####'), async () => {
      memoryTool?.clear();
      const player = new Player({
        canvas,
        renderFramework: 'webgl2',
      });
      //
      const marsScenes: Scene[] = [];

      for (let j = 0; j < count; j++) {
        const index = indexList[j];
        const { url } = sceneList[keyList[index]];
        const scene = await player.loadScene(url, { timeout: 100 });

        marsScenes.push(scene);
      }
      //
      let leftTime = 0;
      const speed = 0.5 + 2.0 * Math.random();

      for (let j = 0; j < count; j++) {
        const scene = marsScenes[j];
        const comp = player.play(scene, { speed, multipleCompositions: true });

        leftTime = Math.max(leftTime, comp.content.duration);
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
