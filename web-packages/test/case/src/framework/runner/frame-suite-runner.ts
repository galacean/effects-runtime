import type { GLType } from '@galacean/effects';
import { ComparatorStats, TestController } from '../../common';
import type { FrameSuiteProfile } from '../types/profile';
import { runFrameCompareLoop } from './frame-compare-loop';

const { expect } = chai;

function appendStatsLabel (message: string) {
  const label = document.createElement('h2');
  const suites = document.getElementsByClassName('suite');

  label.innerHTML = message;
  suites[suites.length - 1].appendChild(label);
}

function assertGpuCapability (renderFramework: GLType, controller: TestController) {
  const { oldPlayer, newPlayer } = controller;

  if (renderFramework === 'webgl') {
    expect(oldPlayer.player.gpuCapability.level).to.eql(1);
    expect(newPlayer.player.gpuCapability.level).to.eql(1);
  } else {
    expect(oldPlayer.player.gpuCapability.level).to.eql(2);
    expect(newPlayer.player.gpuCapability.level).to.eql(2);
  }
}

export function runFrameSuite (profile: FrameSuiteProfile) {
  const frameworkIndexOffset = profile.frameworkIndexOffset ?? 0;

  profile.frameworks.forEach((renderFramework, frameworkIndex) => {
    describe(`${profile.title}@${renderFramework}`, function () {
      this.timeout(`${profile.timeoutMs}ms`);

      let controller: TestController | undefined;
      let cmpStats: ComparatorStats | undefined;

      before(async () => {
        controller = new TestController(profile.is3DCase ?? false);
        await controller.createPlayers(profile.canvas.width, profile.canvas.height, renderFramework);

        if (profile.withPerfStats) {
          cmpStats = new ComparatorStats(renderFramework);
        }
      });

      after(() => {
        if (!controller) {
          return;
        }
        controller.disposePlayers();

        if (cmpStats) {
          appendStatsLabel(cmpStats.getStatsInfo());
        }
      });

      if (profile.withGpuCheck) {
        it(`${renderFramework} 检查`, () => {
          if (!controller) {
            throw new Error('[Test] Controller is not ready.');
          }
          assertGpuCapability(renderFramework, controller);
        });
      }

      profile.scenes.forEach((scene, sceneIndex) => {
        it(scene.name, async () => {
          if (!controller) {
            throw new Error('[Test] Controller is not ready.');
          }
          console.info(`[Test] Compare begin: ${scene.name}, ${scene.url ?? scene.id}`);

          const result = await runFrameCompareLoop({
            controller,
            profile,
            scene,
            renderFramework,
            idx: [frameworkIndexOffset + frameworkIndex, sceneIndex],
          });

          expect(result.diffRatioList).to.be.eqls([]);

          if (cmpStats) {
            cmpStats.addSceneInfo(
              `${scene.id}@${scene.name}`,
              result.oldLoadCost,
              result.oldCreateCost,
              result.newLoadCost,
              result.newCreateCost,
            );
          }

          console.info(`[Test] Compare end: ${scene.name}, ${scene.url ?? scene.id}`);
        });
      });
    });
  });
}
