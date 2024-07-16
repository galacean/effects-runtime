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
        console.info(`Load url: ${gltfResource}`);
      }

      clearPreviousUUIDSet();
      const gltfResult = await GLTFTools.loadGLTF(gltfResource);
      const gltfDoc = gltfResult.doc;
      const gltfJson = gltfResult.json;

      options.gltf.remark = gltfResource;
      options.gltf.resource = GLTFTools.processGLTFForEditor(gltfDoc, gltfJson);
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

    items.push({
      id: 'extra-camera',
      duration: duration,
      name: 'extra-camera',
      pn: 0,
      type: 'camera',
      transform: {
        position: cameraPosition,
        rotation: cameraRotation,
      },
      endBehavior: 5,
      content: {
        options: {
          duration: duration,
          near: 0.2,
          far: 500,
          fov: 60,
          clipMode: 0,
        },
      },
    });

    items.push({
      id: 'env-light',
      duration: duration,
      name: 'env-light',
      pn: 0,
      type: 'light',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      endBehavior: 5,
      content: {
        options: {
          lightType: 'ambient',
          color: [255, 255, 255, 255],
          intensity: 0.1,
        },
      },
    });

    return {
      'compositionId': 1,
      'requires': [],
      'compositions': [{
        'name': 'composition_1',
        'id': 1,
        'duration': duration,
        'endBehavior': 2,
        'camera': { 'fov': 30, 'far': 20, 'near': 0.1, 'position': [0, 0, 8], 'clipMode': 1 },
        'items': items,
        'meta': { 'previewSize': [750, 1334] },
      }],
      'gltf': [],
      'images': [],
      'version': '0.8.9-beta.9',
      'shapes': [],
      'plugins': ['model'],
      'type': 'mars',
      '_imgs': { '1': [] },
    };
  });
}
