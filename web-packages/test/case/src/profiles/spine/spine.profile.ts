import type { FrameCompareScene, FrameSuiteProfile } from '../../framework/types/profile';
import sceneList from '../../assets/spine/spine.scene-list';
import type { SceneAssetRecord } from '../shared/scene-mappers';
import { mapScenes } from '../shared/scene-mappers';
import { DEFAULT_CANVAS_SIZE, DEFAULT_PIXEL_DIFF_THRESHOLD, getTimePointsByPolicy } from '../shared/defaults';
import { buildProfile } from '../shared/profile-builder';

const scenes: FrameCompareScene[] = mapScenes(sceneList as SceneAssetRecord);

export const spineProfile: FrameSuiteProfile = buildProfile({
  id: 'spine',
  title: 'Spine测试',
  frameworks: ['webgl', 'webgl2'],
  canvas: DEFAULT_CANVAS_SIZE,
  timeoutMs: 1800 * 1000,
  pixelDiffThreshold: DEFAULT_PIXEL_DIFF_THRESHOLD,
  defaultAccumRatioThreshold: 1e-4,
  timePoints: getTimePointsByPolicy('spine'),
  withGpuCheck: false,
  withPerfStats: true,
}, scenes);
