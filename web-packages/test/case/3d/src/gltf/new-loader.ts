import { GLTFTools } from '@vvfx/resource-detection';
import type { Player } from '@galacean/effects';
import type { LoadSceneOptions, LoadSceneResult } from '@galacean/effects-plugin-model';
import type { spec } from '@galacean/effects';
import { LoaderImpl } from '@galacean/effects-plugin-model';
import { Box3, Vector3, Sphere } from '@galacean/effects-plugin-model';

export class LoaderECSEx extends LoaderImpl {
  override async loadScene (options: LoadSceneOptions): Promise<LoadSceneResult> {
    const gltfResource = options.gltf.resource;

    if (typeof gltfResource === 'string' || gltfResource instanceof Uint8Array) {
      if (typeof gltfResource === 'string') {
        console.info(`Load url: ${gltfResource}.`);
      }

      const gltfResult = await GLTFTools.loadGLTF(gltfResource);
      const gltfDoc = gltfResult.doc;
      const gltfJson = gltfResult.json;

      options.gltf.remark = gltfResource;
      options.gltf.resource = GLTFTools.processGLTFForEditorECS(gltfDoc, gltfJson);
    }

    return super.loadScene(options);
  }
}

export interface LoadGLTFSceneECSOptions {
  url: string,
  player: Player,
  playAnimation?: number,
  playAllAnimation?: boolean,
  camera?: {
    position?: spec.vec3,
    rotation?: spec.vec3,
  },
}

export async function loadGLTFSceneECS (options: LoadGLTFSceneECSOptions) {
  const duration = 9999;
  const endBehavior = 5;
  const loader = new LoaderECSEx();

  return loader.loadScene({
    gltf: {
      resource: options.url,
      compatibleMode: 'tiny3d',
      skyboxType: 'NFT',
      skyboxVis: true,
    },
    effects: {
      duration: duration,
      endBehavior: endBehavior,
      playAnimation: options.playAnimation,
      playAllAnimation: options.playAllAnimation,
    },
  }).then(result => {
    const sceneMin = Vector3.fromArray(result.sceneAABB.min);
    const sceneMax = Vector3.fromArray(result.sceneAABB.max);
    const sceneAABB = new Box3(sceneMin, sceneMax);
    const sceneRadius = sceneAABB.getBoundingSphere(new Sphere()).radius;
    const sceneCenter = sceneAABB.getCenter(new Vector3());
    const position = sceneCenter.add(new Vector3(0, 0, sceneRadius * 1.71));
    const cameraPosition = options.camera?.position ?? position.toArray();
    const cameraRotation = options.camera?.rotation ?? [0, 0, 0];

    loader.addCamera({
      near: 0.2,
      far: 500,
      fov: 60,
      clipMode: 0,
      name: 'extra-camera',
      endBehavior: 5,
      duration: duration,
      position: cameraPosition,
      rotation: cameraRotation,
    });

    const loadResult = loader.getLoadResult();

    return loadResult.jsonScene;
  });
}

