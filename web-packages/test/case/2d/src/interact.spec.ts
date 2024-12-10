import type { GLType } from '@galacean/effects';
import { TestController, ImageComparator, getCurrnetTimeStr } from './common';
import sceneList from './assets/interact';

const { expect } = chai;
/**
 * 万分之一的像素不相等比例，对于512x512大小的图像，
 * 不能超过26个像素不相等
 */
const accumRatioThreshold = 1.5e-4;
const pixelDiffThreshold = 1;
const canvasWidth = 512;
const canvasHeight = 512;
let controller: TestController;

addDescribe('webgl', 2);
addDescribe('webgl2', 3);

function addDescribe (renderFramework: GLType, i: number) {
  describe(`交互测试@${renderFramework}`, function () {
    this.timeout('300s');

    before(async () => {
      controller = new TestController();
      await controller.createPlayers(canvasWidth, canvasHeight, renderFramework);
    });

    after(() => {
      controller.disposePlayers();
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
      0, 0.11, 0.22, 0.34, 0.45, 0.57, 0.66, 0.71, 0.83, 0.96,
      1.1, 1.23, 1.45, 1.67, 1.88, 2.1, 2.5, 3.3, 4.7, 5.2, 6.8,
      7.5, 8.6, 9.7, 9.99,
    ];
    let marsRet, runtimeRet;

    for (let i = 0; i < timeList.length; i++) {
      const time = timeList[i];

      if (time > oldPlayer.duration()) {
        break;
      }
      //
      oldPlayer.gotoTime(time);
      newPlayer.gotoTime(time);
      // @ts-expect-error
      Math.seedrandom(`hit-test${i}`);

      if (Math.random() < 0.75) {
        const count = Math.round(Math.random() * 8);

        for (let j = 0; j < count; j++) {
          const x = Math.random() * 2.0 - 1.0;
          const y = Math.random() * 2.0 - 1.0;

          marsRet = oldPlayer.hitTest(x, y);
          runtimeRet = newPlayer.hitTest(x, y);

          expect(marsRet.length).to.eql(runtimeRet.length);
          // for (let k = 0; k < marsRet.length; k++) {
          //   expect(marsRet[k].id).to.eql(runtimeRet[k].id);
          // }
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
        // for (let j = 0; j < marsRet.length; j++) {
        //   expect(marsRet[j].id).to.eql(runtimeRet[j].id);
        // }
      }

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

      // 红包雨case player 点击后有元素不消失的问题
      expect(diffCountRatio).to.lte(accumRatioThreshold);
    }

    console.info(`[Test] Compare end: ${name}, ${url}`);
  });
}
