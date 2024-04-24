// 插件在这里强依赖resource-detection，只给demo使用，不会影响发包。发包的代码不会依赖resource-detection。
// 所以插件其他位置使用resource-detection必须import type，否则会导致编辑器出错。
import type {
  GLTFResources,
} from '@vvfx/resource-detection';
import {
  GLTFImage,
  GLTFTexture,
  GLTFMaterial,
  GLTFMesh,
  GLTFScene,
  GLTFAnimation,
  GLTFImageBasedLight,
  GLTFTools,
} from '@vvfx/resource-detection';
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

      if (options.gltf.checkSerializer === true) {
        await this.checkSerializer(options.gltf.resource);
      }
    }

    return super.loadScene(options);
  }

  /**
   * 检查序列化和反序列逻辑，排查渲染场景中渲染正常和编辑器中渲染错误的问题。
   * 针对Image、Texture、Material、Mesh、Scene、Animation和IBL的检查。
   *
   * @param res 加载的GLTF场景资源
   */
  async checkSerializer (res: GLTFResources): Promise<void> {
    const images = res.images;

    for (let i = 0; i < images.length; i++) {
      const data = await images[i].serialize();

      images[i] = await GLTFImage.deserialize(data);
    }
    //
    const textures = res.textures;

    for (let i = 0; i < textures.length; i++) {
      const data = await textures[i].serialize();

      textures[i] = await GLTFTexture.deserialize(data);
    }
    //
    const materials = res.materials;

    for (let i = 0; i < materials.length; i++) {
      const data = await materials[i].serialize();

      materials[i] = await GLTFMaterial.deserialize(data);
    }
    //
    const meshes = res.meshes;

    for (let i = 0; i < meshes.length; i++) {
      const data = await meshes[i].serialize();

      meshes[i] = await GLTFMesh.deserialize(data);
    }
    //
    const scenes = res.scenes;

    for (let i = 0; i < scenes.length; i++) {
      const data = await scenes[i].serialize();

      scenes[i] = await GLTFScene.deserialize(data);
    }
    //
    const animations = res.animations;

    for (let i = 0; i < animations.length; i++) {
      const data = await animations[i].serialize();

      animations[i] = await GLTFAnimation.deserialize(data);
    }
    //
    const imageBasedLights = res.imageBasedLights;

    for (let i = 0; i < imageBasedLights.length; i++) {
      const data = await imageBasedLights[i].serialize();

      imageBasedLights[i] = await GLTFImageBasedLight.deserialize(data);
    }
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
