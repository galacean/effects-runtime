import type { TransformProps, Texture, Attribute, Engine, math } from '@galacean/effects';
import { Transform as EffectsTransform, spec, glContext, Geometry } from '@galacean/effects';
import type {
  Loader,
  LoaderOptions,
  SkyboxType,
  LoadSceneOptions,
  LoadSceneResult,
} from './protocol';
import type {
  ModelAnimationOptions,
  ModelAnimTrackOptions,
  ModelMeshOptions,
  ModelCameraOptions,
  ModelMaterialOptions,
  ModelLightOptions,
  ModelSkyboxOptions,
  ModelItemBoundingBox,
  ModelBaseItem,
  ModelItemMesh,
  ModelItemLight,
  ModelItemCamera,
  ModelItemSkybox,
  ModelTreeOptions,
  ModelPrimitiveOptions,
  ModelItemTree,
  ModelSkinOptions,
  ModelTextureTransform,
} from '../index';
import { Vector3, Box3, Matrix4 } from '../runtime/math';
import { LoaderHelper } from './loader-helper';
import { WebGLHelper, PluginHelper } from '../utility/plugin-helper';
import type {
  GLTFSkin,
  GLTFMesh,
  GLTFImage,
  GLTFMaterial,
  GLTFTexture,
  GLTFScene,
  GLTFPrimitive,
  GLTFBufferAttribute,
  GLTFTextureInfo,
  GLTFNode,
  GLTFLight,
  GLTFCamera,
  GLTFBounds,
  GLTFAnimation,
  GLTFImageBasedLight,
} from '@vvfx/resource-detection';
import type { PImageBufferData, PSkyboxBufferParams } from '../runtime/skybox';
import { PSkyboxCreator, PSkyboxType } from '../runtime/skybox';
import type { CubeImage } from '@vvfx/resource-detection/dist/src/gltf-tools/gltf-image-based-light';

type Box3 = math.Box3;

let globalGLTFLoader: Loader;

export function getDefaultEffectsGLTFLoader (engine: Engine, options?: LoaderOptions): Loader {
  if (!globalGLTFLoader) {
    globalGLTFLoader = new LoaderImpl();
  }

  (globalGLTFLoader as LoaderImpl).initial(engine, options);

  return globalGLTFLoader;
}

export function setDefaultEffectsGLTFLoader (loader: Loader): void {
  globalGLTFLoader = loader;
}

export class LoaderImpl implements Loader {
  private _sceneOptions!: LoadSceneOptions;
  private _loaderOptions!: LoaderOptions;
  private _gltfScene!: GLTFScene;
  private _gltfSkins!: GLTFSkin[];
  private _gltfMeshs!: GLTFMesh[];
  private _gltfLights!: GLTFLight[];
  private _gltfCameras!: GLTFCamera[];
  private _gltfImages!: GLTFImage[];
  private _gltfTextures!: GLTFTexture[];
  private _gltfMaterials!: GLTFMaterial[];
  private _gltfAnimations!: GLTFAnimation[];
  private _gltfImageBasedLights!: GLTFImageBasedLight[];
  private _textureManager?: TextureManager;
  private _skyboxOptions?: ModelSkyboxOptions;

  engine: Engine;

  initial (engine: Engine, options?: LoaderOptions) {
    this.engine = engine;
    this._loaderOptions = options ?? {};
  }

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

  createTreeOptions (scene: GLTFScene): ModelTreeOptions {
    const nodeList = scene.nodes.map((node, nodeIndex) => {
      const children = node.children.map(child => {
        if (child.nodeIndex === undefined) { throw new Error(`Undefined nodeIndex for child ${child}.`); }

        return child.nodeIndex;
      });
      let pos: spec.vec3 | undefined;
      let quat: spec.vec4 | undefined;
      let scale: spec.vec3 | undefined;

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
    if (cubeImages.length == 0) { throw new Error(`createTextureCube: Invalid cubeImages length ${cubeImages}.`); }

    const mipmaps: PImageBufferData[][] = [];

    cubeImages.forEach(cubeImage => {
      if (cubeImage.length != 6) { throw new Error(`createTextureCube: cubeimage count should always be 6, ${cubeImage}.`); }
      //
      const imgList: PImageBufferData[] = [];

      cubeImage.forEach(img => {
        if (img.imageData === undefined) { throw new Error(`createTextureCube: Invalid image data from ${img}.`); }
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
    const irradianceCoeffs = ibl.irradianceCoefficients as unknown as number[];
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

    const params: PSkyboxBufferParams = {
      type: 'buffer',
      renderable: this.isSkyboxVis(),
      intensity: ibl.intensity,
      reflectionsIntensity: reflectionsIntensity,
      irradianceCoeffs: irradianceCoeffs,
      specularImage: specularImages,
      specularMipCount: specularMipCount,
      specularImageSize: specularImageSize,
    };

    return PSkyboxCreator.createSkyboxOptions(this.engine, params);
  }

  createDefaultSkybox (typeName: SkyboxType): Promise<ModelSkyboxOptions> {
    if (typeName !== 'NFT' && typeName !== 'FARM') {
      throw new Error(`Invalid skybox type specified: '${typeName}'. Valid types are: 'NFT', 'FARM'.`);
    }
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

  async loadScene (options: LoadSceneOptions): Promise<LoadSceneResult> {
    this._clear();
    this._sceneOptions = options;
    this.engine = options.effects.renderer?.engine as Engine;
    this._loaderOptions = { compatibleMode: options.gltf.compatibleMode };
    const gltfResource = options.gltf.resource;

    if (typeof gltfResource === 'string' || gltfResource instanceof Uint8Array) {
      throw new Error('Please load the resource using GLTFTools first.');
    }

    this._gltfScene = gltfResource.scenes[0];
    this._gltfSkins = this._gltfScene.skins;
    this._gltfMeshs = gltfResource.meshes;
    this._gltfLights = this._gltfScene.lights;
    this._gltfCameras = this._gltfScene.cameras;
    this._gltfImages = gltfResource.images;
    this._gltfTextures = gltfResource.textures;
    this._gltfMaterials = gltfResource.materials;
    this._gltfAnimations = gltfResource.animations;
    this._gltfImageBasedLights = gltfResource.imageBasedLights;
    await this._preprocess();
    const modelItems: ModelBaseItem[] = [];
    const treeId = 'sceneTree';

    modelItems.push(this._createItemTree(treeId, this._gltfScene));
    //
    const itemSkybox = this._createItemSkybox();

    if (itemSkybox !== undefined) { modelItems.push(itemSkybox); }

    this._gltfScene.nodes.forEach(node => {
      if (node.mesh !== undefined) {
        const itemMesh = this._createItemMesh(node, treeId);

        if (itemMesh !== undefined) { modelItems.push(itemMesh); }
      }
      if (node.light !== undefined) {
        const itemLight = this._createItemLight(node, treeId);

        if (itemLight !== undefined) { modelItems.push(itemLight); }
      }
      if (node.camera !== undefined) {
        const itemCamera = this._createItemCamera(node, treeId);

        if (itemCamera !== undefined) { modelItems.push(itemCamera); }
      }
    });

    const sceneAABB = new Box3();

    this._gltfScene.rootNodes.forEach(root => {
      const parentTransform = new EffectsTransform({
        valid: true,
      });

      this._computeSceneAABB(root, parentTransform, sceneAABB);
    });

    return {
      source: this.getRemarkString(),
      items: modelItems,
      sceneAABB: {
        min: sceneAABB.min.toArray(),
        max: sceneAABB.max.toArray(),
      },
    };
  }

  private async _preprocess () {
    this.getTextureManager().initial(this._gltfImages, this._gltfTextures);
    for (let i = 0; i < this._gltfMaterials.length; i++) {
      const mat = this._gltfMaterials[i];

      await this.tryAddTexture2D(i, mat.baseColorTexture, true);
      if (!GLTFHelper.isUnlitMaterial(mat)) {
        await this.tryAddTexture2D(i, mat.metallicRoughnessTexture, false);
        await this.tryAddTexture2D(i, mat.normalTexture, false);
        await this.tryAddTexture2D(i, mat.emissiveTexture, false);
        await this.tryAddTexture2D(i, mat.occlusionTexture, false);
      }
    }
    //
    if (this._gltfImageBasedLights.length > 0 && !this.ignoreSkybox()) {
      const ibl = this._gltfImageBasedLights[0];

      if (this.isEnvironmentTest()) {
        const inSpecularImages = ibl.specularImages as CubeImage[];

        inSpecularImages.forEach(images => {
          if (this.isTiny3dMode()) {
            [images[4], images[5]] = [images[5], images[4]];
          }
          [images[2], images[3]] = [images[3], images[2]];
        });
      }

      this._skyboxOptions = await this.createSkybox(ibl);
    } else {
      const skyboxType = this.getSkyboxType();

      if (skyboxType !== undefined) {
        const typeName = skyboxType === PSkyboxType.FARM ? 'FARM' : 'NFT';

        this._skyboxOptions = await this.createDefaultSkybox(typeName);
      }
    }
    if (this._skyboxOptions) { this._skyboxOptions.renderable = this.isSkyboxVis(); }
    //
    this._gltfData2PlayerData(this._gltfScene, this._gltfMaterials);
  }

  // FIXME: texInfo 可选，isBaseColor 不可选，顺序问题
  tryAddTexture2D (matIndex: number, texInfo: GLTFTextureInfo | undefined, isBaseColor: boolean) {
    if (texInfo === undefined) { return; }

    const cacheTex = this.getTexture2D(matIndex, texInfo, isBaseColor, true);

    if (cacheTex !== undefined) { return; }
    //
    const texIndex = texInfo.index;
    const tex = this._gltfTextures[texIndex];
    const img = this._gltfImages[tex.source];

    return WebGLHelper.createTexture2D(this.engine, img, tex, isBaseColor, this.isTiny3dMode()).then(tex => {
      this.getTextureManager().addTexture(matIndex, texIndex, tex, isBaseColor);
    });
  }

  // FIXME: 可选顺序问题
  getTexture2D (matIndex: number, texInfo: GLTFTextureInfo | undefined, isBaseColor: boolean, noWarning?: boolean): Texture | undefined {
    if (texInfo === undefined) { return; }
    const texIndex = texInfo.index;
    const tex = this.getTextureManager().getTexture(matIndex, texIndex, isBaseColor);

    if (tex === undefined && noWarning !== true) {
      console.warn(`Can't find texture for mat ${matIndex}, tex ${JSON.stringify(texInfo)}, basecolor ${isBaseColor}.`);
    }

    return tex;
  }

  private _gltfData2PlayerData (scene: GLTFScene, materials: GLTFMaterial[]) {
    this.processCamera(scene.cameras, true);
    this.processLight(scene.lights, true);
    this.processMaterial(materials, true);
  }

  private _createItemTree (treeId: string, scene: GLTFScene): ModelItemTree {
    const treeOptions = this.createTreeOptions(scene);
    const animOptions = this.createAnimations(this._gltfAnimations);

    treeOptions.animations = animOptions;
    treeOptions.animation = this.getPlayAnimationIndex(treeOptions);

    const itemTree: ModelItemTree = {
      id: treeId,
      name: scene.name,
      duration: this.getItemDuration(),
      endBehavior: this.getItemEndBehavior(),
      type: spec.ItemType.tree,
      content: {
        options: {
          tree: treeOptions,
        },
      },
    };

    return itemTree;
  }

  private _createItemMesh (node: GLTFNode, parentId?: string): ModelItemMesh {
    const meshIndex = node.mesh;

    if (meshIndex === undefined) {
      throw new Error(`Invalid mesh index in node ${node}.`);
    }

    let skin: ModelSkinOptions | undefined;

    if (node.skin !== undefined) {
      const gltfSkin = this._gltfSkins[node.skin];

      skin = {
        name: gltfSkin.name,
        joints: gltfSkin.jointIndexList,
        skeleton: gltfSkin.skeleton,
        inverseBindMatrices: gltfSkin.inverseBindMatrices as Float32Array,
      };
    }

    const mesh = this._gltfMeshs[meshIndex];
    const primitiveList = mesh.primitives.map(prim => {
      const matIndex = prim.material;
      const mat = this._gltfMaterials[matIndex];
      const geometry = this.createGeometry(prim, skin !== undefined);
      const material = this.createMaterial(mat);

      material.baseColorTexture = this.getTexture2D(matIndex, mat.baseColorTexture, true);
      if (material.type === spec.MaterialType.pbr) {
        material.metallicRoughnessTexture = this.getTexture2D(matIndex, mat.metallicRoughnessTexture, false);
        material.normalTexture = this.getTexture2D(matIndex, mat.normalTexture, false);
        material.emissiveTexture = this.getTexture2D(matIndex, mat.emissiveTexture, false);
        material.occlusionTexture = this.getTexture2D(matIndex, mat.occlusionTexture, false);
      }

      const primitiveOptions: ModelPrimitiveOptions = {
        geometry: geometry,
        material: material,
      };

      return primitiveOptions;
    });

    const meshOptions: ModelMeshOptions = {
      parent: node.nodeIndex,
      skin: skin,
      primitives: primitiveList,
      weights: mesh.weights,
    };
    const aabb = GLTFHelper.createBoxFromGLTFBound(mesh.bounds as GLTFBounds);
    const boxSize = aabb.getSize(new Vector3());
    const boxCenter = aabb.getCenter(new Vector3());
    const interaction: ModelItemBoundingBox = {
      behavior: spec.InteractBehavior.NOTIFY,
      type: spec.ModelBoundingType.box,
      size: [boxSize.x, boxSize.y, boxSize.z],
      center: [boxCenter.x, boxCenter.y, boxCenter.z],
    };
    const itemMesh: ModelItemMesh = {
      id: `mesh_ni${node.nodeIndex ?? 0}_mi${meshIndex}`,
      parentId: `${parentId}^${node.nodeIndex}`,
      name: mesh.name,
      duration: this.getItemDuration(),
      endBehavior: this.getItemEndBehavior(),
      type: spec.ItemType.mesh,
      pluginName: 'model',
      content: {
        options: meshOptions,
        interaction: interaction,
      },
    };

    return itemMesh;
  }

  private _createItemLight (node: GLTFNode, parentId?: string): ModelItemLight | undefined {
    const lightIndex = node.light;

    if (lightIndex === undefined) { return; }

    const light = this._gltfLights[lightIndex];
    const lightOptions = this.createLightOptions(light);
    const itemLight: ModelItemLight = {
      id: `light_ni${node.nodeIndex ?? 0}_li${lightIndex}`,
      parentId: `${parentId}^${node.nodeIndex}`,
      name: light.name ?? 'light',
      duration: this.getItemDuration(),
      endBehavior: this.getItemEndBehavior(),
      type: spec.ItemType.light,
      pluginName: 'model',
      content: {
        options: lightOptions,
      },
    };

    return itemLight;
  }

  private _createItemCamera (node: GLTFNode, parentId?: string): ModelItemCamera | undefined {
    const cameraIndex = node.camera;

    if (cameraIndex === undefined) { return; }

    const camera = this._gltfCameras[cameraIndex];
    const cameraOptions = this.createCameraOptions(camera);

    if (cameraOptions === undefined) { return; }

    const itemCamera: ModelItemCamera = {
      id: `camera_ni${node.nodeIndex ?? 0}_ci${cameraIndex}`,
      parentId: `${parentId}^${node.nodeIndex}`,
      name: camera.name ?? 'camera',
      duration: this.getItemDuration(),
      endBehavior: this.getItemEndBehavior(),
      type: 'camera',
      pluginName: 'model',
      content: {
        options: cameraOptions,
      },
    };

    return itemCamera;
  }

  private _createItemSkybox (): ModelItemSkybox | undefined {
    if (this._skyboxOptions === undefined) { return; }

    const itemSkybox: ModelItemSkybox = {
      id: 'skybox_0',
      name: 'skybox',
      duration: this.getItemDuration(),
      endBehavior: this.getItemEndBehavior(),
      type: spec.ItemType.skybox,
      pluginName: 'model',
      content: {
        options: this._skyboxOptions,
      },
    };

    return itemSkybox;
  }

  private _computeSceneAABB (node: GLTFNode, parentTransform: EffectsTransform, sceneAABB: Box3) {
    const transformData: TransformProps = {};

    if (node.matrix) {
      const trans = Matrix4.fromArray(node.matrix).getTransform();

      transformData.position = trans.translation.toArray();
      transformData.quat = trans.rotation.toArray();
      transformData.scale = trans.scale.toArray();
    } else {
      if (node.translation) { transformData.position = node.translation as spec.vec3; }
      if (node.rotation) { transformData.quat = node.rotation as spec.vec4; }
      if (node.scale) { transformData.scale = node.scale as spec.vec3; }
    }
    const nodeTransform = new EffectsTransform(transformData, parentTransform);

    nodeTransform.setValid(true);

    //
    if (node.mesh !== undefined) {
      const mesh = this._gltfMeshs[node.mesh];
      const meshAABB = GLTFHelper.createBoxFromGLTFBound(mesh.bounds as GLTFBounds);

      meshAABB.applyMatrix4(nodeTransform.getWorldMatrix());
      sceneAABB.union(meshAABB);
    }

    node.children.forEach(child => {
      this._computeSceneAABB(child, nodeTransform, sceneAABB);
    });
  }

  createLightOptions (light: GLTFLight): ModelLightOptions {
    return PluginHelper.createLightOptions(light);
  }

  createCameraOptions (camera: GLTFCamera): ModelCameraOptions | undefined {
    return PluginHelper.createCameraOptions(camera);
  }

  private _clear () {
    if (this._textureManager) {
      this._textureManager.dispose();
      this._textureManager = undefined;
    }
    this._textureManager = new TextureManager(this);
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

    const animationInfo = this._sceneOptions.effects.playAnimation;

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
    return this._sceneOptions.effects.playAnimation !== undefined;
  }

  isPlayAllAnimation (): boolean {
    return this._sceneOptions.effects.playAllAnimation === true;
  }

  getRemarkString (): string {
    const remark = this._sceneOptions.gltf.remark;

    if (remark === undefined) {
      return 'Unknown';
    } else if (typeof remark === 'string') {
      return remark;
    } else {
      return 'BinaryBuffer';
    }
  }

  isTiny3dMode (): boolean {
    return this._loaderOptions.compatibleMode === 'tiny3d';
  }

  getTextureManager (): TextureManager {
    return this._textureManager as TextureManager;
  }

  getItemDuration (): number {
    return this._sceneOptions.effects.duration ?? 9999;
  }

  getItemEndBehavior (): spec.ItemEndBehavior {
    return this._sceneOptions.effects.endBehavior ?? spec.ItemEndBehavior.loop;
  }

  getSkyboxType (): PSkyboxType | undefined {
    const typeName = this._sceneOptions.gltf.skyboxType;

    switch (typeName) {
      case 'NFT': return PSkyboxType.NFT;
      case 'FARM': return PSkyboxType.FARM;
    }
  }

  isSkyboxVis (): boolean {
    return this._sceneOptions.gltf.skyboxVis === true;
  }

  ignoreSkybox (): boolean {
    return this._sceneOptions.gltf.ignoreSkybox === true;
  }

  isEnvironmentTest (): boolean {
    if (typeof this._sceneOptions.gltf.remark === 'string') {
      return this._sceneOptions.gltf.remark.includes('EnvironmentTest');
    } else {
      return false;
    }
  }

}

class TextureManager {
  private _owner: LoaderImpl;
  private _gltfImages: GLTFImage[];
  private _gltfTextures: GLTFTexture[];
  private _textureMap: Map<number, Texture>;

  constructor (owner: LoaderImpl) {
    this._owner = owner;
    this._gltfImages = [];
    this._gltfTextures = [];
    this._textureMap = new Map();
  }

  initial (gltfImages: GLTFImage[], gltfTextures: GLTFTexture[]) {
    this._gltfImages = gltfImages;
    this._gltfTextures = gltfTextures;
    this._textureMap.clear();
  }

  dispose () {
    this._textureMap.clear();
  }

  addTexture (matIndex: number, texIndex: number, tex: Texture, isBaseColor: boolean) {
    const index = isBaseColor ? matIndex * 100000 + texIndex : texIndex;

    this._textureMap.set(index, tex);
  }

  getTexture (matIndex: number, texIndex: number, isBaseColor: boolean): Texture | undefined {
    const index = isBaseColor ? matIndex * 100000 + texIndex : texIndex;

    return this._textureMap.get(index);
  }

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

      attributes['aPos'] = this._getBufferAttrib(attrib);
    } else {
      throw new Error('Position attribute missing.');
    }
    if (this.hasNormal) {
      const attrib = this.normalAttrib;

      if (attrib !== undefined) {
        attributes['aNormal'] = this._getBufferAttrib(attrib);
      }
    }
    if (this.hasTangent) {
      const attrib = this.tangentAttrib;

      if (attrib !== undefined) {
        attributes['aTangent'] = this._getBufferAttrib(attrib);
      }
    }
    this.texCoordList.forEach(val => {
      const attrib = this.texCoordAttrib(val);
      const attribName = `aUV${val + 1}`;

      attributes[attribName] = this._getBufferAttrib(attrib);
    });
    if (this.hasSkinAnimation) {
      const jointAttrib = this.jointAttribute;

      if (jointAttrib !== undefined) {
        attributes['aJoints'] = this._getBufferAttrib(jointAttrib);
      }
      const weightAttrib = this.weightAttribute;

      if (weightAttrib !== undefined) {
        attributes['aWeights'] = this._getBufferAttrib(weightAttrib);
      }
    }

    /**
     * 设置Morph动画需要的Attribute，主要包括Position，Normal和Tangent
     */
    for (let i = 0; i < 8; i++) {
      const positionAttrib = this.getTargetPosition(i);

      if (positionAttrib !== undefined) {
        attributes[`aTargetPosition${i}`] = this._getBufferAttrib(positionAttrib);
      }

      const normalAttrib = this.getTargetNormal(i);

      if (normalAttrib !== undefined) {
        attributes[`aTargetNormal${i}`] = this._getBufferAttrib(normalAttrib);
      }

      const tangentAttrib = this.getTargetTangent(i);

      if (tangentAttrib !== undefined) {
        attributes[`aTargetTangent${i}`] = this._getBufferAttrib(tangentAttrib);
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

    if (f === undefined || f.length != 4) { return [0, 0, 0, 1]; } else { return [f[0], f[1], f[2], 1.0]; }
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

