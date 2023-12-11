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
    const { oldPlayer, newPlayer, renderFramework } = controller;

    await oldPlayer.initialize(url);
    await newPlayer.initialize(url);
    const imageCmp = new ImageComparator(pixelDiffThreshold);
    const namePrefix = getCurrnetTimeStr();
    const timeList = [
      0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.66, 0.71, 0.83, 0.96, 1.0,
      1.1, 1.23, 1.34, 1.45, 1.55, 1.67, 1.73, 1.88, 1.99,
      2.1, 2.5, 3.3, 4.7, 5.2, 6.8, 7.5, 8.6, 9.7, 9.99,
    ];
    let marsRet, runtimeRet;

    for (let i = 0; i < timeList.length; i++) {

      const time = timeList[i];

      if (!oldPlayer.isLoop() && time > oldPlayer.duration()) {
        break;
      }
      //
      oldPlayer.gotoTime(time);
      newPlayer.gotoTime(time);
      //
      Math.seedrandom(`hit-test${i}`);

      // console.log(oldPlayer.compositions[0]);
      // console.log(newPlayer.currentComposition);

      if (Math.random() < 0.75) {
        const count = Math.round(Math.random() * 8);

        for (let j = 0; j < count; j++) {
          const x = Math.random() * 2.0 - 1.0;
          const y = Math.random() * 2.0 - 1.0;

          marsRet = oldPlayer.hitTest(x, y);
          runtimeRet = newPlayer.hitTest(x, y);

          expect(marsRet.length).to.eql(runtimeRet.length);
          for (let k = 0; k < marsRet.length; k++) {
            expect(marsRet[k].id).to.eql(runtimeRet[k].id);
          }
        }
      } else {
        let hitPos;

        if (Math.random() < 0.5) {
          hitPos = oldPlayer.getRandomPointInParticle();
        } else {
          hitPos = newPlayer.getRandomPointInParticle();
        }

        marsRet = oldPlayer.hitTest(hitPos[0], hitPos[1]);
        runtimeRet = newPlayer.hitTest(hitPos[0], hitPos[1]);

        expect(marsRet.length).to.eql(runtimeRet.length);
        for (let j = 0; j < marsRet.length; j++) {
          expect(marsRet[j].id).to.eql(runtimeRet[j].id);
        }
      }

      const oldImage = await oldPlayer.readImageBuffer();
      const newImage = await newPlayer.readImageBuffer();

      expect(oldImage.length).to.eql(newImage.length);
      //
      const pixelDiffValue = await imageCmp.compareImages(oldImage, newImage);
      const diffCountRatio = pixelDiffValue / (canvasWidth * canvasHeight);

      if (pixelDiffValue > 0) {
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

      // 红包雨case player 点击后有元素不消失的问题
      expect(diffCountRatio).to.lte(accumRatioThreshold);
    }

    console.info(`[Compare]: End ${name}, ${url}`);
  });
}
