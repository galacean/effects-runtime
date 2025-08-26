import { spec, generateGUID, glContext, addItem, loadImage, Transform, Geometry } from '@galacean/effects';
import type { TextureSourceOptions, TextureCubeSourceOptionsImageMipmaps, math, TransformProps, Engine, Texture, Attribute } from '@galacean/effects';
import type {
  SkyboxType, LoadSceneOptions, LoadSceneResult, Loader, ModelCamera, ModelLight, ModelSkybox, ModelImageLike,
} from './protocol';
import type {
  ModelMeshComponentData,
  ModelSkyboxComponentData,
  ModelLightComponentData,
  ModelCameraComponentData,
  ModelAnimationOptions,
  ModelAnimTrackOptions,
  ModelMaterialOptions,
  ModelSkyboxOptions,
  ModelTextureTransform,
} from '../index';
import {
  Vector3, Box3, Euler, PSkyboxCreator, PSkyboxType, UnlitShaderGUID, PBRShaderGUID,
} from '../runtime';
import { LoaderHelper } from './loader-helper';
import { WebGLHelper } from '../utility';
import type { PImageBufferData, PSkyboxBufferParams, PSkyboxURLParams } from '../runtime/skybox';
import type {
  GLTFMesh, GLTFImage, GLTFMaterial, GLTFTexture, GLTFLight,
  GLTFCamera, GLTFAnimation, GLTFResources, GLTFImageBasedLight, GLTFPrimitive,
  GLTFBufferAttribute, GLTFBounds, GLTFTextureInfo,
} from '@vvfx/resource-detection';
import type { CubeImage } from '@vvfx/resource-detection/dist/src/gltf-tools/gltf-image-based-light';

export interface LoaderOptions {
  compatibleMode?: 'gltf' | 'tiny3d',
}

export function getDefaultEffectsGLTFLoader (engine: Engine, options?: LoaderOptions): Loader {
  if (!defaultGLTFLoader) {
    defaultGLTFLoader = new LoaderImpl();
  }

  (defaultGLTFLoader as LoaderImpl).initial(engine, options);

  return defaultGLTFLoader;
}

export function setDefaultEffectsGLTFLoader (loader: Loader): void {
  defaultGLTFLoader = loader;
}

let defaultGLTFLoader: Loader;

type Box3 = math.Box3;

export class LoaderImpl implements Loader {
  private sceneOptions: LoadSceneOptions;
  private loaderOptions: LoaderOptions;
  private gltfMeshs: GLTFMesh[] = [];
  private gltfTextures: GLTFTexture[] = [];
  private gltfMaterials: GLTFMaterial[] = [];
  private gltfAnimations: GLTFAnimation[] = [];
  private gltfImageBasedLights: GLTFImageBasedLight[] = [];

  composition: spec.CompositionData;
  timelineAssetId: string = '';
  images: spec.Image[] = [];
  imageElements: ModelImageLike[] = [];
  textures: spec.TextureDefine[] = [];
  items: spec.VFXItemData[] = [];
  components: spec.ComponentData[] = [];
  materials: spec.MaterialData[] = [];
  shaders: spec.ShaderData[] = [];
  geometries: spec.GeometryData[] = [];
  animations: spec.AnimationClipData[] = [];
  sceneAABB = new Box3();

  engine: Engine;

  constructor (composition?: spec.CompositionData) {
    if (composition) {
      this.composition = composition;
    } else {
      this.timelineAssetId = generateGUID();
      this.composition = {
        id: '1',
        name: 'test1',
        duration: 99999,
        endBehavior: spec.EndBehavior.restart,
        camera: {
          fov: 45,
          far: 2000,
          near: 0.001,
          position: [0, 0, 8],
          rotation: [0, 0, 0],
          clipMode: spec.CameraClipMode.portrait,
        },
        items: [],
        timelineAsset: { id: this.timelineAssetId },
        sceneBindings: [],
      };
    }
  }

  async loadScene (options: LoadSceneOptions): Promise<LoadSceneResult> {
    this.clear();
    this.sceneOptions = options;
    this.loaderOptions = { compatibleMode: options.gltf.compatibleMode };
    const gltfResource = options.gltf.resource;

    if (typeof gltfResource === 'string' || gltfResource instanceof Uint8Array) {
      throw new Error('Please load the resource using GLTFTools first.');
    }

    this.images = gltfResource.images.map(gltfImage => {
      const blob = new Blob([gltfImage.imageData.buffer], { type: gltfImage.mimeType ?? 'image/png' });

      return {
        id: gltfImage.id,
        url: URL.createObjectURL(blob),
      };
    });

    this.imageElements = await Promise.all(this.images.map(async image => {
      return loadImage(image.url);
    }));

    this.processGLTFResource(gltfResource, this.imageElements);
    this.gltfMeshs = gltfResource.meshes;
    this.gltfTextures = gltfResource.textures;
    this.gltfMaterials = gltfResource.materials;
    this.gltfAnimations = gltfResource.animations;
    this.gltfImageBasedLights = gltfResource.imageBasedLights;

    this.textures = this.gltfTextures.map(texture => {
      const textureOptions = texture.textureOptions;
      const source = textureOptions.source;

      if (typeof source === 'number') {
        // @ts-expect-error
        textureOptions.source = {
          id: this.images[source].id,
        };
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
    if (gltfScene.animationsComponentData.length === 1) {
      const component = gltfScene.animationsComponentData[0];

      if (!options.effects.playAllAnimation && options.effects.playAnimation !== undefined) {
        const clips = component.animationClips;
        const index = options.effects.playAnimation;

        if (index >= 0 && index < clips.length) {
          component.animationClips = [clips[index]];
        } else {
          component.animationClips = [];
        }
      }
      this.components.push(component);
    } else if (gltfScene.animationsComponentData.length > 1) {
      throw new Error(`Find many animation component data ${gltfScene.animationsComponentData.length}`);
    }

    this.animations = [];
    this.gltfAnimations.forEach(anim => {
      this.animations.push(anim.animationClipData);
    });

    this.items = [];

    await this.tryAddSkybox({
      skyboxType: options.gltf.skyboxType,
      renderable: options.gltf.skyboxVis,
    });

    this.items.push(...gltfResource.scenes[0].vfxItemData);
    this.items.forEach(item => {
      if (item.type === 'root' as spec.ItemType) {
        item.type = 'ECS' as spec.ItemType;
      }
    });

    return this.getLoadResult();
  }

  processGLTFResource (resource: GLTFResources, imageElements: ModelImageLike[]): void {
    const textureDataMap: Record<string, TextureSourceOptions> = {};
    const { textures, materials, scenes, imageBasedLights } = resource;

    textures.forEach(tex => {
      const texData = tex.textureOptions;
      const texId = (texData as unknown as spec.EffectsObjectData).id;

      if (texId) {
        if (textureDataMap[texId]) {
          console.error(`Duplicate GUID found: ${texId}, old ${textureDataMap[texId]}, new ${texData}.`);
        }
        textureDataMap[texId] = texData;
      } else {
        console.error(`No GUID in texture Data: ${texData}.`);
      }
    });

    const baseColorIdSet: Set<string> = new Set();
    const emissiveIdSet: Set<string> = new Set();

    materials.forEach(mat => {
      const materialData = mat.materialData;
      const baseColorTexture = materialData.textures['_BaseColorSampler']?.texture;
      const emissiveTexture = materialData.textures['_EmissiveSampler']?.texture;

      if (baseColorTexture) {
        baseColorIdSet.add(baseColorTexture.id);
      }
      if (emissiveTexture) {
        emissiveIdSet.add(emissiveTexture.id);
      }
    });

    let addTextures = 0;
    const textureIdMap: Record<string, string> = {};

    for (const baseColorId of baseColorIdSet) {
      if (emissiveIdSet.has(baseColorId)) {
        const texData = textures.find(tex => tex.textureOptions.id === baseColorId);

        if (texData) {
          const newId = generateGUID();
          const newTexData = texData.clone();

          newTexData.textureOptions.id = newId;
          textures.push(newTexData);
          textureDataMap[newId] = newTexData.textureOptions;
          textureIdMap[baseColorId] = newId;
          addTextures += 1;
        }
      }
    }

    if (addTextures > 0) {
      console.warn(`Add base color texture ${addTextures}`);
    }

    materials.forEach(mat => {
      const materialData = mat.materialData;

      this.processMaterialData(materialData);

      if (materialData.shader?.id === UnlitShaderGUID) {
        this.processMaterialTexture(materialData, '_BaseColorSampler', true, textureDataMap, imageElements);
      } else if (materialData.shader?.id === PBRShaderGUID) {
        const emissiveTexture = materialData.textures['_EmissiveSampler']?.texture;

        if (emissiveTexture && textureIdMap[emissiveTexture.id]) {
          emissiveTexture.id = textureIdMap[emissiveTexture.id];
        }

        this.processMaterialTexture(materialData, '_BaseColorSampler', true, textureDataMap, imageElements);
        this.processMaterialTexture(materialData, '_MetallicRoughnessSampler', false, textureDataMap, imageElements);
        this.processMaterialTexture(materialData, '_NormalSampler', false, textureDataMap, imageElements);
        this.processMaterialTexture(materialData, '_OcclusionSampler', false, textureDataMap, imageElements);
        this.processMaterialTexture(materialData, '_EmissiveSampler', false, textureDataMap, imageElements);
      }
    });

    const gltfScene = scenes[0];

    gltfScene.camerasComponentData.forEach(comp => this.processCameraComponentData(comp));
    gltfScene.lightsComponentData.forEach(comp => this.processLightComponentData(comp));

    const cubeTextures: TextureSourceOptions[] = [];

    imageBasedLights.forEach(ibl => {
      const data = ibl.imageBaseLightData;

      if (data.reflectionsIntensity === undefined) {
        data.reflectionsIntensity = data.intensity;
      }

      if (data.diffuseImage) {
        const diffuseTexture = textureDataMap[data.diffuseImage.id];

        addItem(cubeTextures, diffuseTexture);
      }
      if (data.specularImage) {
        const specularImage = textureDataMap[data.specularImage.id];

        addItem(cubeTextures, specularImage);
      }
    });

    cubeTextures.forEach(tex => {
      if (tex.target === glContext.TEXTURE_CUBE_MAP) {
        const cube = tex as TextureCubeSourceOptionsImageMipmaps;

        cube.mipmaps.forEach(mipmap => {
          [mipmap[4], mipmap[5]] = [mipmap[5], mipmap[4]];
        });

        if (cube.mipmaps.length === 1) {
          cube.minFilter = glContext.LINEAR;
          cube.magFilter = glContext.LINEAR;
        } else {
          cube.minFilter = glContext.LINEAR_MIPMAP_LINEAR;
          cube.magFilter = glContext.LINEAR;
        }
      }
    });
  }

  processComponentData (components: spec.EffectComponentData[]): void {
    components.forEach(comp => {
      if (comp.dataType === spec.DataType.LightComponent) {
        this.processLightComponentData(comp as unknown as ModelLightComponentData);
      } else if (comp.dataType === spec.DataType.CameraComponent) {
        this.processCameraComponentData(comp as unknown as ModelCameraComponentData);
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

      if (material.floats['ZWrite'] === undefined) {
        material.floats['ZWrite'] = 1;
      }

      if (material.floats['ZTest'] === undefined) {
        material.floats['ZTest'] = 1;
      }

      if (!material.stringTags['RenderType']) {
        material.stringTags['RenderType'] = spec.RenderType.Opaque;
      }

      if (!material.stringTags['RenderFace']) {
        material.stringTags['RenderFace'] = spec.RenderFace.Front;
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

      if (material.floats['ZWrite'] === undefined) {
        material.floats['ZWrite'] = 1;
      }

      if (material.floats['ZTest'] === undefined) {
        material.floats['ZTest'] = 1;
      }

      if (!material.stringTags['RenderType']) {
        material.stringTags['RenderType'] = spec.RenderType.Opaque;
      }

      if (!material.stringTags['RenderFace']) {
        material.stringTags['RenderFace'] = spec.RenderFace.Front;
      }
    } else {
      console.error(`Encountered unknown shader ID in material with ID: ${material.id}.`);
    }
  }

  processTextureOptions (options: TextureSourceOptions, isBaseColor: boolean, image?: ModelImageLike): void {
    let premultiplyAlpha = false;
    let minFilter = options.minFilter ?? glContext.LINEAR_MIPMAP_LINEAR;

    if (this.isTiny3dMode()) {
      minFilter = glContext.LINEAR_MIPMAP_LINEAR;
      if (image) {
        if (!WebGLHelper.isPow2(image.width) || !WebGLHelper.isPow2(image.height)) {
          minFilter = glContext.LINEAR;
        }
      }

      premultiplyAlpha = isBaseColor ? false : true;
    }

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

  initial (engine: Engine, options?: LoaderOptions) {
    this.engine = engine;
    this.loaderOptions = options ?? {};
  }

  checkMeshComponentData (mesh: ModelMeshComponentData, resource: GLTFResources): void {
    if (mesh.materials.length <= 0) {
      throw new Error(`Submesh array is empty for mesh with ID: ${mesh.id}.`);
    }

    let geometryData: spec.GeometryData | undefined;

    resource.meshes.forEach(meshData => {
      if (meshData.geometryData.id === mesh.geometry.id) {
        geometryData = meshData.geometryData;
      }
    });

    if (geometryData === undefined) {
      throw new Error(`Unable to find geometry data for mesh with ID: ${mesh.geometry.id}.`);
    }

    if (geometryData.subMeshes.length !== mesh.materials.length) {
      throw new Error(`Mismatch between submeshes count (${geometryData.subMeshes.length}) and materials count (${mesh.materials.length}).`);
    }
  }

  processMaterialTexture (material: spec.MaterialData, textureName: string, isBaseColor: boolean, textureDataMap: Record<string, TextureSourceOptions>, imageElements: ModelImageLike[]) {
    const texture = material.textures[textureName];

    if (texture) {
      const id = texture.texture.id;
      const texData = textureDataMap[id];
      let imageObj: ModelImageLike | undefined;

      // @ts-expect-error
      if (typeof texData.source !== 'number') {
        // @ts-expect-error
        throw new Error(`Invalid texture option source data, ${texData.source}`);
      } else {
        // @ts-expect-error
        imageObj = imageElements[texData.source];
      }
      if (texData) {
        this.processTextureOptions(texData, isBaseColor, imageObj);
      }
    }
  }

  getLoadResult (): LoadSceneResult {
    const itemIds: spec.DataPath[] = [];

    this.items.forEach(item => itemIds.push({ id: item.id }));
    this.composition.items = itemIds;

    const jsonScene: spec.JSONScene = {
      version: spec.JSONSceneVersion['3_0'],
      playerVersion: {
        web: '2.0',
        native: '2.0',
      },
      type: 'ge',
      compositionId: this.composition.id,
      compositions: [this.composition],
      images: this.images,
      plugins: ['model'],
      textures: this.textures,
      items: this.items,
      components: this.components,
      materials: this.materials,
      shaders: this.shaders,
      geometries: this.geometries,
      animations: this.animations,
      miscs: [
        {
          id: this.timelineAssetId,
          dataType: spec.DataType.TimelineAsset,
        },
      ],
    };

    const sceneAABB = this.computeSceneAABB();

    return {
      source: this.getRemarkString(),
      jsonScene,
      sceneAABB: {
        min: sceneAABB.min.toArray(),
        max: sceneAABB.max.toArray(),
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
      followCamera: data.followCamera,
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

  addSkybox (skybox: PSkyboxURLParams) {
    const itemId = generateGUID();
    const skyboxInfo = PSkyboxCreator.createSkyboxComponentData(skybox);
    const { imageList, textureOptionsList, component } = skyboxInfo;

    component.item.id = itemId;
    if (skybox.intensity !== undefined) {
      component.intensity = skybox.intensity;
    }
    if (skybox.reflectionsIntensity !== undefined) {
      component.reflectionsIntensity = skybox.reflectionsIntensity;
    }
    component.renderable = skybox.renderable ?? false;

    const item: spec.VFXItemData = {
      id: itemId,
      name: 'Skybox-Customize',
      duration: 999,
      type: spec.ItemType.skybox,
      pn: 0,
      visible: true,
      endBehavior: spec.EndBehavior.freeze,
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

  private async tryAddSkybox (skybox: ModelSkybox) {
    if (this.gltfImageBasedLights.length > 0 && !this.ignoreSkybox()) {
      const ibl = this.gltfImageBasedLights[0];

      this.components.push(ibl.imageBaseLightData);
    } else if (skybox.skyboxType !== undefined) {
      const itemId = generateGUID();
      const skyboxInfo = this.createSkyboxComponentData(skybox.skyboxType as SkyboxType);
      const { imageList, textureOptionsList, component } = skyboxInfo;

      component.item.id = itemId;
      if (skybox.intensity !== undefined) {
        component.intensity = skybox.intensity;
      }
      if (skybox.reflectionsIntensity !== undefined) {
        component.reflectionsIntensity = skybox.reflectionsIntensity;
      }
      component.renderable = skybox.renderable ?? false;

      const item: spec.VFXItemData = {
        id: itemId,
        name: `Skybox-${skybox.skyboxType}`,
        duration: skybox.duration ?? 999,
        type: spec.ItemType.skybox,
        pn: 0,
        visible: true,
        endBehavior: spec.EndBehavior.freeze,
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
  }

  createSkyboxComponentData (typeName: SkyboxType) {
    if (typeName !== 'NFT' && typeName !== 'FARM') {
      throw new Error(`Invalid skybox type specified: '${typeName}'. Valid types are: 'NFT', 'FARM'.`);
    }
    //
    const typ = typeName === 'NFT' ? PSkyboxType.NFT : PSkyboxType.FARM;
    const params = PSkyboxCreator.getSkyboxParams(typ);

    return PSkyboxCreator.createSkyboxComponentData(params);
  }

  dispose () {
    this.clear();
    // @ts-expect-error
    this.engine = null;
  }

  clear () {
    this.gltfMeshs = [];
    this.gltfTextures = [];
    this.gltfMaterials = [];
    this.gltfAnimations = [];
    this.gltfImageBasedLights = [];

    this.images = [];
    this.imageElements = [];
    this.textures = [];
    this.items = [];
    this.components = [];
    this.materials = [];
    this.shaders = [];
    this.geometries = [];
    this.animations = [];
  }

  private computeSceneAABB () {
    const geometryDataMap: Record<string, GLTFMesh> = {};

    this.gltfMeshs.forEach(mesh => {
      const id = mesh.geometryData.id;

      geometryDataMap[id] = mesh;
    });
    const componentDataMap: Record<string, GLTFMesh> = {};

    this.components.forEach(component => {
      if (component.dataType === spec.DataType.MeshComponent) {
        const meshComponent = component as spec.ModelMeshComponentData;

        componentDataMap[component.id] = geometryDataMap[meshComponent.geometry.id];
      }
    });

    const sceneAABB = new Box3();
    const parentTransformMap: Record<string, Transform> = {};

    this.items.forEach(item => {
      const parentId = item.parentId ?? '';
      const parentTransform = parentTransformMap[parentId] ?? new Transform();
      const props: TransformProps = {};

      if (item.transform) {
        props.position = new Vector3().copyFrom(item.transform.position);
        props.rotation = Euler.fromVector3(item.transform.eulerHint as Vector3);
        props.scale = new Vector3().copyFrom(item.transform.scale);
      }
      const transform = new Transform(props, parentTransform);

      parentTransformMap[item.id] = transform;
      item.components.forEach(component => {
        const mesh = componentDataMap[component.id];

        if (mesh && mesh.bounds) {
          const minPos = Vector3.fromArray(mesh.bounds.box.min);
          const maxPos = Vector3.fromArray(mesh.bounds.box.max);

          sceneAABB.union(new Box3(minPos, maxPos));
        }
      });
    });

    return sceneAABB;
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

  getEndBehavior (): spec.EndBehavior {
    return this.sceneOptions.effects.endBehavior ?? spec.EndBehavior.restart;
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

  /**
   * for old scene compatibility
   */

  processLight (lights: GLTFLight[], fromGLTF: boolean): void {
    lights.forEach(l => {
      if (l.color === undefined) {
        if (fromGLTF) { l.color = [255, 255, 255, 255]; } else { l.color = [1, 1, 1, 1]; }
      } else {
        l.color[0] = this.scaleColorVal(l.color[0], fromGLTF);
        l.color[1] = this.scaleColorVal(l.color[1], fromGLTF);
        l.color[2] = this.scaleColorVal(l.color[2], fromGLTF);
        l.color[3] = this.scaleColorVal(l.color[3], fromGLTF);
      }
    });
  }

  processCamera (cameras: GLTFCamera[], fromGLTF: boolean): void {
    const scale = fromGLTF ? 180.0 / Math.PI : Math.PI / 180.0;

    cameras.forEach(camera => {
      if (camera.perspective !== undefined) {
        camera.perspective.yfov *= scale;
      }
    });
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

  createGeometry (primitive: GLTFPrimitive, hasSkinAnim: boolean): Geometry {
    const proxy = new GeometryProxy(this.engine, primitive, hasSkinAnim);

    return proxy.geometry;
  }

  createMaterial (material: GLTFMaterial): ModelMaterialOptions {
    const proxy = new MaterialProxy(material, [], this.isTiny3dMode());

    return proxy.material;
  }

  createTexture2D (image: GLTFImage, texture: GLTFTexture, isBaseColor: boolean): Promise<Texture> {
    return WebGLHelper.createTexture2D(this.engine, image, texture, isBaseColor, this.isTiny3dMode());
  }

  createTextureCube (cubeImages: CubeImage[], level0Size?: number): Promise<Texture> {
    if (cubeImages.length == 0) { throw new Error(`createTextureCube: Invalid cubeImages length ${cubeImages}`); }

    const mipmaps: PImageBufferData[][] = [];

    cubeImages.forEach(cubeImage => {
      if (cubeImage.length != 6) { throw new Error(`createTextureCube: cubeimage count should always be 6, ${cubeImage}`); }
      //
      const imgList: PImageBufferData[] = [];

      cubeImage.forEach(img => {
        if (img.imageData === undefined) { throw new Error(`createTextureCube: Invalid image data from ${img}`); }
        //
        imgList.push({
          type: 'buffer',
          data: img.imageData,
          mimeType: img.mimeType,
        });
      });

      if (this.isTiny3dMode()) {
        [imgList[4], imgList[5]] = [imgList[5], imgList[4]];
      }

      mipmaps.push(imgList);
    });
    //
    if (mipmaps.length == 1) {
      // no mipmaps
      return WebGLHelper.createTextureCubeFromBuffer(this.engine, mipmaps[0]);
    } else {
      // has mipmaps
      return WebGLHelper.createTextureCubeMipmapFromBuffer(this.engine, mipmaps, level0Size ?? Math.pow(2, mipmaps.length - 1));
    }
  }

  createSkybox (ibl: GLTFImageBasedLight): Promise<ModelSkyboxOptions> {
    const reflectionsIntensity = ibl.reflectionsIntensity ?? ibl.intensity;
    const irradianceCoeffs = ibl.irradianceCoefficients as number[][];
    const inSpecularImages = ibl.specularImages as CubeImage[];
    const specularImages = inSpecularImages.map(images => {
      const newImages = images.map(img => {
        const outImg: PImageBufferData = {
          type: 'buffer',
          data: img.imageData,
          mimeType: img.mimeType,
        };

        return outImg;
      });

      if (this.isTiny3dMode()) {
        [newImages[4], newImages[5]] = [newImages[5], newImages[4]];
      }

      return newImages;
    });
    const specularMipCount = specularImages.length - 1;
    const specularImageSize = ibl.specularImageSize ?? Math.pow(2, specularMipCount);

    const newIrradianceCoeffs: number[] = [];

    irradianceCoeffs.forEach(coeffs => {
      newIrradianceCoeffs.push(...coeffs);
    });

    const params: PSkyboxBufferParams = {
      type: 'buffer',
      renderable: this.isSkyboxVis(),
      intensity: ibl.intensity,
      reflectionsIntensity: reflectionsIntensity,
      irradianceCoeffs: newIrradianceCoeffs,
      specularImage: specularImages,
      specularMipCount: specularMipCount,
      specularImageSize: specularImageSize,
    };

    return PSkyboxCreator.createSkyboxOptions(this.engine, params);
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
  _AlphaCutoff ("Alpha裁剪值", Range(0, 1)) = 0.5
  `;
}

export function getUnlitShaderProperties (): string {
  return `
  _BaseColorSampler ("基础贴图", 2D) = "" {}
  _BaseColorFactor ("基础颜色", Color) = (1, 1, 1, 1)
  _AlphaCutoff ("Alpha裁剪值", Range(0, 1)) = 0.5
  `;
}

export function getDefaultPBRMaterialData (): spec.MaterialData {
  const material: spec.MaterialData = {
    'id': '00000000000000000000000000000000',
    'name': 'PBR Material',
    'dataType': spec.DataType.Material,
    'stringTags': {
      'RenderType': spec.RenderType.Opaque,
      'RenderFace': 'Front',
    },
    'macros': [],
    'shader': {
      'id': 'pbr00000000000000000000000000000',
    },
    'ints': {

    },
    'floats': {
      'ZWrite': 1,
      'ZTest': 1,
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
      'RenderType': spec.RenderType.Opaque,
      'Cull': 'Front',
    },
    'macros': [],
    'shader': {
      'id': spec.BuiltinObjectGUID.UnlitShader,
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

class GeometryProxy {

  constructor (
    private engine: Engine,
    private gltfGeometry: GLTFPrimitive,
    private hasSkinAnimation: boolean) {
  }

  get geometry (): Geometry {
    const attributes: Record<string, Attribute> = {};

    if (this.hasPosition) {
      const attrib = this.positionAttrib;

      attributes['a_Position'] = this._getBufferAttrib(attrib);
    } else {
      throw new Error('Position attribute missing');
    }
    if (this.hasNormal) {
      const attrib = this.normalAttrib;

      if (attrib !== undefined) {
        attributes['a_Normal'] = this._getBufferAttrib(attrib);
      }
    }
    if (this.hasTangent) {
      const attrib = this.tangentAttrib;

      if (attrib !== undefined) {
        attributes['a_Tangent'] = this._getBufferAttrib(attrib);
      }
    }
    this.texCoordList.forEach(val => {
      const attrib = this.texCoordAttrib(val);
      const attribName = `a_UV${val + 1}`;

      attributes[attribName] = this._getBufferAttrib(attrib);
    });
    if (this.hasSkinAnimation) {
      const jointAttrib = this.jointAttribute;

      if (jointAttrib !== undefined) {
        attributes['a_Joint1'] = this._getBufferAttrib(jointAttrib);
      }
      const weightAttrib = this.weightAttribute;

      if (weightAttrib !== undefined) {
        attributes['a_Weight1'] = this._getBufferAttrib(weightAttrib);
      }
    }

    /**
     * 设置Morph动画需要的Attribute，主要包括Position，Normal和Tangent
     */
    for (let i = 0; i < 8; i++) {
      const positionAttrib = this.getTargetPosition(i);

      if (positionAttrib !== undefined) {
        attributes[`a_Target_Position${i}`] = this._getBufferAttrib(positionAttrib);
      }

      const normalAttrib = this.getTargetNormal(i);

      if (normalAttrib !== undefined) {
        attributes[`a_Target_Normal${i}`] = this._getBufferAttrib(normalAttrib);
      }

      const tangentAttrib = this.getTargetTangent(i);

      if (tangentAttrib !== undefined) {
        attributes[`a_Target_Tangent${i}`] = this._getBufferAttrib(tangentAttrib);
      }
    }

    const indexArray = this.indexArray;

    if (indexArray !== undefined) {
      return Geometry.create(
        this.engine,
        {
          attributes: attributes,
          indices: { data: indexArray },
          drawStart: 0,
          drawCount: indexArray.length,
          mode: glContext.TRIANGLES,
        }
      );
    } else {
      return Geometry.create(
        this.engine,
        {
          attributes: attributes,
          drawStart: 0,
          drawCount: this.positionAttrib.array.length / 3,
          mode: glContext.TRIANGLES,
        }
      );
    }
  }

  private _getBufferAttrib (inAttrib: GLTFBufferAttribute): Attribute {
    const attrib: spec.AttributeWithData = {
      type: inAttrib.type,
      size: inAttrib.itemSize,
      //stride: inAttrib.stride,
      //offset: inAttrib.offset,
      data: inAttrib.array,
      normalize: inAttrib.normalized,
    };

    return attrib;
  }

  get positionAttrib () {
    return this.gltfGeometry.getPosition();
  }

  get normalAttrib () {
    return this.gltfGeometry.getNormal();
  }

  get tangentAttrib () {
    return this.gltfGeometry.getTangent();
  }

  texCoordAttrib (index: number) {
    return this.gltfGeometry.getTexCoord(index);
  }

  get jointAttribute () {
    return this.gltfGeometry.getJoints(0);
  }

  get weightAttribute () {
    return this.gltfGeometry.getWeights(0);
  }

  get hasPosition (): boolean {
    return this.positionAttrib !== undefined;
  }

  get hasNormal (): boolean {
    return this.normalAttrib !== undefined;
  }

  get hasTangent (): boolean {
    return this.tangentAttrib !== undefined;
  }

  get hasTexCoord (): boolean {
    return this.texCoordCount > 0;
  }

  get texCoordCount (): number {
    for (let i = 0; i < 10; i++) {
      if (this.texCoordAttrib(i) === undefined) { return i; }
    }

    return 0;
  }

  get hasJointAttribute (): boolean {
    return this.jointAttribute !== undefined;
  }

  get hasWeightAttribute (): boolean {
    return this.weightAttribute !== undefined;
  }

  get indexArray (): Uint8Array | Uint16Array | Uint32Array | undefined {
    if (this.gltfGeometry.indices === undefined) { return undefined; }

    switch (this.gltfGeometry.indices.type) {
      case WebGLRenderingContext['UNSIGNED_INT']:
        return this.gltfGeometry.indices.array as Uint32Array;
      case WebGLRenderingContext['UNSIGNED_SHORT']:
        return this.gltfGeometry.indices.array as Uint16Array;
      case WebGLRenderingContext['UNSIGNED_BYTE']:
        return this.gltfGeometry.indices.array as Uint8Array;
    }

    return undefined;
  }

  get indexCount (): number {
    if (this.gltfGeometry.indices !== undefined) { return this.gltfGeometry.indices.array.length; } else { return 0; }
  }

  get texCoordList (): number[] {
    const texCoords: number[] = [];

    for (let i = 0; i < 10; i++) {
      if (this.texCoordAttrib(i) !== undefined) {
        texCoords.push(i);
      } else {
        break;
      }
    }

    return texCoords;
  }

  getTargetPosition (index: number): GLTFBufferAttribute | undefined {
    return this.gltfGeometry.getAttribute(`POSITION${index}`);
  }

  getTargetNormal (index: number): GLTFBufferAttribute | undefined {
    return this.gltfGeometry.getAttribute(`NORMAL${index}`);
  }

  getTargetTangent (index: number): GLTFBufferAttribute | undefined {
    return this.gltfGeometry.getAttribute(`TANGENT${index}`);
  }

}

class MaterialProxy {
  private gltfMaterial: GLTFMaterial;
  private textures: Texture[];
  // TODO: 待移除？
  private tiny3dMode: boolean;

  constructor (material: GLTFMaterial, textures: Texture[], tiny3dMode: boolean) {
    this.gltfMaterial = material;
    this.textures = textures;
    this.tiny3dMode = tiny3dMode;
  }

  get material (): ModelMaterialOptions {
    const mat = this.gltfMaterial;
    const isUnlit = GLTFHelper.isUnlitMaterial(mat);

    let blending = spec.MaterialBlending.opaque;

    switch (mat.alphaMode) {
      case 'OPAQUE':
        blending = spec.MaterialBlending.opaque;

        break;
      case 'MASK':
        blending = spec.MaterialBlending.masked;

        break;
      case 'BLEND':
        blending = spec.MaterialBlending.translucent;

        break;
    }

    const side = mat.doubleSided ? spec.SideMode.DOUBLE : spec.SideMode.FRONT;

    const enableShadow = false;

    const alphaCutOff = mat.alphaCutOff ?? 0.5;

    const name = mat.name;

    if (isUnlit) {
      return {
        name: name,
        type: spec.MaterialType.unlit,
        baseColorTexture: this.baseColorTextureObj,
        baseColorTextureCoordinate: this.baseColorTextureCoord,
        baseColorTextureTransform: this.baseColorTextureTransfrom,
        baseColorFactor: this.baseColorFactor,
        //
        depthMask: mat.extras?.depthMask,
        blending: blending,
        alphaCutOff: alphaCutOff,
        side: side,
      };
    } else {
      return {
        name: name,
        type: spec.MaterialType.pbr,
        baseColorTexture: this.baseColorTextureObj,
        baseColorTextureCoordinate: this.baseColorTextureCoord,
        baseColorTextureTransform: this.baseColorTextureTransfrom,
        baseColorFactor: this.baseColorFactor,
        //
        useSpecularAA: this.getSpecularAA(),
        //
        metallicRoughnessTexture: this.metallicRoughnessTextureObj,
        metallicRoughnessTextureCoordinate: this.metallicRoughnessTextureCoord,
        metallicRoughnessTextureTransform: this.metallicRoughnessTextureTransfrom,
        metallicFactor: this.metalicFactor,
        roughnessFactor: this.roughnessFactor,
        //
        normalTexture: this.normalTextureObj,
        normalTextureCoordinate: this.normalTextureCoord,
        normalTextureTransform: this.normalTextureTransfrom,
        normalTextureScale: this.normalTextureScale,
        //
        occlusionTexture: this.occlusionTextureObj,
        occlusionTextureCoordinate: this.occlusionTextureCoord,
        occlusionTextureTransform: this.occlusionTextureTransfrom,
        occlusionTextureStrength: this.occlusionTextureStrength,
        //
        emissiveTexture: this.emissiveTextureObj,
        emissiveTextureCoordinate: this.emissiveTextureCoord,
        emissiveTextureTransform: this.emissiveTextureTransfrom,
        emissiveFactor: this.emissiveFactor,
        emissiveIntensity: 1.0,
        //
        depthMask: mat.extras?.depthMask,
        blending: blending,
        alphaCutOff: alphaCutOff,
        side: side,
        enableShadow: enableShadow,
      };
    }
  }

  private getTextureObject (index: number): Texture | undefined {
    if (index < 0 || index >= this.textures.length) { return; }

    return this.textures[index];
  }

  getTextureObj (texInfo?: GLTFTextureInfo): Texture | undefined {
    return texInfo ? this.getTextureObject(texInfo.index) : undefined;
  }

  getTextureCoord (texInfo?: GLTFTextureInfo): number | undefined {
    return texInfo ? texInfo.texCoord : undefined;
  }

  getTextureTransform (texInfo?: GLTFTextureInfo): ModelTextureTransform | undefined {
    const transform = texInfo?.extensions?.KHR_texture_transform;

    if (transform === undefined) {
      return;
    }

    if (transform.offset === undefined && transform.rotation === undefined && transform.scale === undefined) {
      return;
    }

    return {
      offset: transform.offset,
      rotation: transform.rotation,
      scale: transform.scale,
    };
  }

  get baseColorTextureObj (): Texture | undefined {
    return this.getTextureObj(this.gltfMaterial.baseColorTexture);
  }

  get baseColorTextureCoord (): number | undefined {
    return this.getTextureCoord(this.gltfMaterial.baseColorTexture);
  }

  get baseColorTextureTransfrom (): ModelTextureTransform | undefined {
    return this.getTextureTransform(this.gltfMaterial.baseColorTexture);
  }

  get metallicRoughnessTextureObj (): Texture | undefined {
    return this.getTextureObj(this.gltfMaterial.metallicRoughnessTexture);
  }

  get metallicRoughnessTextureCoord (): number | undefined {
    return this.getTextureCoord(this.gltfMaterial.metallicRoughnessTexture);
  }

  get metallicRoughnessTextureTransfrom (): ModelTextureTransform | undefined {
    return this.getTextureTransform(this.gltfMaterial.metallicRoughnessTexture);
  }

  get normalTextureObj (): Texture | undefined {
    return this.getTextureObj(this.gltfMaterial.normalTexture);
  }

  get normalTextureCoord (): number | undefined {
    return this.getTextureCoord(this.gltfMaterial.normalTexture);
  }

  get normalTextureTransfrom (): ModelTextureTransform | undefined {
    return this.getTextureTransform(this.gltfMaterial.normalTexture);
  }

  get occlusionTextureObj (): Texture | undefined {
    return this.getTextureObj(this.gltfMaterial.occlusionTexture);
  }

  get occlusionTextureCoord (): number | undefined {
    return this.getTextureCoord(this.gltfMaterial.occlusionTexture);
  }

  get occlusionTextureTransfrom (): ModelTextureTransform | undefined {
    return this.getTextureTransform(this.gltfMaterial.occlusionTexture);
  }

  get emissiveTextureObj (): Texture | undefined {
    return this.getTextureObj(this.gltfMaterial.emissiveTexture);
  }

  get emissiveTextureCoord (): number | undefined {
    return this.getTextureCoord(this.gltfMaterial.emissiveTexture);
  }

  get emissiveTextureTransfrom (): ModelTextureTransform | undefined {
    return this.getTextureTransform(this.gltfMaterial.emissiveTexture);
  }

  get hasEmissive (): boolean {
    const factor = this.emissiveFactor;

    return factor[0] + factor[1] + factor[2] > 0;
  }

  get baseColorFactor (): [number, number, number, number] {
    const f = this.gltfMaterial.baseColorFactor;

    if (f === undefined || f.length != 4) { return [1, 1, 1, 1]; } else { return [f[0], f[1], f[2], f[3]]; }
  }

  getSpecularAA () {
    return this.gltfMaterial.extras?.useSpecularAA;
  }

  get metalicFactor (): number {
    return this.gltfMaterial.metallicFactor ?? 1;
  }

  get roughnessFactor (): number {
    return this.gltfMaterial.roughnessFactor ?? 1;
  }

  get normalTextureScale (): number {
    return this.gltfMaterial.normalTexture?.scale ?? 1;
  }

  get occlusionTextureStrength (): number {
    return this.gltfMaterial.occlusionTexture?.strength ?? 1;
  }

  get emissiveFactor (): [number, number, number, number] {
    const f = this.gltfMaterial.emissiveFactor;

    if (f === undefined || f.length != 4) {
      return [0, 0, 0, 1];
    } else {
      return [f[0], f[1], f[2], 1.0];
    }
  }

}

class GLTFHelper {
  static isUnlitMaterial (mat: GLTFMaterial): boolean {
    return mat.extensions?.KHR_materials_unlit !== undefined;
  }

  static createBoxFromGLTFBound (bound: GLTFBounds): Box3 {
    const boxMin = Vector3.fromArray(bound.box.min as number[]);
    const boxMax = Vector3.fromArray(bound.box.max as number[]);

    return new Box3(boxMin, boxMax);
  }
}
