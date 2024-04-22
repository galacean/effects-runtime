import type { Texture, Engine } from '@galacean/effects';
import { spec, generateGUID } from '@galacean/effects';
import type {
  LoaderOptions,
  SkyboxType,
  LoadSceneOptions,
  LoadSceneECSResult,
} from './protocol';
import type {
  ModelAnimationOptions,
  ModelAnimTrackOptions,
  ModelCameraOptions,
  ModelLightOptions,
  ModelSkyboxOptions,
  ModelTreeOptions,
} from '../index';
import { Matrix4 } from '../runtime/math';
import { LoaderHelper } from './loader-helper';
import { WebGLHelper, PluginHelper } from '../utility/plugin-helper';
import type {
  GLTFSkin,
  GLTFMesh,
  GLTFImage,
  GLTFMaterial,
  GLTFTexture,
  GLTFScene,
  GLTFLight,
  GLTFCamera,
  GLTFAnimation,
} from '@vvfx/resource-detection';
import { PSkyboxCreator, PSkyboxType } from '../runtime/skybox';

// type Box3 = math.Box3;

export class LoaderECS {
  private sceneOptions: LoadSceneOptions;
  private loaderOptions: LoaderOptions;
  private gltfScene: GLTFScene;
  private gltfSkins: GLTFSkin[] = [];
  private gltfMeshs: GLTFMesh[] = [];
  private gltfLights: GLTFLight[] = [];
  private gltfCameras: GLTFCamera[] = [];
  private gltfImages: GLTFImage[] = [];
  private gltfTextures: GLTFTexture[] = [];
  private gltfMaterials: GLTFMaterial[] = [];
  private gltfAnimations: GLTFAnimation[] = [];

  composition: spec.Composition;
  images: spec.Image[] = [];
  textures: spec.TextureDefine[] = [];
  items: spec.VFXItemData[] = [];
  components: spec.ComponentData[] = [];
  materials: spec.MaterialData[] = [];
  shaders: spec.ShaderData[] = [];
  geometries: spec.GeometryData[] = [];

  engine: Engine;

  constructor (composition?: spec.Composition) {
    if (composition) {
      this.composition = composition;
    } else {
      this.composition = {
        id: '1',
        name: 'test1',
        duration: 9999,
        endBehavior: spec.CompositionEndBehavior.restart,
        camera: {
          fov: 45,
          far: 2000,
          near: 0.001,
          position: [0, 0, 10],
          rotation: [0, 0, 0],
          clipMode: spec.CameraClipMode.portrait,
        },
        items: [],
      };
    }
  }

  initial (engine: Engine, options?: LoaderOptions) {
    this.engine = engine;
    this.loaderOptions = options ?? {};
  }

  async loadScene (options: LoadSceneOptions): Promise<LoadSceneECSResult> {
    this.clear();
    this.sceneOptions = options;
    this.engine = options.effects.renderer?.engine as Engine;
    this.loaderOptions = { compatibleMode: options.gltf.compatibleMode };
    const gltfResource = options.gltf.resource;

    if (typeof gltfResource === 'string' || gltfResource instanceof Uint8Array) {
      throw new Error('Please load resource by GLTFTools at first');
    }

    this.gltfScene = gltfResource.scenes[0];
    this.gltfSkins = this.gltfScene.skins;
    this.gltfMeshs = gltfResource.meshes;
    this.gltfLights = this.gltfScene.lights;
    this.gltfCameras = this.gltfScene.cameras;
    this.gltfImages = gltfResource.images;
    this.gltfTextures = gltfResource.textures;
    this.gltfMaterials = gltfResource.materials;
    this.gltfAnimations = gltfResource.animations;

    this.images = this.gltfImages.map(gltfImage => {
      const blob = new Blob([gltfImage.imageData.buffer], { type: gltfImage.mimeType ?? 'image/png' });

      return {
        url: URL.createObjectURL(blob),
      };
    });

    this.textures = this.gltfTextures.map(texture => {
      // @ts-expect-error
      texture.textureOptions.generateMipmap = true;

      return texture.textureOptions;
    });
    this.materials = this.gltfMaterials.map(material => material.materialData);

    gltfResource.meshes.forEach(mesh => {
      this.geometries.push(...mesh.geometrysData);
      this.components.push(mesh.meshData);
    });

    this.items = [...gltfResource.scenes[0].vfxItemData];

    return this.getLoadResult();
  }

  getLoadResult (): LoadSceneECSResult {
    const itemIds: spec.DataPath[] = [];

    this.items.forEach(item => itemIds.push({ id: item.id }));
    // @ts-expect-error
    this.composition.items = itemIds;

    const jsonScene: spec.JSONScene = {
      version: '3.0',
      playerVersion: {
        web: '2.0',
        native: '2.0',
      },
      type: 'ge',
      compositionId: this.composition.id,
      compositions: [this.composition],
      images: this.images,
      shapes: [],
      plugins: ['model'],
      textures: this.textures,
      items: this.items,
      components: this.components,
      materials: this.materials,
      shaders: this.shaders,
      geometries: this.geometries,
    };

    return {
      source: this.getRemarkString(),
      jsonScene,
      sceneAABB: {
        min: [-1, -1, -1],
        max: [1, 1, 1],
      },
    };
  }

  addLight (data: ModelLight) {
    const itemId = generateGUID();
    const component: spec.ModelLightComponentData = {
      id: generateGUID(),
      item: { id: itemId },
      dataType: spec.DataType.LightComponent,
      //
      lightType: data.lightType,
      color: data.color,
      intensity: data.intensity,
      range: data.range,
      innerConeAngle: data.innerConeAngle,
      outerConeAngle: data.outerConeAngle,
    };
    const item: spec.VFXItemData = {
      id: itemId,
      name: data.name,
      duration: data.duration,
      type: spec.ItemType.light,
      pn: 0,
      visible: true,
      endBehavior: data.endBehavior,
      transform: {
        position: {
          x: data.position[0],
          y: data.position[1],
          z: data.position[2],
        },
        eulerHint: {
          x: data.rotation[0],
          y: data.rotation[1],
          z: data.rotation[2],
        },
        scale: {
          x: data.scale[0],
          y: data.scale[1],
          z: data.scale[2],
        },
      },
      components: [
        { id: component.id },
      ],
      content: {},
      dataType: spec.DataType.VFXItemData,
    };

    this.items.push(item);
    this.components.push(component);
  }

  addCamera (camera: ModelCamera) {
    const itemId = generateGUID();
    const component: spec.ModelCameraComponentData = {
      id: generateGUID(),
      item: { id: itemId },
      dataType: spec.DataType.CameraComponent,
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
      clipMode: camera.clipMode,
    };
    const item: spec.VFXItemData = {
      id: itemId,
      name: camera.name,
      duration: camera.duration,
      type: 'camera',
      pn: 0,
      visible: true,
      endBehavior: camera.endBehavior,
      transform: {
        position: {
          x: camera.position[0],
          y: camera.position[1],
          z: camera.position[2],
        },
        eulerHint: {
          x: camera.rotation[0],
          y: camera.rotation[1],
          z: camera.rotation[2],
        },
        scale: {
          x: 1,
          y: 1,
          z: 1,
        },
      },
      components: [
        { id: component.id },
      ],
      content: {},
      dataType: spec.DataType.VFXItemData,
    };

    this.items.push(item);
    this.components.push(component);
  }

  processMaterial (materials: GLTFMaterial[], fromGLTF: boolean): void {
    materials.forEach(mat => {
      if (mat.baseColorFactor === undefined) {
        if (fromGLTF) { mat.baseColorFactor = [255, 255, 255, 255]; } else { mat.baseColorFactor = [1, 1, 1, 1]; }
      } else {
        mat.baseColorFactor[0] = this.scaleColorVal(mat.baseColorFactor[0], fromGLTF);
        mat.baseColorFactor[1] = this.scaleColorVal(mat.baseColorFactor[1], fromGLTF);
        mat.baseColorFactor[2] = this.scaleColorVal(mat.baseColorFactor[2], fromGLTF);
        mat.baseColorFactor[3] = this.scaleColorVal(mat.baseColorFactor[3], fromGLTF);
      }

      if (mat.emissiveFactor === undefined) {
        if (fromGLTF) { mat.emissiveFactor = [255, 255, 255, 255]; } else { mat.emissiveFactor = [1, 1, 1, 1]; }
      } else {
        mat.emissiveFactor[0] = this.scaleColorVal(mat.emissiveFactor[0], fromGLTF);
        mat.emissiveFactor[1] = this.scaleColorVal(mat.emissiveFactor[1], fromGLTF);
        mat.emissiveFactor[2] = this.scaleColorVal(mat.emissiveFactor[2], fromGLTF);
        mat.emissiveFactor[3] = this.scaleColorVal(mat.emissiveFactor[3], fromGLTF);
      }

      if (fromGLTF && mat.occlusionTexture !== undefined && mat.occlusionTexture.strength === undefined) {
        mat.occlusionTexture.strength = this.isTiny3dMode() ? 0 : 1;
      }
    });
  }

  createTreeOptions (scene: GLTFScene): ModelTreeOptions {
    const nodeList = scene.nodes.map((node, nodeIndex) => {
      const children = node.children.map(child => {
        if (child.nodeIndex === undefined) { throw new Error(`Undefined nodeIndex for child ${child}`); }

        return child.nodeIndex;
      });
      let pos: spec.vec3 | undefined;
      let quat: spec.vec4 | undefined;
      let scale: spec.vec3 | undefined;

      if (node.matrix !== undefined) {
        if (node.matrix.length !== 16) { throw new Error(`Invalid matrix length ${node.matrix.length} for node ${node}`); }
        const mat = Matrix4.fromArray(node.matrix);
        const transform = mat.getTransform();

        pos = transform.translation.toArray();
        quat = transform.rotation.toArray();
        scale = transform.scale.toArray();
      } else {
        if (node.translation !== undefined) { pos = node.translation as spec.vec3; }
        if (node.rotation !== undefined) { quat = node.rotation as spec.vec4; }
        if (node.scale !== undefined) { scale = node.scale as spec.vec3; }
      }
      node.nodeIndex = nodeIndex;
      const treeNode: spec.TreeNodeOptions = {
        name: node.name,
        transform: {
          position: pos,
          quat: quat,
          scale: scale,
        },
        children: children,
        id: `${node.nodeIndex}`,
        // id: index, id不指定就是index，指定后就是指定的值
      };

      return treeNode;
    });

    const rootNodes = scene.rootNodes.map(root => {
      if (root.nodeIndex === undefined) { throw new Error(`Undefined nodeIndex for root ${root}`); }

      return root.nodeIndex;
    });

    const treeOptions: ModelTreeOptions = {
      nodes: nodeList,
      children: rootNodes,
      animation: -1,
      animations: [],
    };

    return treeOptions;
  }

  createAnimations (animations: GLTFAnimation[]): ModelAnimationOptions[] {
    return animations.map(anim => {
      const tracks = anim.channels.map(channel => {
        const track: ModelAnimTrackOptions = {
          input: channel.input.array as Float32Array,
          output: channel.output.array as Float32Array,
          node: channel.target.node,
          path: channel.target.path,
          interpolation: channel.interpolation,
        };

        return track;
      });

      const newAnim: ModelAnimationOptions = {
        name: anim.name,
        tracks: tracks,
      };

      return newAnim;
    });
  }

  createTexture2D (image: GLTFImage, texture: GLTFTexture, isBaseColor: boolean): Promise<Texture> {
    return WebGLHelper.createTexture2D(this.engine, image, texture, isBaseColor, this.isTiny3dMode());
  }

  createDefaultSkybox (typeName: SkyboxType): Promise<ModelSkyboxOptions> {
    if (typeName !== 'NFT' && typeName !== 'FARM') { throw new Error(`Invalid skybox type name ${typeName}`); }
    //
    const typ = typeName === 'NFT' ? PSkyboxType.NFT : PSkyboxType.FARM;
    const params = PSkyboxCreator.getSkyboxParams(typ);

    return PSkyboxCreator.createSkyboxOptions(this.engine, params);
  }

  scaleColorVal (val: number, fromGLTF: boolean): number {
    return fromGLTF ? LoaderHelper.scaleTo255(val) : LoaderHelper.scaleTo1(val);
  }

  scaleColorVec (vec: number[], fromGLTF: boolean): number[] {
    return vec.map(val => this.scaleColorVal(val, fromGLTF));
  }

  createLightOptions (light: GLTFLight): ModelLightOptions {
    return PluginHelper.createLightOptions(light);
  }

  createCameraOptions (camera: GLTFCamera): ModelCameraOptions | undefined {
    return PluginHelper.createCameraOptions(camera);
  }

  private clear () {
    this.images = [];
    this.textures = [];
    this.items = [];
    this.components = [];
    this.materials = [];
    this.shaders = [];
    this.geometries = [];
  }

  /**
   * 按照传入的动画播放参数，计算需要播放的动画索引
   *
   * @param treeOptions 节点树属性，需要初始化animations列表。
   * @returns 返回计算的动画索引，-1表示没有动画需要播放，-88888888表示播放所有动画。
   */
  getPlayAnimationIndex (treeOptions: ModelTreeOptions): number {
    const animations = treeOptions.animations;

    if (animations === undefined || animations.length <= 0) {
      // 硬编码，内部指定的不播放动画的索引值
      return -1;
    }

    if (this.isPlayAllAnimation()) {
      // 硬编码，内部指定的播放全部动画的索引值
      return -88888888;
    }

    const animationInfo = this.sceneOptions.effects.playAnimation;

    if (animationInfo === undefined) {
      return -1;
    }

    if (typeof animationInfo === 'number') {
      if (animationInfo >= 0 && animationInfo < animations.length) {
        return animationInfo;
      } else {
        return -1;
      }
    } else {
      // typeof animationInfo === 'string'
      let animationIndex = -1;

      // 通过动画名字查找动画索引
      animations.forEach((anim, index) => {
        if (anim.name === animationInfo) {
          animationIndex = index;
        }
      });

      return animationIndex;
    }
  }

  isPlayAnimation (): boolean {
    return this.sceneOptions.effects.playAnimation !== undefined;
  }

  isPlayAllAnimation (): boolean {
    return this.sceneOptions.effects.playAllAnimation === true;
  }

  getRemarkString (): string {
    const remark = this.sceneOptions.gltf.remark;

    if (remark === undefined) {
      return 'Unknown';
    } else if (typeof remark === 'string') {
      return remark;
    } else {
      return 'BinaryBuffer';
    }
  }

  isTiny3dMode (): boolean {
    return this.loaderOptions.compatibleMode === 'tiny3d';
  }

  getItemDuration (): number {
    return this.sceneOptions.effects.duration ?? 9999;
  }

  getItemEndBehavior (): spec.ItemEndBehavior {
    return this.sceneOptions.effects.endBehavior ?? spec.ItemEndBehavior.loop;
  }

  getSkyboxType (): PSkyboxType | undefined {
    const typeName = this.sceneOptions.gltf.skyboxType;

    switch (typeName) {
      case 'NFT': return PSkyboxType.NFT;
      case 'FARM': return PSkyboxType.FARM;
    }
  }

  isSkyboxVis (): boolean {
    return this.sceneOptions.gltf.skyboxVis === true;
  }

  ignoreSkybox (): boolean {
    return this.sceneOptions.gltf.ignoreSkybox === true;
  }

  isEnvironmentTest (): boolean {
    if (typeof this.sceneOptions.gltf.remark === 'string') {
      return this.sceneOptions.gltf.remark.includes('EnvironmentTest');
    } else {
      return false;
    }
  }

}

export interface ModelCamera {
  fov: number,
  near: number,
  far: number,
  clipMode: spec.CameraClipMode,
  //
  name: string,
  position: spec.vec3,
  rotation: spec.vec3,
  duration: number,
  endBehavior: spec.ItemEndBehavior,
}

export interface ModelLight {
  lightType: spec.LightType,
  color: spec.ColorData,
  intensity: number,
  range?: number,
  innerConeAngle?: number,
  outerConeAngle?: number,
  //
  name: string,
  position: spec.vec3,
  rotation: spec.vec3,
  scale: spec.vec3,
  duration: number,
  endBehavior: spec.ItemEndBehavior,
}
