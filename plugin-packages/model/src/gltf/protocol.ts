import type {
  GLTFResources,
  GLTFMaterial,
  GLTFPrimitive,
  GLTFLight,
  GLTFScene,
  GLTFImage,
  GLTFTexture,
  GLTFCamera,
  GLTFAnimation,
  GLTFImageBasedLight,
} from '@vvfx/resource-detection';
import type { CubeImage } from '@vvfx/resource-detection/dist/src/gltf-tools/gltf-image-based-light';
import type {
  spec, TextureSourceOptions, EffectComponentData,
  Texture, Geometry,
} from '@galacean/effects';
import type {
  ModelAnimationOptions,
  ModelMaterialOptions,
  ModelSkyboxOptions,
  ModelTreeOptions,
  ModelLightComponentData, ModelCameraComponentData, ModelSkyboxComponentData,
} from '../index';

/**
 * glTF 场景文件加载选项，主要用于 Demo 测试或外部测试调用
 */
export interface LoadSceneOptions {
  gltf: {
    /**
     * 场景数据的备注，可能是url或者二进制数组
     */
    remark?: string | Uint8Array,
    /**
     * 场景资源，可能是url、二进制数组或者加载后的资源
     */
    resource: string | Uint8Array | GLTFResources,
    /**
     * 兼容模式，目前支持 gltf 和 tiny3d
     */
    compatibleMode?: 'gltf' | 'tiny3d',
    /**
     * 检查ResourceDetection序列化和反序列逻辑
     */
    checkSerializer?: boolean,
    /**
     * 天空盒类型，目前只支持'NFT'和'FARM'
     */
    skyboxType?: string,
    /**
     * 是否显示背景天空盒
     */
    skyboxVis?: boolean,
    /**
     * 是否忽略自带天空盒
     */
    ignoreSkybox?: boolean,
  },
  effects: {
    /**
     * 播放时间，单位秒
     */
    duration?: number,
    /**
     * 结束行为
     */
    endBehavior?: spec.EndBehavior,
    /**
     * 播放动画索引或名称
     */
    playAnimation?: number,
    /**
     * 是否播放全部动画
     */
    playAllAnimation?: boolean,
  },
}

export interface LoadSceneResult {
  source: string,
  jsonScene: spec.JSONScene,
  sceneAABB: {
    min: spec.vec3,
    max: spec.vec3,
  },
}

export type SkyboxType = 'NFT' | 'FARM';

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
  endBehavior: spec.EndBehavior,
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
  endBehavior: spec.EndBehavior,
}

export interface ModelSkybox {
  skyboxType?: string,
  renderable?: boolean,
  intensity?: number,
  reflectionsIntensity?: number,
  duration?: number,
}

export interface ModelImageLike {
  name?: string,
  width: number,
  height: number,
}

export interface Loader {
  loadScene (options: LoadSceneOptions): Promise<LoadSceneResult>,

  processGLTFResource (resource: GLTFResources, imageElements: ModelImageLike[]): void,

  processComponentData (components: EffectComponentData[]): void,

  processLightComponentData (light: ModelLightComponentData): void,

  processCameraComponentData (camera: ModelCameraComponentData): void,

  processSkyboxComponentData (skybox: ModelSkyboxComponentData): void,

  processMaterialData (material: spec.MaterialData): void,

  processTextureOptions (options: TextureSourceOptions, isBaseColor: boolean, image?: ModelImageLike): void,

  // for old scene compatibility
  processLight (lights: GLTFLight[], fromGLTF: boolean): void,

  processCamera (cameras: GLTFCamera[], fromGLTF: boolean): void,

  processMaterial (materials: GLTFMaterial[], fromGLTF: boolean): void,

  createTreeOptions (scene: GLTFScene): ModelTreeOptions,

  createAnimations (animations: GLTFAnimation[]): ModelAnimationOptions[],

  createGeometry (primitive: GLTFPrimitive, hasSkinAnim: boolean): Geometry,

  // 由于要兼容tiny开启了纹理预乘的模式，需要在外面创建和设置纹理，这里只做渲染Options对象的数据转换
  createMaterial (material: GLTFMaterial): ModelMaterialOptions,

  createTexture2D (images: GLTFImage, textures: GLTFTexture, isBaseColor: boolean): Promise<Texture>,

  createTextureCube (cubeImages: CubeImage[], level0Size?: number): Promise<Texture>,

  createSkybox (ibl: GLTFImageBasedLight): Promise<ModelSkyboxOptions>,

  createDefaultSkybox (typeName: SkyboxType): Promise<ModelSkyboxOptions>,

  // 用来转换 GLTF 和 Effects 之间颜色值范围
  scaleColorVal (val: number, fromGLTF: boolean): number,

  scaleColorVec (vec: number[], fromGLTF: boolean): number[],
}
