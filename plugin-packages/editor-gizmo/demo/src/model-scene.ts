import { math, spec, type Composition, type Player } from '@galacean/effects';
import '@galacean/effects-plugin-model';
import { LoaderImplEx } from '../../../model/src/helper';

export async function loadModelScene (player: Player, wireframeOnly = false): Promise<Composition> {
  const loader = new LoaderImplEx();

  loader.initial(player.engine);
  const result = await loader.loadScene({
    gltf: { resource: 'https://gw.alipayobjects.com/os/gltf-asset/89748482160728/DamagedHelmet.glb' },
    effects: { duration: 99999, endBehavior: spec.EndBehavior.restart },
  });
  const bounds = new math.Box3(math.Vector3.fromArray(result.sceneAABB.min), math.Vector3.fromArray(result.sceneAABB.max));
  const radius = bounds.getBoundingSphere(new math.Sphere()).radius;
  const position = bounds.getCenter(new math.Vector3()).add(new math.Vector3(0, 0, radius * 3));

  loader.addCamera({
    name: 'extra-camera', position: position.toArray(), rotation: [0, 0, 0],
    near: 0.1, far: 1000, fov: 45, clipMode: spec.CameraClipMode.landscape,
    duration: 99999, endBehavior: spec.EndBehavior.restart,
  });
  loader.addLight({
    name: 'main-light', lightType: spec.LightType.directional, color: { r: 1, g: 1, b: 1, a: 1 }, intensity: 2,
    position: [0, 0, 0], rotation: [45, 45, 0], scale: [1, 1, 1], duration: 99999, endBehavior: spec.EndBehavior.restart,
  });
  const { jsonScene } = loader.getLoadResult();

  if (wireframeOnly) {
    jsonScene.components = jsonScene.components.map(component => component.dataType === spec.DataType.MeshComponent
      ? { ...component, hide: true } : component);
  }
  loader.dispose();

  return player.loadScene(jsonScene);
}
