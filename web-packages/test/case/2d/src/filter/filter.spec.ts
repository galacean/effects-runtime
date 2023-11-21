// @ts-nocheck
import { TestController, ImageComparator, getCurrnetTimeStr } from '../common';
import sceneList from './scene-list';

const { expect } = chai;
/**
 * 万分之一的像素不相等比例，对于512x512大小的图像，
 * 不能超过26个像素不相等
 */
const globalAccumRatioThreshold = 1e-4;
const globalPixelDiffThreshold = 1;
const dumpImageForDebug = false;
const canvasWidth = 512;
const canvasHeight = 512;
let controller;
let equalSceneCount = 0, diffSceneCount = 0;
let totalDiffPixels = 0, maxDiffPixels = 0;

addDescribe('webgl');
addDescribe('webgl2');

function addDescribe (renderFramework) {
  describe(`滤镜测试@${renderFramework}`, function () {
    this.timeout('1800s');

    before(async function () {
      equalSceneCount = diffSceneCount = 0;
      totalDiffPixels = maxDiffPixels = 0;
      //
      controller = new TestController();
      await controller.createPlayers(canvasWidth, canvasHeight, renderFramework);
    });

    after(function () {
      controller.disposePlayers();
      const totalCount = equalSceneCount + diffSceneCount;
      let message = `DiffStat: ${renderFramework}, total ${totalCount}, equal ${equalSceneCount}, ratio ${equalSceneCount / totalCount}, `;

      message += `diff ${diffSceneCount}, max ${maxDiffPixels}, average ${totalDiffPixels / diffSceneCount}`;
      const label = document.createElement('h2');

      label.innerHTML = `<b>${message}</b>`;
      const suites = document.getElementsByClassName('suite');

      suites[suites.length - 1].appendChild(label);
      console.info(message);
    });

    Object.keys(sceneList).forEach(key => {
      void checkScene(key, sceneList[key]);
    });
  });
}

async function checkScene (keyName, sceneData) {
  const {
    name, url,
    accumRatioThreshold = globalAccumRatioThreshold,
    pixelDiffThreshold = globalPixelDiffThreshold,
  } = sceneData;

  it(`${name}`, async () => {
    console.info(`[Compare]: Begin ${name}, ${url}`);
    const { marsPlayer, runtimePlayer, renderFramework } = controller;

    await marsPlayer.initialize(url);
    await runtimePlayer.initialize(url);
    const imageCmp = new ImageComparator(pixelDiffThreshold);
    const namePrefix = getCurrnetTimeStr();
    const timeList = [
      0, 0.06, 0.11, 0.15, 0.22, 0.27, 0.30, 0.34, 0.45, 0.49, 0.52, 0.57,
      0.61, 0.66, 0.71, 0.78, 0.83, 0.88, 0.91, 0.96, 1.11, 1.23, 1.35, 1.46,
      1.52, 1.67, 1.73, 1.88, 1.99, 2.1, 2.3, 2.7, 2.9, 3.1, 3.3, 3.7, 3.9, 4.2,
      4.7, 5.2, 6.8, 7.5, 8.6, 9.7, 9.99,
    ];
    let maxDiffValue = 0;

    console.info('ThresholdInfo:', keyName, name, accumRatioThreshold, pixelDiffThreshold);
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

    if (maxDiffValue > 0) {
      diffSceneCount++;
      totalDiffPixels += maxDiffValue;
      maxDiffPixels = Math.max(maxDiffPixels, maxDiffValue);
    } else {
      equalSceneCount++;
    }

    console.info(`[Compare]: End ${name}, ${url}`);
  });
}
