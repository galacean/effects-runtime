import type { SceneAssetItem } from '../../assets/asset-types';
import { resolveAssetURL } from '../../assets/asset-resolver';
import type { FrameCompareScene } from '../../framework/types/profile';

export type SceneAssetRecord<T extends SceneAssetItem = SceneAssetItem> = Record<string, T>;

export function mapScenes<T extends SceneAssetItem> (
  sceneList: SceneAssetRecord<T>,
  mapScene?: (scene: FrameCompareScene, item: T, key: string) => FrameCompareScene,
): FrameCompareScene[] {
  return Object.keys(sceneList).map(key => {
    const item = sceneList[key];
    const scene: FrameCompareScene = {
      id: key,
      name: item.name,
      url: resolveAssetURL(item.url),
    };

    return mapScene ? mapScene(scene, item, key) : scene;
  });
}
