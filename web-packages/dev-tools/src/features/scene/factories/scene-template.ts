import { generateGUID, spec } from '@galacean/effects';

export function createEmptyScene (): spec.JSONScene {
  const compositionId = generateGUID(), componentId = generateGUID(), timelineId = generateGUID();
  const component: spec.CompositionComponentData = {
    id: componentId, dataType: spec.DataType.CompositionComponent, item: { id: compositionId },
    items: [], timelineAsset: { id: timelineId }, sceneBindings: [],
  };
  const timeline: spec.TimelineAssetData = { id: timelineId, dataType: spec.DataType.TimelineAsset, tracks: [] };

  return {
    version: spec.JSONSceneVersion['3_6'], type: 'ge', playerVersion: { web: '2.8.3', native: '0.0.1.202311221223' },
    compositionId, compositions: [{
      id: compositionId, name: 'Untitled Scene', duration: 5, startTime: 0, endBehavior: spec.EndBehavior.restart,
      previewSize: [750, 1624], children: [], components: [{ id: componentId }],
      camera: { fov: 60, far: 40, near: 0.1, clipMode: spec.CameraClipMode.portrait, position: [0, 0, 8], rotation: [0, 0, 0] },
    }],
    components: [component], miscs: [timeline], items: [], images: [], fonts: [], plugins: [],
    materials: [], shaders: [], geometries: [], textures: [], animations: [], bins: [],
  };
}
