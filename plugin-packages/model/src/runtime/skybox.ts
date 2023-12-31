import type { spec, Mesh, Material, TextureSourceOptions, TextureConfigOptions, Engine } from '@galacean/effects';
import { glContext, Texture, TextureSourceType, loadImage } from '@galacean/effects';
import type { ModelItemSkybox, ModelSkyboxOptions } from '../index';
import { PObjectType, PMaterialType } from './common';
import { PEntity } from './object';
import { PMaterialBase } from './material';
import type { CompositionCache } from './cache';
import type { PSceneStates } from './scene';
import type { ModelVFXItem } from '../plugin/model-vfx-item';
import { WebGLHelper } from '../utility/plugin-helper';
import { Vector2, Vector3 } from './math';

export class PSkybox extends PEntity {
  renderable = true;
  intensity = 1.0;
  reflectionsIntensity = 1.0;
  //
  irradianceCoeffs?: number[][];
  diffuseImage?: Texture;
  //
  specularImage!: Texture;
  specularImageSize = 0;
  specularMipCount = 0;
  //
  brdfLUT?: Texture;
  //
  priority = 0;
  skyboxMesh?: Mesh;
  skyboxMaterial?: PMaterialSkyboxFilter;
  isBuilt = false;

  constructor (skybox: ModelItemSkybox, ownerItem?: ModelVFXItem) {
    super();
    this.name = skybox.name;
    this.type = PObjectType.skybox;
    this.visible = false;
    this.ownerItem = ownerItem;

    const options = skybox.content.options;

    this.renderable = options.renderable;
    this.intensity = options.intensity;
    this.reflectionsIntensity = options.reflectionsIntensity;
    this.irradianceCoeffs = options.irradianceCoeffs;
    this.diffuseImage = options.diffuseImage;
    this.specularImage = options.specularImage;
    this.specularImageSize = options.specularImageSize;
    this.specularMipCount = options.specularMipCount;

    this.priority = ownerItem?.listIndex || 0;
  }

  setup (brdfLUT?: Texture) {
    this.brdfLUT = brdfLUT;
  }

  build (sceneCache: CompositionCache) {
    if (this.isBuilt) {
      return;
    }

    this.isBuilt = true;
    this.skyboxMaterial = new PMaterialSkyboxFilter();
    this.skyboxMaterial.create(this);
    this.skyboxMaterial.build();
    //
    this.skyboxMesh = sceneCache.getFilterMesh('SkyboxFilterPlane', this.skyboxMaterial, {});
    this.skyboxMesh.priority = this.priority;
    this.skyboxMaterial.updateUniforms(this.skyboxMesh.material);
  }

  override dispose () {
    this.diffuseImage = undefined;
    //@ts-expect-error
    this.specularImage = undefined;
    this.brdfLUT = undefined;
    this.skyboxMesh = undefined;
    this.skyboxMaterial?.dispose();
    this.skyboxMaterial = undefined;
  }

  override addToRenderObjectSet (renderObjectSet: Set<Mesh>) {
    if (this.visible && this.renderable && this.skyboxMesh !== undefined) {
      renderObjectSet.add(this.skyboxMesh);
    }
  }

  override updateUniformsForScene (sceneStates: PSceneStates) {
    if (this.visible && this.renderable && this.skyboxMesh !== undefined && this.skyboxMaterial !== undefined) {
      const camera = sceneStates.camera;
      const viewMatrix = sceneStates.viewMatrix;
      const newProjViewMatrix = camera.getNewProjectionMatrix(camera.fovy).multiply(viewMatrix).invert();
      const material = this.skyboxMesh.material;

      this.skyboxMaterial.updateUniforms(material);
      material.setMatrix('u_InvViewProjectionMatrix', newProjViewMatrix);
    }
  }

  get available (): boolean {
    if (!this.isValid()) { return false; }

    if (this.intensity <= 0 && this.reflectionsIntensity <= 0) { return false; }

    if (this.irradianceCoeffs === undefined && this.diffuseImage === undefined) { return false; }

    return this.specularImage !== undefined && this.specularMipCount > 0;
  }

  get currentIntensity (): number {
    return this.visible ? this.intensity : 0;
  }

  get currentReflectionsIntensity (): number {
    return this.visible ? this.reflectionsIntensity : 0;
  }

  get hasDiffuseImage (): boolean {
    return this.diffuseImage !== undefined;
  }

  get hasIrradianceCoeffs (): boolean {
    return this.irradianceCoeffs !== undefined;
  }

}

export class PMaterialSkyboxFilter extends PMaterialBase {
  intensity = 1.0;
  reflectionsIntensity = 1.0;
  brdfLUT?: Texture;
  irradianceCoeffs?: number[][];
  diffuseImage?: Texture;
  specularImage!: Texture;
  specularMipCount = 0;

  create (skybox: PSkybox) {
    this.type = PObjectType.material;
    this.materialType = PMaterialType.skyboxFilter;
    this.depthTestHint = false;
    //
    this.name = skybox.name;
    this.intensity = skybox.intensity;
    this.reflectionsIntensity = skybox.reflectionsIntensity;
    this.brdfLUT = skybox.brdfLUT;
    this.irradianceCoeffs = skybox.irradianceCoeffs;
    this.diffuseImage = skybox.diffuseImage;
    this.specularImage = skybox.specularImage;
    this.specularMipCount = skybox.specularMipCount;
  }

  override dispose () {
    super.dispose();
    this.brdfLUT = undefined;
    this.irradianceCoeffs = undefined;
    this.diffuseImage = undefined;
    // @ts-expect-error
    this.specularImage = undefined;
  }

  override getShaderFeatures (): string[] {
    const featureList: string[] = [];

    featureList.push('USE_IBL 1');
    featureList.push('USE_TEX_LOD 1');
    if (this.diffuseImage === undefined) { featureList.push('IRRADIANCE_COEFFICIENTS 1'); }

    return featureList;
  }

  override updateUniforms (material: Material) {
    if (this.brdfLUT === undefined) {
      throw new Error('Setup brdfLUT for skybox at first.');
    }

    material.setVector2('u_IblIntensity', new Vector2(2.0, 2.0));
    material.setTexture('u_brdfLUT', this.brdfLUT);
    if (this.diffuseImage !== undefined) {
      material.setTexture('u_DiffuseEnvSampler', this.diffuseImage);
    } else {
      const coeffs = this.irradianceCoeffs;

      if (coeffs === undefined || coeffs.length != 9) { throw new Error(`Invalid skybox irradiance coeffs ${coeffs}`); }

      const aliasName = ['l00', 'l1m1', 'l10', 'l11', 'l2m2', 'l2m1', 'l20', 'l21', 'l22'];

      aliasName.forEach((n, i) => {
        material.setVector3(`u_shCoefficients.${n}`, Vector3.fromArray(coeffs[i] as spec.vec3));
      });
    }
    material.setInt('u_MipCount', this.specularMipCount);
    material.setTexture('u_SpecularEnvSampler', this.specularImage);
  }

  override setMaterialStates (material: Material) {
    material.depthTest = true;
    material.depthMask = false;
    this.setFaceSideStates(material);
  }
}

export interface PImageBufferData {
  type: 'buffer',
  data: Uint8Array,
  mimeType: string,
}

export type PImageData = string | PImageBufferData;

export interface PSkyboxBaseParams {
  renderable: boolean,
  intensity: number,
  reflectionsIntensity: number,
  irradianceCoeffs?: number[][],
  specularMipCount: number,
  specularImageSize: number,
}

export interface PSkyboxURLParams extends PSkyboxBaseParams {
  type: 'url',
  diffuseImage?: string[],
  specularImage: string[][],
}

export interface PSkyboxBufferParams extends PSkyboxBaseParams {
  type: 'buffer',
  diffuseImage?: PImageBufferData[],
  specularImage: PImageBufferData[][],
}

export type PSkyboxParams = PSkyboxURLParams | PSkyboxBufferParams;

export enum PSkyboxType {
  NFT = 0,
  FARM,
}

export class PSkyboxCreator {
  static async getBrdfLutTextureOptions (): Promise<TextureSourceOptions> {
    const brdfURL = 'https://gw.alipayobjects.com/zos/gltf-asset/61420044606400/lut-ggx.png';
    //const brdfURL = 'https://gw.alipayobjects.com/zos/gltf-asset/58540818729423/a4191420-a8cd-432c-8e36-9bd02a67ec85.png';
    const brdfLutImage = await loadImage(brdfURL);

    const brdfLutOpts: TextureSourceOptions = {
      name: 'brdfLut',
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
      magFilter: glContext.LINEAR,
      minFilter: glContext.LINEAR,
      anisotropic: 1,
      sourceType: TextureSourceType.image,
      image: brdfLutImage,
      generateMipmap: false,
      flipY: false,
      premultiplyAlpha: false,
    };

    return brdfLutOpts;
  }

  static async createBrdfLutTexture (engine: Engine): Promise<Texture> {
    const brdfLutOpts = await this.getBrdfLutTextureOptions();
    const brdfLutTexture = Texture.create(engine, brdfLutOpts);

    return brdfLutTexture;
  }

  static async createSkyboxOptions (engine: Engine, params: PSkyboxParams): Promise<ModelSkyboxOptions> {
    const specularImage = await this.createSpecularCubeMap(engine, params);
    const diffuseImage = await this.createDiffuseCubeMap(engine, params);
    const { renderable, intensity, reflectionsIntensity, irradianceCoeffs, specularImageSize, specularMipCount } = params;
    const skyboxOptions: ModelSkyboxOptions = {
      renderable,
      intensity,
      reflectionsIntensity,
      irradianceCoeffs,
      diffuseImage,
      specularImage,
      specularImageSize,
      specularMipCount,
    };

    return skyboxOptions;
  }

  static async createSpecularCubeMap (engine: Engine, params: PSkyboxParams): Promise<Texture> {
    const configOptions: TextureConfigOptions = {
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
      magFilter: glContext.LINEAR,
      minFilter: glContext.LINEAR_MIPMAP_LINEAR,
    };

    if (params.type === 'url') {
      return WebGLHelper.createTextureCubeMipmapFromURL(engine, params.specularImage);
    } else {
      return WebGLHelper.createTextureCubeMipmapFromBuffer(engine, params.specularImage, params.specularImageSize);
    }
  }

  static async createDiffuseCubeMap (engine: Engine, params: PSkyboxParams): Promise<Texture | undefined> {
    if (params.diffuseImage === undefined) { return; }

    if (params.type === 'url') {
      return WebGLHelper.createTextureCubeFromURL(engine, params.diffuseImage);
    } else {
      return WebGLHelper.createTextureCubeFromBuffer(engine, params.diffuseImage);
    }
  }

  static getSkyboxParams (skyboxType = PSkyboxType.NFT): PSkyboxURLParams {
    const specularImage = this.getSpecularImageList(skyboxType);
    const params: PSkyboxURLParams = {
      type: 'url',
      renderable: true,
      intensity: 1.8,
      reflectionsIntensity: 1.8,
      irradianceCoeffs: this.getIrradianceCoeffs(skyboxType),
      diffuseImage: this.getDiffuseImageList(skyboxType, specularImage),
      specularImage: specularImage,
      specularImageSize: Math.pow(2, specularImage.length - 1),
      specularMipCount: specularImage.length - 1,
    };

    return params;
  }

  private async checkCubeMapImage (imageList: string[]) {
    let lastImage!: HTMLImageElement;
    const specularImageLists: HTMLImageElement[][] = [];

    for (let i = 0; i < imageList.length; i++) {
      const image = await loadImage(imageList[i]);

      if (i > 0) {
        if (i % 6 === 0) {
          if (image.width * 2 !== lastImage.width || image.height * 2 !== lastImage.height) {
            throw new Error(`Invalid cube map list1: index ${i}, image0 ${lastImage}, image1 ${image}`);
          }
        } else {
          if (image.width !== lastImage.width || image.height !== lastImage.height) {
            throw new Error(`Invalid cube map list2: index ${i}, image0 ${lastImage}, image1 ${image}`);
          }
        }
      }
      if (i % 6 === 0) { specularImageLists.push([]); }
      const lastList = specularImageLists[specularImageLists.length - 1];

      lastList.push(image);
      lastImage = image;
    }
  }

  private static getIrradianceCoeffs (skyboxType: number): number[][] | undefined {
    let dataArray: number[] = [];

    switch (skyboxType) {
      case PSkyboxType.NFT: return undefined;
      case PSkyboxType.FARM: dataArray = [
        0.2665672302246094, 0.27008703351020813, 0.2836797833442688, -0.15421263873577118, -0.15587495267391205,
        -0.16371899843215942, 0.06483837962150574, 0.06468029320240021, 0.06616337597370148, -0.11598809063434601,
        -0.11796595901250839, -0.1261979341506958, 0.023678265511989594, 0.02456280030310154, 0.02591511607170105,
        -0.032404184341430664, -0.03217344358563423, -0.03126845508813858, 0.009165619499981403, 0.009345818310976028,
        0.008521141484379768, -0.021998587995767593, -0.02203795686364174, -0.021759089082479477, 0.00046658870996907353,
        0.0005610908847302198, 0.0007202711421996355,
      ];

        break;
      default: dataArray = [
        0.37462672591209412, 0.35230118036270142, 0.33955901861190796, 0.12082185596227646, 0.18179306387901306,
        0.26912716031074524, -0.020699946209788322, -0.0046484274789690971, 0.00797625258564949, -0.068421706557273865,
        -0.051390238106250763, -0.03317255899310112, 0.044127799570560455, 0.028159862384200096, 0.0074287452735006809,
        0.078870773315429688, 0.067734844982624054, 0.047382339835166931, -0.012322401627898216, -0.015187464654445648,
        -0.020201763138175011, -0.1091032400727272, -0.0823250338435173, -0.046844951808452606, -0.057797044515609741,
        -0.066892541944980621, -0.08212742954492569,
      ];

        break;
    }

    const returnArray: number[][] = [];

    for (let i = 0; i < dataArray.length; i += 3) { returnArray.push([dataArray[i], dataArray[i + 1], dataArray[i + 2]]); }

    return returnArray;
  }

  private static getDiffuseImageList (skyboxType: PSkyboxType, images: string[][]): string[] | undefined {
    if (skyboxType == PSkyboxType.NFT) {
      return images[images.length - 1];
    }

    return undefined;
  }

  private static getSpecularImageList (skyboxType: PSkyboxType): string[][] {
    const imageList: string[] = [];

    switch (skyboxType) {
      case PSkyboxType.FARM: imageList.push(...this.getSpecularImageListAntFarm());

        break;
      default: imageList.push(...this.getSpecularImageListNFT());

        break;
    }

    const levelList: string[][] = [];

    imageList.forEach((v, i) => {
      if (i % 6 === 0) {
        levelList.push([]);
      }
      const currentLevel = levelList[levelList.length - 1];

      currentLevel.push(v);
    });

    return levelList;
  }

  private static getSpecularImageListNFT (): string[] {
    return [
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img0.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img1.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img2.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img3.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img5.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img4.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img6.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img7.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img8.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img9.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img11.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img10.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img12.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img13.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img14.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img15.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img17.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img16.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img18.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img19.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img20.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img21.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img23.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img22.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img24.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img25.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img26.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img27.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img29.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img28.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img30.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img31.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img32.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img33.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img35.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img34.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img36.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img37.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img38.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img39.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img41.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img40.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img42.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img43.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img44.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img45.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img47.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/1656063861448/227da6e6-8d07-4f8b-bbb0-3b22fde48c0b_img46.png',
    ];
  }

  private static getSpecularImageListAntFarm (): string[] {
    return [
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_32_0.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_32_1.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_32_2.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_32_3.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_32_4.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_32_5.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_16_0.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_16_1.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_16_2.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_16_3.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_16_4.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_16_5.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_8_0.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_8_1.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_8_2.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_8_3.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_8_4.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_8_5.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_4_0.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_4_1.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_4_2.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_4_3.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_4_4.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_4_5.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_2_0.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_2_1.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_2_2.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_2_3.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_2_4.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_2_5.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_1_0.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_1_1.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_1_2.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_1_3.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_1_4.png',
      'https://gw.alipayobjects.com/zos/gltf-asset/58741584603363/M_Cubemap_1_5.png',
    ];
  }
}

