// @ts-nocheck
import '@galacean/effects-plugin-spine';
import { TestController, ImageComparator, getCurrnetTimeStr, ComparatorStats } from '../../2d/src/common';
import sceneList from './scene-list';

const { expect } = chai;
/**
 * 万分之一的像素不相等比例，对于512x512大小的图像，
 * 不能超过26个像素不相等
 */
const accumRatioThreshold = 1e-4;
const pixelDiffThreshold = 1;
const dumpImageForDebug = false;
const canvasWidth = 512;
const canvasHeight = 512;
let controller, cmpStats;

addDescribe('webgl');
addDescribe('webgl2');

function addDescribe (renderFramework) {
  describe(`Spine测试@${renderFramework}`, function () {
    this.timeout('1800s');

    before(async function () {
      controller = new TestController();
      await controller.createPlayers(canvasWidth, canvasHeight, renderFramework, false);
      cmpStats = new ComparatorStats(renderFramework);
    });

    after(function () {
      controller.disposePlayers();
      const message = cmpStats.getStatsInfo();
      const label = document.createElement('h2');

      label.innerHTML = `${message}`;
      //
      const suites = document.getElementsByClassName('suite');

      suites[suites.length - 1].appendChild(label);
    });

    Object.keys(sceneList).forEach(key => {
      const { name, url } = sceneList[key];

      void checkScene(key, name, url);
    });
  });
}

async function checkScene (keyName, name, url) {
  it(`${name}`, async () => {
    console.info(`[Compare]: Begin ${name}, ${url}`);
    const { oldPlayer, newPlayer, renderFramework } = controller;

    await oldPlayer.initialize(url);
    await newPlayer.initialize(url);
    const imageCmp = new ImageComparator(pixelDiffThreshold);
    const namePrefix = getCurrnetTimeStr();
    const duration = oldPlayer.duration();

    const timeList = [
      0, 0.045, 0.11, 0.13, 0.17, 0.22, 0.28, 0.3, 0.34, 0.38,
      0.41, 0.45, 0.51, 0.57, 0.63, 0.65, 0.69, 0.74, 0.77,
      0.83, 0.87, 0.92, 0.96, 1,
    ].map(t => t * duration);
    let maxDiffValue = 0;

    for (let i = 0; i < timeList.length; i++) {
      const time = timeList[i];

      if (!oldPlayer.isLoop() && time > oldPlayer.duration()) {
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
        maxDiffValue = Math.max(maxDiffValue, pixelDiffValue);
        console.info('DiffInfo:', renderFramework, name, keyName, time, pixelDiffValue, diffCountRatio);
      }
      if (diffCountRatio > accumRatioThreshold) {
        console.error('FindDiff:', renderFramework, name, keyName, time, pixelDiffValue, url);
        if (dumpImageForDebug) {
          const oldFileName = `${namePrefix}_${name}_${time}_old.png`;
          const newFileName = `${namePrefix}_${name}_${time}_new.png`;

          await oldPlayer.saveCanvasToFile(oldFileName);
          await newPlayer.saveCanvasToFile(newFileName);
        }
      }

      expect(diffCountRatio).to.lte(accumRatioThreshold);
    }

    const oldLoadCost = oldPlayer.loadSceneTime();
    const oldFirstCost = oldPlayer.firstFrameTime();
    const newLoadCost = newPlayer.loadSceneTime();
    const newFirstCost = newPlayer.firstFrameTime();

    cmpStats.addSceneInfo(
      `${keyName}@${name}`, oldLoadCost, oldFirstCost - oldLoadCost,
      newLoadCost, newFirstCost - newLoadCost, maxDiffValue
    );

    console.info(`[Compare]: End ${name}, ${url}`);
  });
}
