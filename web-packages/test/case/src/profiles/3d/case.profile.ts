import type { FrameCompareScene, FrameSuiteProfile } from '../../framework/types/profile';
import sceneList from '../../assets/3d/case.scene-list';
import { is3DCaseFullTimeScene } from '../../assets/asset-tags';
import { getTimePointsByPolicy } from '../shared/defaults';

const scenes: FrameCompareScene[] = Object.keys(sceneList).map(key => {
  const item = sceneList[key as keyof typeof sceneList] as {
    name: string,
    url: string,
    autoAdjustScene?: boolean,
    enableDynamicSort?: boolean,
  };
  const autoAdjustScene = item.autoAdjustScene ?? false;
  const enableDynamicSort = item.enableDynamicSort ?? false;
  const useFullTimePoints = is3DCaseFullTimeScene(item.name);

  return {
    id: key,
    name: item.name,
    url: item.url,
    timePoints: useFullTimePoints ? getTimePointsByPolicy('3d-full') : getTimePointsByPolicy('single'),
    breakWhenTimeGteDuration: true,
    loadOptions: {
      pluginData: {
        compatibleMode: 'tiny3d',
        autoAdjustScene,
        enableDynamicSort,
      },
    },
  };
});

export const case3DProfile: FrameSuiteProfile = {
  id: '3d-case',
  title: '3D 帧对比',
  frameworkIndexOffset: 2,
  frameworks: ['webgl', 'webgl2'],
  canvas: {
    width: 512,
    height: 512,
  },
  timeoutMs: 1800 * 1000,
  pixelDiffThreshold: 1,
  defaultAccumRatioThreshold: 3.0e-4,
  timePoints: [0],
  breakWhenTimeGteDuration: true,
  withGpuCheck: true,
  withPerfStats: true,
  is3DCase: true,
  scenes,
};
