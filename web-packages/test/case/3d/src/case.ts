// @ts-nocheck
import '@galacean/effects-plugin-model';
import { TestController, ImageComparator, getCurrnetTimeStr, ComparatorStats } from '../../2d/src/common';
import sceneList from './scene-list';

const { expect } = chai;

/**
 * 万分之一的像素不相等比例，对于512x512大小的图像，
 * 不能超过26个像素不相等
 */
const accumRatioThreshold = 2.0e-4;
const pixelDiffThreshold = 1;
const dumpImageForDebug = false;
const canvasWidth = 512;
const canvasHeight = 512;
let controller, cmpStats;

addDescribe('webgl');
addDescribe('webgl2');

function addDescribe (renderFramework) {
  describe(`3d帧对比@${renderFramework}`, function () {
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

    it(`${renderFramework}检查`, () => {
      const { marsPlayer } = controller;
      const instance = marsPlayer.player.renderer.gpu;

      if (renderFramework === 'webgl') {
        expect(instance.level).to.eql(1);
        expect(marsPlayer.player.renderer.gpu.level).to.eql(1);
      } else {
        expect(instance.level).to.eql(2);
        expect(marsPlayer.player.renderer.gpu.level).to.eql(2);
      }
    });

    const ignoreList = getIngoreList();

    Object.keys(sceneList).forEach(key => {
      if (ignoreList.includes(key)) {
        return;
      }

      const scene = sceneList[key];

      void checkScene(key, scene);
    });

    async function checkScene (keyName, sceneData) {
      const { name, url } = sceneData;
      const autoAdjustScene = sceneData.autoAdjustScene ?? false;
      const enableDynamicSort = sceneData.enableDynamicSort ?? false;
      const compatibleMode = 'tiny3d';

      it(`${name}`, async () => {
        console.info(`[Compare]: Begin ${name}, ${url}`);
        const { marsPlayer, runtimePlayer, renderFramework } = controller;

        const loadOptions = {
          pluginData: {
            compatibleMode: compatibleMode,
            autoAdjustScene: autoAdjustScene,
            enableDynamicSort: enableDynamicSort,
          },
        };
        const playerOptions = { pauseOnFirstFrame: true };

        await marsPlayer.initialize(url, loadOptions, playerOptions);
        await runtimePlayer.initialize(url, loadOptions, playerOptions);

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
  });
}

function getIngoreList () {
  if (navigator.platform.toLowerCase().search('win') >= 0) {
    return [];
  } else {
    return ['monster', 'ring618'];
  }
}
