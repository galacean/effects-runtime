// @ts-nocheck
import '@galacean/effects-plugin-model';
import { TestController, ImageComparator, getCurrnetTimeStr, ComparatorStats } from '../../../2d/src/common';
import gltfList from './gltf-list';
import { oldLoadGLTFScene } from './old-loader';
import { loadGLTFSceneECS } from './new-loader';

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
  describe(`glTF帧对比@${renderFramework}`, function () {
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
      const { oldPlayer, newPlayer } = controller;

      if (renderFramework === 'webgl') {
        expect(oldPlayer.player.gpuCapability.level).to.eql(1);
        expect(newPlayer.player.gpuCapability.level).to.eql(1);
      } else {
        expect(oldPlayer.player.gpuCapability.level).to.eql(2);
        expect(newPlayer.player.gpuCapability.level).to.eql(2);
      }
    });

    gltfList.forEach(url => {
      const tokens = url.split('/');
      const key = tokens[tokens.length - 1];
      const sceneData = {
        name: key,
        url,
      };

      if (key.length > 24) {
        sceneData.name = key.substring(0, 24);
      }

      void checkScene(key, sceneData);
    });

    async function checkScene (keyName, sceneData) {
      const { name, url } = sceneData;
      const autoAdjustScene = sceneData.autoAdjustScene ?? false;
      const enableDynamicSort = true;
      const compatibleMode = 'tiny3d';

      it(`${name}`, async () => {
        console.info(`[Compare]: Begin ${name}, ${url}`);
        const { oldPlayer, newPlayer, renderFramework } = controller;

        const loadOptions = {
          pluginData: {
            compatibleMode: compatibleMode,
            autoAdjustScene: autoAdjustScene,
            enableDynamicSort: enableDynamicSort,
          },
        };
        const playerOptions = { pauseOnFirstFrame: true };
        const loadGLTFOptions = getLoadGLTFOptions(name);
        const oldScene = await oldLoadGLTFScene({ url, player: oldPlayer.player, ...loadGLTFOptions });
        const newScene = await loadGLTFSceneECS({ url, player: newPlayer.player, ...loadGLTFOptions });

        copySceneCamera(oldScene, newScene);

        await oldPlayer.initialize(oldScene, loadOptions, playerOptions);
        await newPlayer.initialize(newScene, loadOptions, playerOptions);

        const imageCmp = new ImageComparator(pixelDiffThreshold);
        const namePrefix = getCurrnetTimeStr();
        const timeList = [0];

        if (isAllTimeTest(name)) {
          timeList.push(
            0.11, 0.34, 0.57, 0.71, 1.0,
            1.1, 1.5, 2.0, 3.0, 5.2, 7.4, 9.99, 12.5, 15.8,
          );
        }

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
  });
}

function copySceneCamera (fromScene: spec.JSONScene, toScene: spec.JSONScene) {
  const fromCamera = fromScene.compositions[0].camera;
  const toCamera = toScene.compositions[0].camera;

  toCamera.fov = fromCamera.fov;
  toCamera.far = fromCamera.far;
  toCamera.near = fromCamera.near;
  toCamera.position = fromCamera.position.slice();
  toCamera.rotation = fromCamera.rotation?.slice() ?? [0, 0, 0];
  toCamera.clipMode = fromCamera.clipMode;

  let fromCameraItem;

  fromScene.items.forEach(item => {
    if (item.type === 'camera') {
      fromCameraItem = item;
    }
  });
  let toCameraItem;

  toScene.items.forEach(item => {
    if (item.type === 'camera') {
      toCameraItem = item;
    }
  });

  toCameraItem.transform.position = {
    x: fromCameraItem.transform.position.x,
    y: fromCameraItem.transform.position.y,
    z: fromCameraItem.transform.position.z,
  };
  toCameraItem.transform.scale = {
    x: fromCameraItem.transform.scale.x,
    y: fromCameraItem.transform.scale.y,
    z: fromCameraItem.transform.scale.z,
  };
  toCameraItem.transform.eulerHint = {
    x: fromCameraItem.transform.eulerHint.x,
    y: fromCameraItem.transform.eulerHint.y,
    z: fromCameraItem.transform.eulerHint.z,
  };
}

function getLoadGLTFOptions (sceneName: string) {
  if ('ebec344a9fa02bec3b9987d475e04191'.includes(sceneName)
  || '5eb610471972b998b9d570987d72d784'.includes(sceneName)) {
    return { playAnimation: 0 };
  } else {
    return { playAllAnimation: true };
  }
}

function isAllTimeTest (sceneName: string) {
  if ('ebec344a9fa02bec3b9987d475e04191'.includes(sceneName)
  || '5eb610471972b998b9d570987d72d784'.includes(sceneName)
  || 'CesiumMan.glb'.includes(sceneName)) {
    return false;
  } else {
    return true;
  }
}
