import type { GLType } from '@galacean/effects';
import { TestController, ImageComparator, getCurrnetTimeStr, ComparatorStats } from '../../2d/src/common';
import '@galacean/effects-plugin-spine';
import sceneList from './scene-list';

const { expect } = chai;
/**
 * 万分之一的像素不相等比例，对于512x512大小的图像，
 * 不能超过26个像素不相等
 */
const accumRatioThreshold = 1e-4;
const pixelDiffThreshold = 1;
const canvasWidth = 512;
const canvasHeight = 512;
let controller: TestController;
let cmpStats: ComparatorStats;

addDescribe('webgl', 0);
addDescribe('webgl2', 1);

function addDescribe (renderFramework: GLType, i: number) {
  describe(`Spine测试@${renderFramework}`, function () {
    this.timeout('1800s');

    before(async () => {
      controller = new TestController();
      await controller.createPlayers(canvasWidth, canvasHeight, renderFramework);
      cmpStats = new ComparatorStats(renderFramework);
    });

    after(() => {
      controller.disposePlayers();
      const message = cmpStats.getStatsInfo();
      const label = document.createElement('h2');
      const suites = document.getElementsByClassName('suite');

      label.innerHTML = `${message}`;
      suites[suites.length - 1].appendChild(label);
    });

    Object.keys(sceneList).forEach((key, j) => {
      const { name, url } = sceneList[key as keyof typeof sceneList];

      void checkScene(key, name, url, [i, j]);
    });
  });
}

async function checkScene (keyName: string, name: string, url: string, idx: [number, number]) {
  it(`${name}`, async () => {
    console.info(`[Test] Compare begin: ${name}, ${url}`);
    const { oldPlayer, newPlayer, renderFramework } = controller;

    await oldPlayer.initialize(url);
    await newPlayer.initialize(url);
    const imageCmp = new ImageComparator(pixelDiffThreshold);
    const namePrefix = getCurrnetTimeStr();
    const timeList = [
      0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.71, 0.83, 0.96,
      1.1, 1.2, 1.4, 1.7, 1.9, 2.2, 2.5, 2.7, 3.3, 3.8,
      4.7, 5.2, 6.8, 7.5, 8.6, 9.7, 9.99, 12.5, 18.9,
    ];

    for (let i = 0; i < timeList.length; i++) {
      const time = timeList[i];

      if (time > oldPlayer.duration()) {
        break;
      }
      //
      oldPlayer.gotoTime(time);
      newPlayer.gotoTime(time);
      const oldImage = await oldPlayer.readImageBuffer();
      const newImage = await newPlayer.readImageBuffer();

      expect(oldImage.length).to.eql(newImage.length);
      //
      const pixelDiffValue = await imageCmp.compareImages(oldImage, newImage);
      const diffCountRatio = pixelDiffValue / (canvasWidth * canvasHeight);

      if (pixelDiffValue > 0) {
        console.info('[Test] DiffInfo:', renderFramework, name, keyName, time, pixelDiffValue, diffCountRatio);
      }
      if (diffCountRatio > accumRatioThreshold) {
        console.error('[Test] FindDiff:', renderFramework, name, keyName, time, pixelDiffValue, url);
        const oldFileName = `${namePrefix}_${name}_${time}_old.png`;
        const newFileName = `${namePrefix}_${name}_${time}_new.png`;

        await oldPlayer.saveCanvasToImage(oldFileName, idx);
        await newPlayer.saveCanvasToImage(newFileName, idx, true);
      }

      expect(diffCountRatio).to.lte(accumRatioThreshold);
    }

    const oldLoadCost = oldPlayer.loadSceneTime();
    const oldFirstCost = oldPlayer.firstFrameTime();
    const newLoadCost = newPlayer.loadSceneTime();
    const newFirstCost = newPlayer.firstFrameTime();

    cmpStats.addSceneInfo(
      `${keyName}@${name}`, oldLoadCost, oldFirstCost - oldLoadCost,
      newLoadCost, newFirstCost - newLoadCost
    );

    console.info(`[Test] Compare end: ${name}, ${url}`);
  });
}
