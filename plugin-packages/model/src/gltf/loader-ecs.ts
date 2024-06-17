import { spec, generateGUID, glContext } from '@galacean/effects';
import type { Texture, Engine, TextureSourceOptions } from '@galacean/effects';
import type {
  LoaderOptions, SkyboxType, LoadSceneOptions, LoadSceneECSResult, LoaderECS,
} from './protocol';
import type {
  ModelMeshComponentData, ModelSkyboxComponentData, ModelAnimationOptions,
  ModelAnimTrackOptions, ModelCameraOptions, ModelLightOptions,
  ModelTreeOptions, ModelLightComponentData, ModelCameraComponentData,
} from '../index';
import {
  Matrix4, PSkyboxCreator, PSkyboxType, UnlitShaderGUID, PBRShaderGUID, RenderType, CullMode,
} from '../runtime';
import { LoaderHelper } from './loader-helper';
import { WebGLHelper, PluginHelper } from '../utility';
import type {
  GLTFSkin, GLTFMesh, GLTFImage, GLTFMaterial, GLTFTexture, GLTFScene, GLTFLight,
  GLTFCamera, GLTFAnimation, GLTFResources,
} from '@vvfx/resource-detection';

export class LoaderECSImpl implements LoaderECS {
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

  composition: spec.CompositionData;
  images: spec.Image[] = [];
  textures: spec.TextureDefine[] = [];
  items: spec.VFXItemData[] = [];
  components: spec.ComponentData[] = [];
  materials: spec.MaterialData[] = [];
  shaders: spec.ShaderData[] = [];
  geometries: spec.GeometryData[] = [];
  animations: spec.AnimationClipData[] = [];

  engine: Engine;

  constructor (composition?: spec.CompositionData) {
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
        timelineAsset:{ id:generateGUID() },
        sceneBindings:[],
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
      throw new Error('Please load resource by GLTFTools at first.');
    }
    this.processGLTFResource(gltfResource);
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
        id: generateGUID(),
        url: URL.createObjectURL(blob),
      };
    });

    this.textures = this.gltfTextures.map(texture => {
      const textureOptions = texture.textureOptions;
      const source = textureOptions.source;

      if (typeof source === 'number') {
        const imageId = generateGUID();

        // @ts-expect-error
        textureOptions.source = {
          id: imageId,
        };
        this.images[source].id = imageId;
      }

      return textureOptions;
    });
    this.materials = this.gltfMaterials.map(material => {
      return material.materialData;
    });

    gltfResource.meshes.forEach(mesh => {
      this.geometries.push(mesh.geometryData);
    });
    const gltfScene = gltfResource.scenes[0];

    gltfScene.meshesComponentData.forEach(mesh => this.checkMeshComponentData(mesh, gltfResource));

    this.components.push(...gltfScene.camerasComponentData);
    this.components.push(...gltfScene.lightsComponentData);
    this.components.push(...gltfScene.meshesComponentData);
    this.components.push(...gltfScene.animationsComponentData);

    this.animations = [];
    this.gltfAnimations.forEach(anim => {
      this.animations.push(anim.animationClipData);
    });

    this.items = [...gltfResource.scenes[0].vfxItemData];
    this.items.forEach(item => {
      if (item.type === 'root' as spec.ItemType) {
        item.type = 'ECS' as spec.ItemType;
      }
    });

    if (options.gltf.skyboxType) {
      await this.addSkybox({
        skyboxType: options.gltf.skyboxType,
        renderable: options.gltf.skyboxVis,
      });
    }

    return this.getLoadResult();
  }

  checkMeshComponentData (mesh: ModelMeshComponentData, resource: GLTFResources): void {
    if (mesh.materials.length <= 0) {
      throw new Error(`Submesh array is empty: ${mesh}.`);
    }

    let geometryData: spec.GeometryData | undefined;

    resource.meshes.forEach(meshData => {
      if (meshData.geometryData.id === mesh.geometry.id) {
        geometryData = meshData.geometryData;
      }
    });

    if (geometryData === undefined) {
      throw new Error(`Can't find geometry data for ${mesh.geometry.id}.`);
    }

    if (geometryData.subMeshes.length !== mesh.materials.length) {
      throw new Error(`Submeshes and materials mismach: ${geometryData.subMeshes.length}, ${mesh.materials.length}.`);
    }
    //mesh.materials.length !=
  }

  processGLTFResource (resource: GLTFResources): void {
    const dataMap: Record<string, TextureSourceOptions> = {};
    const { textures, materials, scenes } = resource;

    textures.forEach(tex => {
      const texData = tex.textureOptions;
      const texId = (texData as unknown as spec.EffectsObjectData).id;

      if (texId) {
        if (dataMap[texId]) {
          console.error(`Duplicate GUID found: ${texId}, old ${dataMap[texId]}, new ${texData}.`);
        }
        dataMap[texId] = texData;
      } else {
        console.error(`No GUID in texture Data: ${texData}.`);
      }
    });

    materials.forEach(mat => {
      const materialData = mat.materialData;

      this.processMaterialData(materialData);

      if (materialData.shader?.id === UnlitShaderGUID) {
        this.processMaterialTexture(materialData, '_BaseColorSampler', true, dataMap);
      } else if (materialData.shader?.id === PBRShaderGUID) {
        this.processMaterialTexture(materialData, '_BaseColorSampler', true, dataMap);
        this.processMaterialTexture(materialData, '_MetallicRoughnessSampler', false, dataMap);
        this.processMaterialTexture(materialData, '_NormalSampler', false, dataMap);
        this.processMaterialTexture(materialData, '_OcclusionSampler', false, dataMap);
        this.processMaterialTexture(materialData, '_EmissiveSampler', false, dataMap);
      }
    });

    const gltfScene = scenes[0];

    gltfScene.camerasComponentData.forEach(comp => this.processCameraComponentData(comp));
    gltfScene.lightsComponentData.forEach(comp => this.processLightComponentData(comp));
    gltfScene.meshesComponentData.forEach(comp => this.processMeshComponentData(comp));
  }

  processComponentData (components: spec.EffectComponentData[]): void {
    components.forEach(comp => {
      if (comp.dataType === spec.DataType.LightComponent) {
        this.processLightComponentData(comp as unknown as ModelLightComponentData);
      } else if (comp.dataType === spec.DataType.CameraComponent) {
        this.processCameraComponentData(comp as unknown as ModelCameraComponentData);
      } else if (comp.dataType === spec.DataType.MeshComponent) {
        this.processMeshComponentData(comp as unknown as ModelMeshComponentData);
      } else if (comp.dataType === spec.DataType.SkyboxComponent) {
        this.processSkyboxComponentData(comp as unknown as ModelSkyboxComponentData);
      }
    });
  }

  processLightComponentData (light: ModelLightComponentData): void {
    if (!light.color) {
      light.color = { r: 1, g: 1, b: 1, a: 1 };
    }

    if (!light.intensity) {
      light.intensity = 1;
    }

    if (light.lightType === spec.LightType.point) {
      if (!light.range) {
        light.range = 0;
      }
    } else if (light.lightType === spec.LightType.spot) {
      if (!light.range) {
        light.range = 0;
      }

      if (!light.innerConeAngle) {
        light.innerConeAngle = 0;
      }

      if (!light.outerConeAngle) {
        light.outerConeAngle = Math.PI / 4;
      }
    }
  }

  processCameraComponentData (camera: ModelCameraComponentData): void {
    if (camera.type === spec.CameraType.perspective) {
      if (camera.fov) {
        camera.fov *= Math.PI / 180;
      }
    }
  }

  processMeshComponentData (mesh: ModelMeshComponentData): void {

  }

  processSkyboxComponentData (skybox: ModelSkyboxComponentData): void {
    if (skybox.intensity === undefined) {
      skybox.intensity = 1;
    }

    if (skybox.reflectionsIntensity === undefined) {
      skybox.reflectionsIntensity = 1;
    }
  }

  processMaterialData (material: spec.MaterialData): void {
    if (material.shader?.id === UnlitShaderGUID) {
      if (!material.colors['_BaseColorFactor']) {
        material.colors['_BaseColorFactor'] = { r: 1, g: 1, b: 1, a: 1 };
      }

      if (material.floats['_AlphaCutoff'] === undefined) {
        material.floats['_AlphaCutoff'] = 0;
      }

      if (!material.stringTags['ZWrite']) {
        material.stringTags['ZWrite'] = String(true);
      }

      if (!material.stringTags['ZTest']) {
        material.stringTags['ZTest'] = String(true);
      }

      if (!material.stringTags['RenderType']) {
        material.stringTags['RenderType'] = RenderType.Opaque;
      }

      if (!material.stringTags['Cull']) {
        material.stringTags['Cull'] = CullMode.Front;
      }
    } else if (material.shader?.id === PBRShaderGUID) {
      if (!material.colors['_BaseColorFactor']) {
        material.colors['_BaseColorFactor'] = { r: 1, g: 1, b: 1, a: 1 };
      }

      if (material.floats['_SpecularAA'] === undefined) {
        material.floats['_SpecularAA'] = 0;
      }

      if (material.floats['_MetallicFactor'] === undefined) {
        material.floats['_MetallicFactor'] = 1;
      }

      if (material.floats['_RoughnessFactor'] === undefined) {
        material.floats['_RoughnessFactor'] = 0;
      }

      if (material.floats['_NormalScale'] === undefined) {
        material.floats['_NormalScale'] = 1;
      }

      if (material.floats['_OcclusionStrength'] === undefined) {
        material.floats['_OcclusionStrength'] = this.isTiny3dMode() ? 0 : 1;
      }

      if (!material.colors['_EmissiveFactor']) {
        material.colors['_EmissiveFactor'] = { r: 0, g: 0, b: 0, a: 1 };
      }

      if (material.floats['_EmissiveIntensity'] === undefined) {
        material.floats['_EmissiveIntensity'] = 1;
      }

      if (material.floats['_AlphaCutoff'] === undefined) {
        material.floats['_AlphaCutoff'] = 0;
      }

      if (!material.stringTags['ZWrite']) {
        material.stringTags['ZWrite'] = String(true);
      }

      if (!material.stringTags['ZTest']) {
        material.stringTags['ZTest'] = String(true);
      }

      if (!material.stringTags['RenderType']) {
        material.stringTags['RenderType'] = RenderType.Opaque;
      }

      if (!material.stringTags['Cull']) {
        material.stringTags['Cull'] = CullMode.Front;
      }
    } else {
      console.error(`Unknown shader id in material: ${material}.`);
    }
  }

  processTextureOptions (options: TextureSourceOptions, isBaseColor: boolean): void {
    let premultiplyAlpha = false;

    if (this.isTiny3dMode()) {
      // FIXME: 这里因为拿不到图像大小，所以只能先注释掉
      // if (!WebGLHelper.isPow2(imageObj.width) || !WebGLHelper.isPow2(imageObj.height)) {
      //   minFilter = glContext.LINEAR;
      // }
      //
      premultiplyAlpha = isBaseColor ? false : true;
    }

    // FIXME: 需要确认minFilter是否对齐Tiny
    const minFilter = options.minFilter ?? glContext.LINEAR_MIPMAP_LINEAR;
    const generateMipmap = minFilter == glContext.NEAREST_MIPMAP_NEAREST
      || minFilter == glContext.LINEAR_MIPMAP_NEAREST
      || minFilter == glContext.NEAREST_MIPMAP_LINEAR
      || minFilter == glContext.LINEAR_MIPMAP_LINEAR;

    options.wrapS = options.wrapS ?? glContext.REPEAT;
    options.wrapT = options.wrapT ?? glContext.REPEAT;
    options.magFilter = options.magFilter ?? glContext.LINEAR;
    options.minFilter = minFilter;
    options.anisotropic = 1;
    options.premultiplyAlpha = premultiplyAlpha;
    options.generateMipmap = generateMipmap;
  }

  processMaterialTexture (material: spec.MaterialData, textureName: string, isBaseColor: boolean, dataMap: Record<string, TextureSourceOptions>) {
    const texture = material.textures[textureName];

    if (texture) {
      const id = texture.texture.id;
      const texData = dataMap[id];

      if (texData) {
        this.processTextureOptions(texData, isBaseColor);
      }
    }
  }

  getLoadResult (): LoadSceneECSResult {
    const itemIds: spec.DataPath[] = [];

    this.items.forEach(item => itemIds.push({ id: item.id }));
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
      animations: this.animations,
      miscs:[],
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
      // @ts-expect-error
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

  async addSkybox (skybox: ModelSkybox) {
    const itemId = generateGUID();
    const skyboxInfo = this.createSkyboxComponentData(skybox.skyboxType as SkyboxType);
    const { imageList, textureOptionsList, component } = skyboxInfo;

    component.item.id = itemId;
    component.intensity = skybox.intensity ?? 1;
    component.reflectionsIntensity = skybox.reflectionsIntensity ?? 1;
    component.renderable = skybox.renderable ?? true;

    const item: spec.VFXItemData = {
      id: itemId,
      name: `Skybox-${skybox.skyboxType}`,
      duration: skybox.duration ?? 999,
      type: spec.ItemType.skybox,
      pn: 0,
      visible: true,
      endBehavior: spec.ItemEndBehavior.freeze,
      transform: {
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
        eulerHint: {
          x: 0,
          y: 0,
          z: 0,
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

    this.images.push(...imageList);
    // @ts-expect-error
    this.textures.push(...textureOptionsList);
    this.items.push(item);
    this.components.push(component);
  }

  createTreeOptions (scene: GLTFScene): ModelTreeOptions {
    const nodeList = scene.nodes.map((node, nodeIndex) => {
      const children = node.children.map(child => {
        if (child.nodeIndex === undefined) { throw new Error(`Undefined nodeIndex for child ${child}.`); }

        return child.nodeIndex;
      });
      let pos: spec.vec3 = [0, 0, 0];
      let quat: spec.vec4 = [0, 0, 0, 0];
      let scale: spec.vec3 = [0, 0, 0];

      if (node.matrix !== undefined) {
        if (node.matrix.length !== 16) { throw new Error(`Invalid matrix length ${node.matrix.length} for node ${node}.`); }
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
      if (root.nodeIndex === undefined) { throw new Error(`Undefined nodeIndex for root ${root}.`); }

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

  createSkyboxComponentData (typeName: SkyboxType) {
    if (typeName !== 'NFT' && typeName !== 'FARM') {
      throw new Error(`Invalid skybox type name ${typeName}.`);
    }
    //
    const typ = typeName === 'NFT' ? PSkyboxType.NFT : PSkyboxType.FARM;
    const params = PSkyboxCreator.getSkyboxParams(typ);

    return PSkyboxCreator.createSkyboxComponentData(this.engine, params);
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

  createCameraOptions (camera: GLTFCamera): ModelCameraOptions {
    return PluginHelper.createCameraOptions(camera) ?? {
      fov: 45,
      far: 1000,
      near: 0.01,
      clipMode: spec.CameraClipMode.portrait,
    };
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

  getCompositionDuration () {
    return this.composition.duration;
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

export interface ModelSkybox {
  skyboxType: string,
  renderable?: boolean,
  intensity?: number,
  reflectionsIntensity?: number,
  duration?: number,
}

let globalLoader: LoaderECS;

export function getDefaultEffectsGLTFLoaderECS (engine: Engine, options?: LoaderOptions): LoaderECS {
  if (!globalLoader) {
    globalLoader = new LoaderECSImpl();
  }

  (globalLoader as LoaderECSImpl).initial(engine, options);

  return globalLoader;
}

export function setDefaultEffectsGLTFLoaderECS (loader: LoaderECS): void {
  globalLoader = loader;
}

export function getPBRShaderProperties (): string {
  return `
  _BaseColorSampler ("基础贴图", 2D) = "" {}
  _BaseColorFactor ("基础颜色", Color) = (1, 1, 1, 1)
  _MetallicRoughnessSampler ("金属贴图", 2D) = "" {}
  _MetallicFactor ("金属度", Range(0, 1)) = 1
  _RoughnessFactor ("粗糙度", Range(0, 1)) = 1
  [Toggle] _SpecularAA ("高光抗锯齿", Float) = 0
  _NormalSampler ("法线贴图", 2D) = "" {}
  _NormalScale ("法线贴图强度", Range(0, 2)) = 1
  _OcclusionSampler ("AO贴图", 2D) = "" {}
  _OcclusionStrength ("AO贴图强度", Range(0, 1)) = 1
  _EmissiveSampler ("自发光贴图", 2D) = "" {}
  _EmissiveIntensity ("自发光贴图强度", Float) = 1
  _EmissiveFactor ("自发光颜色", Color) = (0, 0, 0, 1)
  _AlphaCutoff ("Alpha测试值", Range(0, 1)) = 0.5
  `;
}

export function getUnlitShaderProperties (): string {
  return `
  _BaseColorSampler ("基础贴图", 2D) = "" {}
  _BaseColorFactor ("基础颜色", Color) = (1, 1, 1, 1)
  _AlphaCutoff ("Alpha测试值", Range(0, 1)) = 0.5
  `;
}

export function getDefaultPBRMaterialData (): spec.MaterialData {
  const material: spec.MaterialData = {
    'id': '00000000000000000000000000000000',
    'name': 'PBR Material',
    'dataType': spec.DataType.Material,
    'stringTags': {
      'ZWrite': 'true',
      'ZTest': 'true',
      'RenderType': 'Opaque',
      'Cull': 'Front',
    },
    'macros': [],
    'shader': {
      'id': 'pbr00000000000000000000000000000',
    },
    'ints': {

    },
    'floats': {
      '_SpecularAA': 0,
      '_MetallicFactor': 1,
      '_RoughnessFactor': 0.0,
      '_NormalScale': 1,
      '_OcclusionStrength': 1,
      '_EmissiveIntensity': 1,
      '_AlphaCutoff': 0.5,
    },
    'vector4s': {

    },
    'colors': {
      '_BaseColorFactor': {
        'r': 1,
        'g': 1,
        'b': 1,
        'a': 1,
      },
      '_EmissiveFactor': {
        'r': 0,
        'g': 0,
        'b': 0,
        'a': 1,
      },
    },
    'textures': {

    },
  };

  return material;
}

export function getDefaultUnlitMaterialData (): spec.MaterialData {
  const material: spec.MaterialData = {
    'id': '00000000000000000000000000000000',
    'name': 'Unlit Material',
    'dataType': spec.DataType.Material,
    'stringTags': {
      'ZWrite': 'true',
      'ZTest': 'true',
      'RenderType': 'Opaque',
      'Cull': 'Front',
    },
    'macros': [],
    'shader': {
      'id': 'unlit000000000000000000000000000',
    },
    'ints': {

    },
    'floats': {
      '_AlphaCutoff': 0.5,
    },
    'vector4s': {

    },
    'colors': {
      '_BaseColorFactor': {
        'r': 1,
        'g': 1,
        'b': 1,
        'a': 1,
      },
    },
    'textures': {

    },
  };

  return material;
}
