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
    const { marsPlayer, runtimePlayer, renderFramework } = controller;

    await marsPlayer.initialize(url);
    await runtimePlayer.initialize(url);
    const imageCmp = new ImageComparator(pixelDiffThreshold);
    const namePrefix = getCurrnetTimeStr();
    const duration = marsPlayer.composition.duration;
    const timeList = [
      0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.65, 0.74, 0.87, 0.96, 1,
    ].map(t => t * duration);
    let maxDiffValue = 0;

    for (let i = 0; i < timeList.length; i++) {
      const time = timeList[i];

      if (!marsPlayer.isLoop() && time > marsPlayer.duration()) {
        break;
      }
      //
      marsPlayer.gotoTime(time);
      runtimePlayer.gotoTime(time);

      const marsImage = await marsPlayer.readImageBuffer();
      const runtimeImage = await runtimePlayer.readImageBuffer();

      expect(marsImage.length).to.eql(runtimeImage.length);
      //
      const pixelDiffValue = await imageCmp.compareImages(marsImage, runtimeImage);
      const diffCountRatio = pixelDiffValue / (canvasWidth * canvasHeight);

      if (pixelDiffValue > 0) {
        maxDiffValue = Math.max(maxDiffValue, pixelDiffValue);
        console.info('DiffInfo:', renderFramework, name, keyName, time, pixelDiffValue, diffCountRatio);
      }
      if (diffCountRatio > accumRatioThreshold) {
        console.error('FindDiff:', renderFramework, name, keyName, time, pixelDiffValue, url);
        if (dumpImageForDebug) {
          const marsFileName = `${namePrefix}_${name}_${time}_mars.png`;
          const runtimeFileName = `${namePrefix}_${name}_${time}_runtime.png`;

          await marsPlayer.saveCanvasToFile(marsFileName);
          await runtimePlayer.saveCanvasToFile(runtimeFileName);
        }
      }

      expect(diffCountRatio).to.lte(accumRatioThreshold);
    }

    const marsLoadCost = marsPlayer.loadSceneTime();
    const marsFirstCost = marsPlayer.firstFrameTime();
    const runtimeLoadCost = runtimePlayer.loadSceneTime();
    const runtimeFirstCost = runtimePlayer.firstFrameTime();

    cmpStats.addSceneInfo(
      `${keyName}@${name}`, marsLoadCost, marsFirstCost - marsLoadCost,
      runtimeLoadCost, runtimeFirstCost - runtimeLoadCost, maxDiffValue
    );

    console.info(`[Compare]: End ${name}, ${url}`);
  });
}
