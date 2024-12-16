import type { GLTFResources } from '@vvfx/resource-detection';
import { GLTFTools, clearPreviousUUIDSet } from '@vvfx/resource-detection';
import type { Player, spec } from '@galacean/effects';
import { math } from '@galacean/effects';

interface LoadSceneOptions {
  gltf: {
    remark?: string | Uint8Array,
    resource: string | Uint8Array | GLTFResources,
    compatibleMode?: 'gltf' | 'tiny3d',
    checkSerializer?: boolean,
    skyboxType?: string,
    skyboxVis?: boolean,
    ignoreSkybox?: boolean,
  },
  effects: {
    renderer?: any,
    duration?: number,
    endBehavior?: spec.EndBehavior,
    playAnimation?: number | string,
    playAllAnimation?: boolean,
  },
}

interface LoadSceneResult {
  source: string,
  items: any[],
  sceneAABB: {
    min: spec.vec3,
    max: spec.vec3,
  },
}

interface LoadGLTFSceneOptions {
  url: string,
  player: Player,
  playAnimation?: number,
  playAllAnimation?: boolean,
  camera?: {
    position?: spec.vec3,
    rotation?: spec.vec3,
  },
}

export class OldLoaderImplEx {
  loaderImpl: any;
  async loadScene (options: LoadSceneOptions): Promise<LoadSceneResult> {
    const gltfResource = options.gltf.resource;

    if (typeof gltfResource === 'string' || gltfResource instanceof Uint8Array) {
      if (typeof gltfResource === 'string') {
        console.info(`[Test] Load url: ${gltfResource}`);
      }

      clearPreviousUUIDSet();
      const gltfResult = await GLTFTools.loadGLTF(gltfResource);
      const gltfDoc = gltfResult.doc;
      const gltfJson = gltfResult.json;

      options.gltf.remark = gltfResource;
      options.gltf.resource = GLTFTools.processGLTFForEditorECS(gltfDoc, gltfJson);
    }

    this.loaderImpl = new (window as any).ge.modelPlugin.LoaderImpl();

    return this.loaderImpl.loadScene(options);
  }
}

export async function oldLoadGLTFScene (options: LoadGLTFSceneOptions) {
  const duration = 9999;
  const endBehavior = 5;
  const loader = new OldLoaderImplEx();

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
      playAllAnimation: options.playAllAnimation,
    },
  }).then(result => {
    const items = result.items;
    const sceneMin = math.Vector3.fromArray(result.sceneAABB.min);
    const sceneMax = math.Vector3.fromArray(result.sceneAABB.max);
    const sceneAABB = new math.Box3(sceneMin, sceneMax);
    const sceneRadius = sceneAABB.getBoundingSphere(new math.Sphere()).radius;
    const sceneCenter = sceneAABB.getCenter(new math.Vector3());
    const position = sceneCenter.add(new math.Vector3(0, 0, sceneRadius * 1.71));
    const cameraPosition = options.camera?.position ?? position.toArray();
    const cameraRotation = options.camera?.rotation ?? [0, 0, 0];

    loader.loaderImpl.addCamera({
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

    loader.loaderImpl.addLight({
      lightType: 'ambient',
      color: { r: 1, g: 1, b: 1, a: 1 },
      intensity: 0.1,
      //
      name: 'env-light',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      duration: duration,
      endBehavior: 5,
    });

    const loadResult = loader.loaderImpl.getLoadResult();

    return loadResult.jsonScene;
  });
}
