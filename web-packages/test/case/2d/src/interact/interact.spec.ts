// @ts-nocheck
import { TestController, ImageComparator, getCurrnetTimeStr } from '../common';
import sceneList from './scene-list';

const { expect } = chai;
/**
 * 万分之一的像素不相等比例，对于512x512大小的图像，
 * 不能超过26个像素不相等
 */
const accumRatioThreshold = 1.5e-4;
const pixelDiffThreshold = 1;
const dumpImageForDebug = true;
const canvasWidth = 512;
const canvasHeight = 512;
let controller;

addDescribe('webgl');
addDescribe('webgl2');

function addDescribe (renderFramework) {
  describe(`交互测试@${renderFramework}`, function () {
    this.timeout('300s');

    before(async function () {
      controller = new TestController();
      await controller.createPlayers(canvasWidth, canvasHeight, renderFramework);
    });

    after(function () {
      controller.disposePlayers();
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
    const timeList = [
      0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.66, 0.71, 0.83, 0.96,
      1.1, 1.23, 1.45, 1.67, 1.88, 2.1, 2.5, 3.3, 4.7, 5.2, 6.8,
      7.5, 8.6, 9.7, 9.99,
    ];
    let marsRet, runtimeRet;

    for (let i = 0; i < timeList.length; i++) {

      const time = timeList[i];

      if (!marsPlayer.isLoop() && time > marsPlayer.duration()) {
        break;
      }
      //
      marsPlayer.gotoTime(time);
      runtimePlayer.gotoTime(time);
      //
      Math.seedrandom(`hit-test${i}`);

      // console.log(marsPlayer.compositions[0]);
      // console.log(runtimePlayer.currentComposition);

      if (Math.random() < 0.75) {
        const count = Math.round(Math.random() * 8);

        for (let j = 0; j < count; j++) {
          const x = Math.random() * 2.0 - 1.0;
          const y = Math.random() * 2.0 - 1.0;

          marsRet = marsPlayer.hitTest(x, y);
          runtimeRet = runtimePlayer.hitTest(x, y);

          expect(marsRet.length).to.eql(runtimeRet.length);
          for (let k = 0; k < marsRet.length; k++) {
            expect(marsRet[k].id).to.eql(runtimeRet[k].id);
          }
        }
      } else {
        let hitPos;

        if (Math.random() < 0.5) {
          hitPos = marsPlayer.getRandomPointInParticle();
        } else {
          hitPos = runtimePlayer.getRandomPointInParticle();
        }

        marsRet = marsPlayer.hitTest(hitPos[0], hitPos[1]);
        runtimeRet = runtimePlayer.hitTest(hitPos[0], hitPos[1]);

        expect(marsRet.length).to.eql(runtimeRet.length);
        for (let j = 0; j < marsRet.length; j++) {
          expect(marsRet[j].id).to.eql(runtimeRet[j].id);
        }
      }

      const marsImage = await marsPlayer.readImageBuffer();
      const runtimeImage = await runtimePlayer.readImageBuffer();

      expect(marsImage.length).to.eql(runtimeImage.length);
      //
      const pixelDiffValue = await imageCmp.compareImages(marsImage, runtimeImage);
      const diffCountRatio = pixelDiffValue / (canvasWidth * canvasHeight);

      if (pixelDiffValue > 0) {
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

      // 红包雨case player 点击后有元素不消失的问题
      expect(diffCountRatio).to.lte(accumRatioThreshold);
    }

    console.info(`[Compare]: End ${name}, ${url}`);
  });
}
