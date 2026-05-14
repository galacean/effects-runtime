import type { GLType } from '@galacean/effects';
import { ImageComparator, getCurrnetTimeStr } from '../../common';
import type { TestController } from '../../common/player/test-controller';
import type { FrameCompareScene, FrameSuiteProfile } from '../types/profile';

export type FrameCompareLoopOptions = {
  controller: TestController,
  profile: FrameSuiteProfile,
  scene: FrameCompareScene,
  renderFramework: GLType,
  idx: [number, number],
};

export type FrameCompareLoopResult = {
  diffRatioList: number[],
  oldLoadCost: number,
  oldCreateCost: number,
  newLoadCost: number,
  newCreateCost: number,
};

export async function runFrameCompareLoop (options: FrameCompareLoopOptions): Promise<FrameCompareLoopResult> {
  const { controller, profile, scene, renderFramework, idx } = options;
  const { oldPlayer, newPlayer } = controller;
  const breakWhenTimeGteDuration = scene.breakWhenTimeGteDuration ?? profile.breakWhenTimeGteDuration ?? false;

  if (scene.beforeScene) {
    await scene.beforeScene({
      controller,
      renderFramework,
      scene,
    });
  }

  try {
    if (scene.setupPlayers) {
      await scene.setupPlayers({
        controller,
        renderFramework,
        scene,
      });
    } else {
      if (!scene.url) {
        throw new Error(`[Test] Scene url is required when setupPlayers is not provided: ${scene.id}`);
      }

      await oldPlayer.initialize(scene.url, scene.loadOptions ?? {});
      await newPlayer.initialize(scene.url, scene.loadOptions ?? {});
    }

    const imageCmp = new ImageComparator(profile.pixelDiffThreshold);
    const threshold = scene.threshold ?? profile.defaultAccumRatioThreshold;
    const namePrefix = getCurrnetTimeStr();
    const timeList = scene.timePoints ?? profile.timePoints;
    const diffRatioList: number[] = [];

    for (let i = 0; i < timeList.length; i++) {
      const time = timeList[i];
      const duration = oldPlayer.duration();

      if (breakWhenTimeGteDuration ? time >= duration : time > duration) {
        break;
      }

      oldPlayer.gotoTime(time);
      newPlayer.gotoTime(time);

      if (scene.beforeEachFrame) {
        await scene.beforeEachFrame({
          controller,
          renderFramework,
          scene,
          time,
          timeIndex: i,
        });
      }

      const oldImage = await oldPlayer.readImageBuffer();
      const newImage = await newPlayer.readImageBuffer();

      if (oldImage.length !== newImage.length) {
        throw new Error(`[Test] Image length mismatch: old=${oldImage.length}, new=${newImage.length}`);
      }

      const pixelDiffValue = await imageCmp.compareImages(
        oldImage,
        newImage,
        profile.canvas.width,
        profile.canvas.height,
      );
      const diffCountRatio = pixelDiffValue / (profile.canvas.width * profile.canvas.height);

      if (pixelDiffValue > 0) {
        console.info('[Test] DiffInfo:', renderFramework, scene.name, scene.id, time, pixelDiffValue, diffCountRatio);
      }

      if (diffCountRatio > threshold) {
        const sceneUrl = scene.url ?? '';

        console.error('[Test] FindDiff:', renderFramework, scene.name, scene.id, time, pixelDiffValue, sceneUrl);
        const oldFileName = `${namePrefix}_${scene.name}_${time}_old.png`;
        const newFileName = `${namePrefix}_${scene.name}_${time}_new.png`;
        const diffFileName = `${namePrefix}_${scene.name}_${time}_diff.png`;
        const diffHeatmapDataURL = imageCmp.getLastDiffHeatmapDataURL();

        await oldPlayer.saveCanvasToImage(oldFileName, idx);
        await newPlayer.saveCanvasToImage(newFileName, idx, true);
        if (diffHeatmapDataURL) {
          await newPlayer.saveCanvasToImage(
            diffFileName,
            idx,
            true,
            diffHeatmapDataURL,
            'diff-heatmap',
            imageCmp.getLastDiffSummary(),
          );
        }
        diffRatioList.push(diffCountRatio);
      }
    }

    const oldLoadCost = oldPlayer.loadSceneTime();
    const oldCreateCost = oldPlayer.firstFrameTime() - oldLoadCost;
    const newLoadCost = newPlayer.loadSceneTime();
    const newCreateCost = newPlayer.firstFrameTime() - newLoadCost;

    return {
      diffRatioList,
      oldLoadCost,
      oldCreateCost,
      newLoadCost,
      newCreateCost,
    };
  } finally {
    if (scene.afterScene) {
      await scene.afterScene({
        controller,
        renderFramework,
        scene,
      });
    }
  }
}
