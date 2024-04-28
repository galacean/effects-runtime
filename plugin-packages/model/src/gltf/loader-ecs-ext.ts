// 插件在这里强依赖resource-detection，只给demo使用，不会影响发包。发包的代码不会依赖resource-detection。
// 所以插件其他位置使用resource-detection必须import type，否则会导致编辑器出错。
import { GLTFTools } from '@vvfx/resource-detection';
import type { Player, spec } from '@galacean/effects';
import type { LoadSceneOptions, LoadSceneECSResult } from './protocol';
import { LoaderECSImpl } from './loader-ecs';
import { Box3, Vector3, Sphere } from '../runtime/math';

export class LoaderECSEx extends LoaderECSImpl {
  override async loadScene (options: LoadSceneOptions): Promise<LoadSceneECSResult> {
    const gltfResource = options.gltf.resource;

    if (typeof gltfResource === 'string' || gltfResource instanceof Uint8Array) {
      if (typeof gltfResource === 'string') {
        console.info(`Load url: ${gltfResource}`);
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
  playAnimation?: number | string,
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
      renderer: options.player.renderer,
      duration: duration,
      endBehavior: endBehavior,
      playAnimation: options.playAnimation,
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
      near: 0.001,
      far: 5000,
      fov: 60,
      clipMode: 0,
      name: 'extra-camera',
      endBehavior: 5,
      duration: duration,
      position: cameraPosition,
      rotation: cameraRotation,
    });

    const loadResult = loader.getLoadResult();

    // items.push({
    //   id: 'env-light',
    //   duration: duration,
    //   name: 'env-light',
    //   pn: 0,
    //   type: 'light',
    //   transform: {
    //     position: [0, 0, 0],
    //     rotation: [0, 0, 0],
    //   },
    //   endBehavior: 5,
    //   content: {
    //     options: {
    //       lightType: 'ambient',
    //       color: [255, 255, 255, 255],
    //       intensity: 0.1,
    //     },
    //   },
    // });

    return loadResult.jsonScene;
  });
}
