import type { FrameCompareScene, FrameSuiteProfile } from '../../framework/types/profile';
import sceneList from '../../assets/2d/dynamic.scene-list';
import { runRandomHitTest } from '../shared/hooks';
import type { DynamicSceneAssetItem } from '../../assets/asset-types';
import type { SceneAssetRecord } from '../shared/scene-mappers';
import { mapScenes } from '../shared/scene-mappers';
import { DEFAULT_CANVAS_SIZE, DEFAULT_PIXEL_DIFF_THRESHOLD, getTimePointsByPolicy } from '../shared/defaults';
import { buildProfile } from '../shared/profile-builder';

const scenes: FrameCompareScene[] = mapScenes(
  sceneList as SceneAssetRecord<DynamicSceneAssetItem>,
  (scene, item) => {
    return {
      ...scene,
      threshold: item.threshold,
      loadOptions: {
        variables: item.variables,
      },
      beforeEachFrame: ({ controller, timeIndex }) => {
        runRandomHitTest(controller, timeIndex);
      },
    };
  },
);

export const dynamic2DProfile: FrameSuiteProfile = buildProfile({
  id: '2d-dynamic',
  title: '文本/动态换图测试',
  frameworkIndexOffset: 2,
  frameworks: ['webgl', 'webgl2'],
  canvas: DEFAULT_CANVAS_SIZE,
  timeoutMs: 300 * 1000,
  pixelDiffThreshold: DEFAULT_PIXEL_DIFF_THRESHOLD,
  defaultAccumRatioThreshold: 2e-4,
  timePoints: getTimePointsByPolicy('2d-dynamic'),
}, scenes);
