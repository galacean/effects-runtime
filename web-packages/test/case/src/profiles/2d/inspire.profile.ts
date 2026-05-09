import type { FrameCompareScene, FrameSuiteProfile } from '../../framework/types/profile';
import sceneList from '../../assets/2d/inspire.scene-list';
import type { SceneAssetRecord } from '../shared/scene-mappers';
import { mapScenes } from '../shared/scene-mappers';
import { DEFAULT_CANVAS_SIZE, DEFAULT_PIXEL_DIFF_THRESHOLD, getTimePointsByPolicy } from '../shared/defaults';
import { buildProfile } from '../shared/profile-builder';

const scenes: FrameCompareScene[] = mapScenes(sceneList as SceneAssetRecord, scene => {
  return {
    ...scene,
    breakWhenTimeGteDuration: true,
    beforeScene: ({ controller }) => {
      controller.newPlayer.player.destroyCurrentCompositions();
    },
    afterScene: ({ controller }) => {
      controller.newPlayer.disposeScene();
    },
  };
});

export const inspire2DProfile: FrameSuiteProfile = buildProfile({
  id: '2d-inspire',
  title: '灵感中心',
  frameworkIndexOffset: 4,
  frameworks: ['webgl', 'webgl2'],
  canvas: DEFAULT_CANVAS_SIZE,
  timeoutMs: 1800 * 1000,
  pixelDiffThreshold: DEFAULT_PIXEL_DIFF_THRESHOLD,
  defaultAccumRatioThreshold: 3e-4,
  timePoints: getTimePointsByPolicy('2d-inspire'),
  withGpuCheck: true,
  withPerfStats: true,
}, scenes);
