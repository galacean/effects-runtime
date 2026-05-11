import type { FrameCompareScene, FrameSuiteProfile } from '../../framework/types/profile';
import sceneList from '../../assets/2d/interact.scene-list';
import { runRandomHitTest } from '../shared/hooks';
import type { SceneAssetRecord } from '../shared/scene-mappers';
import { mapScenes } from '../shared/scene-mappers';
import { DEFAULT_CANVAS_SIZE, DEFAULT_PIXEL_DIFF_THRESHOLD, getTimePointsByPolicy } from '../shared/defaults';
import { buildProfile } from '../shared/profile-builder';

const scenes: FrameCompareScene[] = mapScenes(sceneList as SceneAssetRecord, scene => {
  return {
    ...scene,
    beforeEachFrame: ({ controller, timeIndex }) => {
      runRandomHitTest(controller, timeIndex);
    },
  };
});

export const interact2DProfile: FrameSuiteProfile = buildProfile({
  id: '2d-interact',
  title: '交互测试',
  frameworkIndexOffset: 0,
  frameworks: ['webgl', 'webgl2'],
  canvas: DEFAULT_CANVAS_SIZE,
  timeoutMs: 300 * 1000,
  pixelDiffThreshold: DEFAULT_PIXEL_DIFF_THRESHOLD,
  defaultAccumRatioThreshold: 1.5e-4,
  timePoints: getTimePointsByPolicy('2d-interact'),
}, scenes);
