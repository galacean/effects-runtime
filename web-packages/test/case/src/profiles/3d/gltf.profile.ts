import type { FrameCompareScene, FrameSuiteProfile } from '../../framework/types/profile';
import gltfList from '../../assets/3d/gltf.scene-list';
import { getGLTFLoadOptionsBySceneName, isGLTFAllTimeScene } from '../../assets/asset-tags';
import { resolveAssetURL } from '../../assets/asset-resolver';
import { oldLoadGLTFScene } from './gltf-loaders/old-loader';
import { loadGLTFSceneECS } from './gltf-loaders/new-loader';
import { copySceneCamera } from './gltf-shared';
import { getTimePointsByPolicy } from '../shared/defaults';

const scenes: FrameCompareScene[] = gltfList.map(url => {
  const tokens = url.split('/');
  const key = tokens[tokens.length - 1];
  const resolvedURL = resolveAssetURL(url);

  return {
    id: key,
    name: key.length > 24 ? key.substring(0, 24) : key,
    url: resolvedURL,
    timePoints: isGLTFAllTimeScene(key) ? getTimePointsByPolicy('gltf-full') : getTimePointsByPolicy('single'),
    loadOptions: {
      pluginData: {
        compatibleMode: 'tiny3d',
        autoAdjustScene: false,
        enableDynamicSort: true,
      },
    },
    setupPlayers: async ({ controller, scene }) => {
      if (!scene.url) {
        throw new Error(`[Test] Scene url is required: ${scene.id}`);
      }

      const { oldPlayer, newPlayer } = controller;
      const loadGLTFOptions = getGLTFLoadOptionsBySceneName(scene.id);
      const oldScene = await oldLoadGLTFScene({
        url: scene.url,
        player: oldPlayer.player,
        ...loadGLTFOptions,
      });
      const newScene = await loadGLTFSceneECS({
        url: scene.url,
        player: newPlayer.player,
        ...loadGLTFOptions,
      });

      copySceneCamera(oldScene, newScene);

      await oldPlayer.initialize(oldScene, scene.loadOptions ?? {});
      await newPlayer.initialize(newScene, scene.loadOptions ?? {});
    },
  };
});

export const gltf3DProfile: FrameSuiteProfile = {
  id: '3d-gltf',
  title: 'glTF 帧对比',
  frameworkIndexOffset: 0,
  frameworks: ['webgl', 'webgl2'],
  canvas: {
    width: 512,
    height: 512,
  },
  timeoutMs: 1800 * 1000,
  pixelDiffThreshold: 1,
  defaultAccumRatioThreshold: 2.0e-4,
  timePoints: [0],
  withGpuCheck: true,
  withPerfStats: true,
  scenes,
};
