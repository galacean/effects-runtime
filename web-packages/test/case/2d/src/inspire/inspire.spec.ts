// @ts-nocheck
import { TestController, ImageComparator, getCurrnetTimeStr, ComparatorStats, getWebGLVersionFromURL } from '../common';
import sceneList from './scene-list';

const { expect } = chai;
/**
 * 万分之一的像素不相等比例，对于512x512大小的图像，
 * 不能超过26个像素不相等
 */
const accumRatioThreshold = 3e-4;
const pixelDiffThreshold = 1;
const dumpImageForDebug = false;
const canvasWidth = 512;
const canvasHeight = 512;
let controller, cmpStats;

const webglVersion = getWebGLVersionFromURL();

if (webglVersion === '1') {
  addDescribe('webgl');
} else if (webglVersion === '2') {
  addDescribe('webgl2');
} else {
  addDescribe('webgl');
  addDescribe('webgl2');
}

function addDescribe (renderFramework) {
  describe(`灵感中心@${renderFramework}`, function () {
    this.timeout('1800s');

    before(async function () {
      controller = new TestController();
      await controller.createPlayers(canvasWidth, canvasHeight, renderFramework);
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

    it(`${renderFramework}检查`, () => {
      const { oldPlayer, newPlayer } = controller;

      if (renderFramework === 'webgl') {
        expect(oldPlayer.player.gpuCapability.level).to.eql(1);
        expect(newPlayer.player.gpuCapability.level).to.eql(1);
      } else {
        expect(oldPlayer.player.gpuCapability.level).to.eql(2);
        expect(newPlayer.player.gpuCapability.level).to.eql(2);
      }
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

    newPlayer.player.compositions.length = 0;
    await oldPlayer.initialize(url);
    await newPlayer.initialize(url);
    const imageCmp = new ImageComparator(pixelDiffThreshold);
    const namePrefix = getCurrnetTimeStr();
    const timeList = [
      0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.71, 0.83, 0.96,
      1.1, 1.2, 1.4, 1.7, 1.9, 2.2, 2.5, 2.7, 3.3, 3.8,
      4.7, 5.2, 6.8, 7.5, 8.6, 9.7, 9.99, 12.5, 18.9,
    ];
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
    newPlayer.disposeScene();
  });
}
