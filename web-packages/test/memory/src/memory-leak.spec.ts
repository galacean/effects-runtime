import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-orientation-transformer';
import sceneList from './scene-list';
import { sleep, GPUMemoryTool, shuffleArray } from './common';

const { expect } = chai;

describe('Single scene', function () {
  this.timeout(15 * 60 * 1000);

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
  });

  // @ts-expect-error
  Math.seedrandom('runtime');
  const keyList = Object.keys(sceneList);

  shuffleArray(keyList, 10, 50);

  for (let i = 0; i < 50; i++) {
    const { url, name } = sceneList[keyList[i] as keyof typeof sceneList];

    it(name, async () => {
      memoryTool?.clear();

      const player = new Player({
        canvas,
        renderFramework: 'webgl2',
      });
      const speed = 0.5 + 4.5 * Math.random();
      const comp = await player.loadScene(url, { timeout: 100, speed });
      const duration = (comp.getDuration() + 5) * Math.random();

      await sleep(duration * 1000 / speed);

      player.pause();
      player.dispose();
      const stats = memoryTool.checkWebGLLeak();

      expect(stats).to.eql({});
    });
  }
});

describe('Multiple scenes', function () {
  this.timeout(15 * 60 * 1000);

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
  });

  // @ts-expect-error
  Math.seedrandom('runtime');

  const maxSceneCount = 3;
  const keyList = Object.keys(sceneList);

  for (let i = 0; i < 20; i++) {
    const count = 2 + Math.floor(Math.random() * maxSceneCount);
    const nameList: string[] = [];
    const indexList: number[] = [];

    for (let j = 0; j < count; j++) {
      const index = Math.min(Math.floor(Math.random() * keyList.length), keyList.length - 1);

      indexList.push(index);
      nameList.push(sceneList[keyList[index] as keyof typeof sceneList].name);
    }
    it(nameList.join('####'), async () => {
      memoryTool?.clear();
      const player = new Player({
        canvas,
        renderFramework: 'webgl2',
      });
      //
      const urlList = [];

      for (let j = 0; j < count; j++) {
        const index = indexList[j];
        const { url } = sceneList[keyList[index] as keyof typeof sceneList];

        urlList.push(url);
      }

      const compList = await player.loadScene(urlList, { timeout: 100 });
      //
      let leftTime = 0;

      for (let j = 0; j < count; j++) {
        const comp = compList[j];

        leftTime = Math.max(leftTime, comp.getDuration());
      }
      const speed = 0.5 + 2.0 * Math.random();

      await sleep((leftTime + 8) * Math.random() * 1000 / speed);

      player.pause();
      player.dispose();
      const stats = memoryTool.checkWebGLLeak();

      expect(stats).to.eql({});
    });
  }
});
