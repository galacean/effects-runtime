import type {
  Scene,
  Composition,
  Attribute,
  GeometryProps,
  TextureSourceOptions,
  TextureSourceCubeData,
  TextureConfigOptions,
  Texture2DSourceOptionsImage,
  TextureCubeSourceOptionsImageMipmaps,
  Engine,
  math,
  VFXItemData,
} from '@galacean/effects';
import {
  Player,
  spec,
  Transform,
  glContext,
  Material,
  Mesh,
  Texture,
  Geometry,
  Renderer,
  TextureSourceType,
  getDefaultTextureFactory,
  RenderPass,
  RenderPassDestroyAttachmentType,
  TextureLoadAction,
  DestroyOptions,
  loadImage,
  PLAYER_OPTIONS_ENV_EDITOR,
  GLSLVersion,
} from '@galacean/effects';
import { deserializeGeometry, typedArrayFromBinary } from '@galacean/effects-helper';
import type { GLTFCamera, GLTFImage, GLTFLight, GLTFTexture } from '@vvfx/resource-detection';
import type {
  ModelAnimationOptions,
  ModelMeshOptions,
  ModelMaterialOptions,
  ModelLightOptions,
  ModelCameraOptions,
  ModelSkyboxOptions,
  ModelSkinOptions,
  ModelPrimitiveOptions,
  ModelTextureTransform,
  ModelTreeOptions,
  ModelAnimTrackOptions,
  ModelMeshComponent,
} from '../index';
import { Matrix3, Matrix4, Vector3, Vector4, DEG2RAD } from '../runtime/math';
import type { FBOOptions } from './ri-helper';
import type { PMaterialBase } from '../runtime/material';
import type { PImageBufferData } from '../runtime/skybox';
import { PGlobalState } from '../runtime/common';
import { RayTriangleTesting } from './hit-test-helper';
import { PMorph } from '../runtime/animation';
import type { CompositionCache } from '../runtime/cache';

type Box3 = math.Box3;
type VertexArray = Float32Array | Int32Array | Int16Array | Int8Array | Uint32Array | Uint16Array | Uint8Array;

/**
 * WebGL 辅助类，负责 WebGL 相关对象的创建
 */
export class WebGLHelper {
  /**
   * 立方体纹理参数
   */
  static cubemapTexConfig: TextureConfigOptions = {
    name: 'cubemap texture',
    wrapS: glContext.CLAMP_TO_EDGE,
    wrapT: glContext.CLAMP_TO_EDGE,
    magFilter: glContext.LINEAR,
    minFilter: glContext.LINEAR,
  };
  /**
   * 立方体纹理参数，带 Mipmap 滤波
   */
  static cubemapMipTexConfig: TextureConfigOptions = {
    wrapS: glContext.CLAMP_TO_EDGE,
    wrapT: glContext.CLAMP_TO_EDGE,
    magFilter: glContext.LINEAR,
    minFilter: glContext.LINEAR_MIPMAP_LINEAR,
  };

  /**
   * 创建二维纹理对象
   * @param engine - 引擎
   * @param image - glTF 图像参数
   * @param texture - glTF 纹理参数
   * @param isBaseColor - 是否基础颜色
   * @param tiny3dMode - 是否 Tiny3d 模式
   * @returns 二维纹理对象
   */
  static async createTexture2D (engine: Engine, image: GLTFImage, texture: GLTFTexture, isBaseColor?: boolean, tiny3dMode?: boolean): Promise<Texture> {
    if (image.imageData === undefined) {
      console.error(`createTexture2D: Invalid image data from ${image}`);

      // 这里不应该发生的，做个兜底
      return Texture.create(engine, {
        name: 'createTexture2D',
        sourceType: TextureSourceType.data,
        data: {
          data: new Uint8Array([255, 255, 255, 255]),
          width: 1,
          height: 1,
        },
      });
    }
    const blob = new Blob([image.imageData], { type: image.mimeType });
    const urlCreator = window.URL || window.webkitURL;
    const imageUrl = urlCreator.createObjectURL(blob);
    const imageObj = new Image();

    imageObj.src = imageUrl;

    return new Promise(function (resolve, reject) {
      imageObj.onload = () => {
        let minFilter: number = texture.minFilter ?? glContext.LINEAR_MIPMAP_LINEAR;
        let premultiplyAlpha = false;

        if (tiny3dMode) {
          //if (minFilter === glContext.NEAREST_MIPMAP_LINEAR
          //  || minFilter === glContext.LINEAR_MIPMAP_NEAREST) {
          minFilter = glContext.LINEAR_MIPMAP_LINEAR;
          //}
          if (!WebGLHelper.isPow2(imageObj.width) || !WebGLHelper.isPow2(imageObj.height)) {
            minFilter = glContext.LINEAR;
          }
          //
          premultiplyAlpha = isBaseColor ? false : true;
        }

        let generateMipmap = false;

        if (minFilter == glContext.NEAREST_MIPMAP_NEAREST ||
          minFilter == glContext.LINEAR_MIPMAP_NEAREST ||
          minFilter == glContext.NEAREST_MIPMAP_LINEAR ||
          minFilter == glContext.LINEAR_MIPMAP_LINEAR) {
          generateMipmap = true;
        }

        const res = Texture.create(engine, {
          name: 'createTexture2D',
          wrapS: texture.wrapS ?? glContext.REPEAT,
          wrapT: texture.wrapT ?? glContext.REPEAT,
          magFilter: texture.magFilter ?? glContext.LINEAR,
          minFilter,
          anisotropic: 1,
          //flipY: tex.flipY,
          premultiplyAlpha,
          sourceType: TextureSourceType.image,
          image: imageObj,
          generateMipmap,
        });

        resolve(res);
        urlCreator.revokeObjectURL(imageUrl);
      };
      imageObj.onerror = reject;
    });
  }

  /**
   * 创建纹理对象列表
   * @param engine - 引擎
   * @param images - glTF 图像列表
   * @param textures - glTF 纹理参数列表
   * @returns 纹理对象列表
   */
  static async createTextureList (engine: Engine, images: GLTFImage[], textures: GLTFTexture[]): Promise<Texture[]> {
    const outTextures = await Promise.all(
      textures.map(tex => {
        return this.createTexture2D(engine, images[tex.source], tex);
      })
    );

    return outTextures;
  }

  /**
   * 获取立方体纹理数据
   * @param images - 图像数据列表
   * @returns
   */
  static async getTextureCubeData (images: PImageBufferData[]): Promise<TextureSourceCubeData> {
    const cubeData: TextureSourceCubeData = [
      await WebHelper.loadImageFromImageData(images[0]),
      await WebHelper.loadImageFromImageData(images[1]),
      await WebHelper.loadImageFromImageData(images[2]),
      await WebHelper.loadImageFromImageData(images[3]),
      await WebHelper.loadImageFromImageData(images[4]),
      await WebHelper.loadImageFromImageData(images[5]),
    ];

    return cubeData;
  }

  /**
   * 获取立方体纹理 Mipmap 数据
   * @param images - 图像数据二维列表
   * @returns 立方体纹理数据
   */
  static async getTextureCubeMipmapData (images: PImageBufferData[][]): Promise<TextureSourceCubeData[]> {
    const mipmaps: TextureSourceCubeData[] = [];

    for (let i = 0; i < images.length; i++) {
      mipmaps.push(await this.getTextureCubeData(images[i]));
    }

    return mipmaps;
  }

  /**
   * 从 URL 创建立方体纹理
   * @param engine - 引擎
   * @param cubeImage - 立方体图像 URL
   * @returns 纹理对象
   */
  static async createTextureCubeFromURL (engine: Engine, cubeImage: string[]): Promise<Texture> {
    const textureOptions = await getDefaultTextureFactory().loadSource(
      {
        type: TextureSourceType.image,
        target: glContext.TEXTURE_CUBE_MAP,
        map: cubeImage,
      },
      this.cubemapTexConfig,
    );

    return Texture.create(engine, textureOptions);
  }

  /**
   * 从 URL 创建带 Mipmap 立方体纹理
   * @param engine - 引擎
   * @param cubeImages - 立方体 Mipmap 图像 URL
   * @returns 纹理对象
   */
  static async createTextureCubeMipmapFromURL (engine: Engine, cubeImages: string[][]): Promise<Texture> {
    const textureOptions = await getDefaultTextureFactory().loadSource(
      {
        type: TextureSourceType.mipmaps,
        target: glContext.TEXTURE_CUBE_MAP,
        maps: cubeImages,
      },
      this.cubemapMipTexConfig,
    );

    return Texture.create(engine, textureOptions);
  }

  /**
   * 从缓冲区创建立方体纹理
   * @param engine - 引擎
   * @param cubeImages - 图像缓冲区数据列表
   * @returns 纹理对象
   */
  static async createTextureCubeFromBuffer (engine: Engine, cubeImages: PImageBufferData[]): Promise<Texture> {
    const cubemap = await WebGLHelper.getTextureCubeData(cubeImages);

    return Texture.create(
      engine,
      {
        name: 'createTextureCubeFromBuffer',
        sourceType: TextureSourceType.image,
        cube: cubemap,
        target: glContext.TEXTURE_CUBE_MAP,
        ...this.cubemapTexConfig,
      });
  }

  /**
   * 从缓冲区创建带 Mipmap 立方体纹理
   * @param engine - 引擎
   * @param cubeImages - 图像缓冲区数据二维列表
   * @param level0Size - 第 0 层 Mip 的图像大小
   * @returns 纹理对象
   */
  static async createTextureCubeMipmapFromBuffer (engine: Engine, cubeImages: PImageBufferData[][], level0Size: number): Promise<Texture> {
    const mipmaps = await WebGLHelper.getTextureCubeMipmapData(cubeImages);
    //
    let mipCount = 0;

    while (Math.pow(2, mipCount) < level0Size) {
      ++mipCount;
    }

    while (mipmaps.length <= mipCount) {
      const index = Math.pow(2, mipCount - mipmaps.length);
      const url = `https://gw.alipayobjects.com/zos/gltf-asset/67896749597915/img${index}.png`;
      const imageData = await loadImage(url);

      mipmaps.push([imageData, imageData, imageData, imageData, imageData, imageData]);
    }

    return Texture.create(
      engine,
      {
        name: 'createTextureCubeMipmapFromBuffer',
        sourceType: TextureSourceType.mipmaps,
        mipmaps,
        target: glContext.TEXTURE_CUBE_MAP,
        ...this.cubemapMipTexConfig,
      });
  }

  /**
   * 获取纹理对象
   * @param index - 索引
   * @param textures - 纹理数组
   * @returns 纹理获取或 undefined
   */
  static getTexture (index: number, textures: Texture[]): Texture | null {
    if (index < 0 || index >= textures.length) {
      return null;
    } else {
      return textures[index];
    }
  }

  /**
   * 从图像创建纹理
   * @param engine - 引擎
   * @param image - HTML 图像元素
   * @returns
   */
  static createTextureFromImage (engine: Engine, image: HTMLImageElement | HTMLCanvasElement): Texture {
    const options: TextureSourceOptions = {
      name: 'createTextureFromImage',
      image,
      sourceType: TextureSourceType.image,
      flipY: false,
      magFilter: glContext.LINEAR,
      minFilter: glContext.LINEAR,
      wrapT: glContext.REPEAT,
      wrapS: glContext.REPEAT,
    };

    return Texture.create(engine, options);
  }

  /**
   * 创建渲染 Pass
   * @param renderer - 渲染器
   * @param name - 名称
   * @param priority - 优先级
   * @param meshData - Mesh 数据或数据列表
   * @param fboOpts - FBO 参数
   * @returns
   */
  static createRenderPass (renderer: Renderer, name: string, priority: number, meshData: Mesh | Mesh[], fboOpts: FBOOptions): RenderPass {
    const meshList = meshData instanceof Mesh ? [meshData] : meshData;

    return new RenderPass(renderer, {
      name,
      priority,
      attachments: fboOpts.colorAttachments,
      depthStencilAttachment: fboOpts.depthAttachment,
      clearAction: {
        clearDepth: 1,
        clearStencil: 0,
        clearColor: [0, 0, 0, 0],
        colorAction: TextureLoadAction.clear,
        depthAction: TextureLoadAction.clear,
      },
      // storeAction: {
      //   colorAction: TextureStoreAction.store,
      // },
      meshes: meshList,
      viewport: fboOpts.viewport,
    });
  }

  /**
   * 删除纹理
   * @param texture - 纹理对象
   */
  static deleteTexture (texture: Texture) {
    texture.dispose();
  }

  /**
   * 删除 Mesh
   * @param mesh - Mesh 对象
   */
  static deleteMesh (mesh: Mesh) {
    mesh.dispose({
      geometries: DestroyOptions.destroy,
      material: {
        textures: DestroyOptions.destroy,
      },
    });
  }

  /**
   * 删除几何
   * @param geometry - 几何体
   */
  static deleteGeometry (geometry: Geometry) {
    geometry.dispose();
  }

  /**
   * 删除渲染 Pass
   * @param pass - 渲染 Pass
   */
  static deleteRenderPass (pass: RenderPass) {
    pass.dispose({
      meshes: {
        geometries: DestroyOptions.destroy,
        material: {
          textures: DestroyOptions.destroy,
        },
      },
      depthStencilAttachment: RenderPassDestroyAttachmentType.force,
      colorAttachment: RenderPassDestroyAttachmentType.force,
      semantics: DestroyOptions.destroy,
    });
  }

  /**
   * 返回 Mesh 是否半透明
   * @param component - ModelMeshComponent 对象
   * @return 是否半透明
   */
  static isTransparentMesh (component: ModelMeshComponent): boolean {
    return component.material.blending === true;
  }

  /**
   * renderer 是否支持 Float 纹理
   * @param engine - 引擎对象
   * @returns
   */
  static isSupportFloatTexture (engine: Engine): boolean {
    const capability = engine.gpuCapability;

    return capability.detail.floatTexture !== 0;
  }

  /**
   * renderer 是否支持 HalfFloat 纹理
   * @returns
   */
  static isSupportHalfFloatTexture (engine: Engine): boolean {
    const capability = engine.gpuCapability;

    return capability.detail.halfFloatTexture !== 0;
  }

  /**
   * 是否 2 的幂次
   * @param v - 数值
   * @returns
   */
  static isPow2 (v: number): boolean {
    return !(v & (v - 1)) && (!!v);
  }
}

/**
 * Mesh 辅助类，负责 Mesh 相关的基础对象创建
 */
export class MeshHelper {
  /**
   * 创建滤波 Mesh
   * @param engine - 引擎
   * @param name - 名称
   * @param material - 3D 材质
   * @param uniformSemantics - 传入的 Uniform 数据
   * @returns Mesh 对象
   */
  static createFilterMesh (engine: Engine, name: string, material: PMaterialBase, uniformSemantics: { [k: string]: any }): Mesh {
    const globalState = PGlobalState.getInstance();
    const vertexShader = material.vertexShaderCode;
    const fragmentShader = material.fragmentShaderCode;
    const geometry = Geometry.create(engine, MeshHelper.getPlaneGeometry());
    const isWebGL2 = engine.gpuCapability.level === 2;
    const effectsMaterial = Material.create(
      engine,
      {
        shader: {
          vertex: vertexShader,
          fragment: fragmentShader,
          shared: globalState.shaderShared,
          glslVersion: isWebGL2 ? GLSLVersion.GLSL3 : GLSLVersion.GLSL1,
        },
        uniformSemantics,
      }
    );

    material.setMaterialStates(effectsMaterial);

    return Mesh.create(
      engine,
      {
        name,
        worldMatrix: Matrix4.fromIdentity(),
        material: effectsMaterial,
        geometry,
      }
    );
  }

  /**
   * 获取平面的几何参数
   * @returns 几何参数
   */
  static getPlaneGeometry (): GeometryProps {
    const data = MeshHelper.getPlaneVertexArray();

    return {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 3,
          data,
          stride: Float32Array.BYTES_PER_ELEMENT * 8,
          offset: 0,
        },
        aUV: {
          type: glContext.FLOAT,
          size: 2,
          stride: Float32Array.BYTES_PER_ELEMENT * 8,
          offset: Float32Array.BYTES_PER_ELEMENT * 3,
          dataSource: 'aPos',
        },
        aNormal: {
          type: glContext.FLOAT,
          size: 3,
          stride: Float32Array.BYTES_PER_ELEMENT * 8,
          offset: Float32Array.BYTES_PER_ELEMENT * 5,
          dataSource: 'aPos',
        },
      },
      drawStart: 0,
      drawCount: data.length / 8,
    };
  }

  /**
   * 获取平面顶点数组
   * @returns 浮点数组
   */
  static getPlaneVertexArray (): Float32Array {
    const halfSize = 1;

    return new Float32Array([
      -halfSize, -halfSize, 0, 0, 0, 0, 0, 1,
      halfSize, -halfSize, 0, 1, 0, 0, 0, 1,
      halfSize, halfSize, 0, 1, 1, 0, 0, 1,

      -halfSize, -halfSize, 0, 0, 0, 0, 0, 1,
      halfSize, halfSize, 0, 1, 1, 0, 0, 1,
      -halfSize, halfSize, 0, 0, 1, 0, 0, 1,
    ]);
  }
}

export interface EffectsSceneInfo {
  loadSkybox?: boolean,
}

/**
 * 3D 插件辅助类，为插件提供基础的函数
 */
export class PluginHelper {
  /**
   * 创建 3D 灯光参数，从 glTF 灯光参数
   * @param light - glTF 灯光参数
   * @returns 3D 灯光参数
   */
  static createLightOptions (light: GLTFLight): ModelLightOptions {
    const color = light.color ?? [255, 255, 255, 255];

    if (light.type === 'point') {
      return {
        color,
        intensity: light.intensity ?? 1.0,
        //
        lightType: 'point',
        range: light.range ?? 0,
      };
    } else if (light.type === 'spot') {
      return {
        color,
        intensity: light.intensity ?? 1.0,
        //
        lightType: 'spot',
        range: light.range ?? 0,
        innerConeAngle: light.innerConeAngle ?? 0,
        outerConeAngle: light.outerConeAngle ?? Math.PI / 4.0,
      };
    } else { // "directional"
      return {
        color,
        intensity: light.intensity ?? 1.0,
        //
        lightType: 'directional',
      };
    }
  }

  /**
   * 创建 3D 相机参数，从 glTF 相机参数
   * @param camera - glTF 相机参数
   * @returns 3D 相机参数
   */
  static createCameraOptions (camera: GLTFCamera): ModelCameraOptions | undefined {
    if (camera.perspective === undefined) { return; }

    const p = camera.perspective;
    const options: ModelCameraOptions = {
      near: p.znear,
      far: p.zfar ?? 1000,
      fov: p.yfov,
      clipMode: 0,
    };

    return options;
  }

  /**
   * 转成播放器中 [0, 255] 区间的颜色值
   * @param color - RGB 颜色值
   * @returns RGB 颜色值
   */
  static toPlayerColor3 (color: spec.vec3): spec.vec3 {
    // [0, 1] => [0, 255]
    return [
      this.scaleTo255(color[0]),
      this.scaleTo255(color[1]),
      this.scaleTo255(color[2]),
    ];
  }

  /**
   * 转成播放器中 [0, 255] 区间的颜色值
   * @param color - RGBA 颜色值
   * @returns RGBA 颜色值
   */
  static toPlayerColor4 (color: spec.vec4): spec.vec4 {
    // [0, 1] => [0, 255]
    return [
      this.scaleTo255(color[0]),
      this.scaleTo255(color[1]),
      this.scaleTo255(color[2]),
      this.scaleTo255(color[3]),
    ];
  }

  /**
   * 转成插件中 [0, 1] 区间的颜色值
   * @param color - RGB 颜色值
   * @returns RGB 颜色值
   */
  static toPluginColor3 (color: spec.vec3): spec.vec3 {
    // [0, 255] => [0, 1]
    return [
      this.scaleTo1(color[0]),
      this.scaleTo1(color[1]),
      this.scaleTo1(color[2]),
    ];
  }

  /**
   * 转成插件中 [0, 1] 区间的颜色值
   * @param color - RGBA 颜色值
   * @returns RGBA 颜色值
   */
  static toPluginColor4 (color: spec.vec4): spec.vec4 {
    // [0, 255] => [0, 1]
    return [
      this.scaleTo1(color[0]),
      this.scaleTo1(color[1]),
      this.scaleTo1(color[2]),
      this.scaleTo1(color[3]),
    ];
  }

  /**
   * 创建 UV 变换矩阵，从 UV 变换参数中
   * @param stValue - UV 的缩放和平移参数
   * @param rotateValue - UV 的旋转参数
   * @returns 3阶变换矩阵
   */
  static createUVTransform (material: Material, stName: string, rotateName: string): Matrix3 {
    const stValue = material.getVector4(stName);
    const rotateValue = material.getFloat(rotateName);

    const res = Matrix3.fromIdentity();

    if (stValue) {
      res.setFromArray([
        1, 0, 0,
        0, 1, 0,
        stValue.z, stValue.w, 1,
      ]);
    }

    const temp = new Matrix3();

    if (rotateValue) {
      const cosTheta = Math.cos(rotateValue);
      const sinTheta = Math.sin(rotateValue);

      temp.setFromArray([
        cosTheta, sinTheta, 0,
        -sinTheta, cosTheta, 0,
        0, 0, 1,
      ]);
      res.multiply(temp);
    }

    if (stValue) {
      temp.setFromArray([
        stValue.x, 0, 0,
        0, stValue.y, 0,
        0, 0, 1,
      ]);
      res.multiply(temp);
    }

    res.transpose();

    return res;
  }

  /**
   * 获取截断后的数值
   * @param val - 数值
   * @param minv - 最小值
   * @param maxv - 最大值
   * @returns
   */
  static clamp (val: number, minv: number, maxv: number): number {
    return Math.max(Math.min(val, maxv), minv);
  }

  /**
   * 转换成 [0, 255] 区间数值
   * @param val - [0, 1] 区间数值
   * @returns
   */
  static scaleTo255 (val: number): number {
    const intVal = Math.round(val * 255);

    return Math.max(0, Math.min(intVal, 255));
  }

  /**
   * 转换成 [0, 1] 区间数值
   * @param val - [0, 255] 区间数值
   * @returns
   */
  static scaleTo1 (val: number): number {
    const floatVal = val / 255.0;

    return Math.max(0.0, Math.min(floatVal, 1.0));
  }

  /**
   * 根据相机的位置、Y 轴旋转角度和目标点位置来计算相机变换，
   * 使得相机能够专注于目标点上
   * @param cameraPosition - 相机位置
   * @param YRotationAngle - Y 轴旋转角度
   * @param targetPoint - 目标点
   * @returns 相机变换
   */
  static focusOnPoint (cameraPosition: spec.vec3, YRotationAngle: number, targetPoint: spec.vec3) {
    const camPos = Vector3.fromArray(cameraPosition);
    const targetPos = Vector3.fromArray(targetPoint);
    const deltaPos = new Vector3().copyFrom(camPos).subtract(targetPos);
    const rotationMat = Matrix4.fromRotationAxis(new Vector3(0, 1, 0), YRotationAngle * DEG2RAD);

    rotationMat.transformPoint(deltaPos);
    const newCamPos = deltaPos.clone().add(targetPos);
    const viewMatrix = new Matrix4().lookAt(newCamPos, targetPos, new Vector3(0, 1, 0)).invert();
    const effectsTransform = new Transform();

    effectsTransform.setValid(true);
    effectsTransform.cloneFromMatrix(viewMatrix);

    return effectsTransform;
  }

  /**
   * 场景预处理，在移动端 3D 插件会对场景进行预处理，调整纹理参数
   * @param scene - 场景
   * @param runtimeEnv - 运行时环境
   * @param compatibleMode - 兼容模式
   * @param autoAdjustScene - 是否自动调整
   * @returns 场景信息描述
   */
  static preprocessScene (scene: Scene, runtimeEnv: string, compatibleMode: string): EffectsSceneInfo {
    const deviceEnv = (runtimeEnv !== PLAYER_OPTIONS_ENV_EDITOR);
    const tiny3dMode = (compatibleMode === 'tiny3d');
    // 默认skybox如何处理需要讨论
    const jsonScene = scene.jsonScene;

    if (!(jsonScene && jsonScene.textures && jsonScene.materials)) {
      // 安全检查
      return {};
    }

    const dataMap: Record<string, TextureSourceOptions> = {};

    scene.textureOptions.forEach(tex => {
      const id = tex.id;

      if (id) {
        dataMap[id] = tex;
      }
    });

    let loadSkybox = false;

    if (deviceEnv) {
      jsonScene.materials.forEach(mat => {
        this.preprocessTextureOptions(dataMap, mat.textures['_BaseColorSampler'], true, tiny3dMode);
        this.preprocessTextureOptions(dataMap, mat.textures['_MetallicRoughnessSampler'], false, tiny3dMode);
        this.preprocessTextureOptions(dataMap, mat.textures['_NormalSampler'], false, tiny3dMode);
        this.preprocessTextureOptions(dataMap, mat.textures['_OcclusionSampler'], false, tiny3dMode);
        this.preprocessTextureOptions(dataMap, mat.textures['_EmissiveSampler'], false, tiny3dMode);
      });
      jsonScene.components.forEach(comp => {
        if (comp.dataType === spec.DataType.SkyboxComponent) {
          loadSkybox = true;
          const skybox = comp as spec.SkyboxComponentData;

          if (skybox.diffuseImage) {
            this.preprocessTextureOptions(dataMap, skybox.diffuseImage, false, tiny3dMode);
          }
          if (skybox.specularImage) {
            this.preprocessTextureOptions(dataMap, skybox.specularImage, false, tiny3dMode);
          }
        }
      });
    }

    return { loadSkybox };
  }

  /**
   * 纹理参数预处理，设置环绕模式和滤波器
   * @param index - 纹理索引
   * @param textures - 纹理数组
   * @param isBaseColor - 是否基础颜色
   * @param tiny3dMode - 是否 Tiny3d 模式
   * @returns
   */
  static preprocessTextureOptions (dataMap: Record<string, TextureSourceOptions>, textureInfo: spec.MaterialTextureProperty | spec.DataPath, isBaseColor: boolean, tiny3dMode: boolean) {
    if (!tiny3dMode || !textureInfo) {
      return;
    }

    let texId;

    if ('texture' in textureInfo) {
      texId = textureInfo.texture.id;
    } else {
      texId = textureInfo.id;
    }

    if (!texId) {
      return;
    }

    const texOptions = dataMap[texId];

    if (!texOptions) {
      return;
    }

    if (texOptions.target === undefined || texOptions.target === glContext.TEXTURE_2D) {
      texOptions.wrapS = glContext.REPEAT;
      texOptions.wrapT = glContext.REPEAT;
      texOptions.magFilter = glContext.LINEAR;
      texOptions.minFilter = glContext.LINEAR_MIPMAP_LINEAR;
      if (!isBaseColor) {
        texOptions.premultiplyAlpha = true;
      }
      const newOptions = texOptions as Texture2DSourceOptionsImage;

      newOptions.generateMipmap = true;
      const image = newOptions.image;

      if (image && image.width && image.height) {
        if (!WebGLHelper.isPow2(image.width) || !WebGLHelper.isPow2(image.height)) {
          texOptions.minFilter = glContext.LINEAR;
        }
      }
    } else if (texOptions.target === glContext.TEXTURE_CUBE_MAP) {
      texOptions.wrapS = glContext.CLAMP_TO_EDGE;
      texOptions.wrapT = glContext.CLAMP_TO_EDGE;
      if ((texOptions as TextureCubeSourceOptionsImageMipmaps).mipmaps !== undefined) {
        if ((texOptions as TextureCubeSourceOptionsImageMipmaps).mipmaps.length === 1) {
          texOptions.magFilter = glContext.LINEAR;
          texOptions.minFilter = glContext.LINEAR;
        } else {
          texOptions.magFilter = glContext.LINEAR;
          texOptions.minFilter = glContext.LINEAR_MIPMAP_LINEAR;
        }
      } else {
        texOptions.magFilter = glContext.LINEAR;
        texOptions.minFilter = glContext.LINEAR;
      }
    }
  }

  /**
   * 设置 3D 元素参数，在播放器创建 3D 元素前
   * @param scene - 场景
   * @param cache - 缓存
   * @param composition - 合成
   * @returns
   */
  static setupItem3DOptions (scene: Scene, cache: CompositionCache, composition: Composition) {
    if (scene === undefined || scene.bins.length <= 0) {
      return;
    }

    const { jsonScene } = scene;
    const compIndexSet: Set<number> = new Set();

    if (jsonScene.compositionId === undefined) {
      compIndexSet.add(0);
    }

    jsonScene.compositions.forEach((comp, index) => {
      if (comp.id === jsonScene.compositionId || composition.refCompositionProps.has(comp.id)) {
        compIndexSet.add(index);
      }
    });

    compIndexSet.forEach(compIndex => {
      const sceneComp = jsonScene.compositions[compIndex];

      sceneComp.items.forEach(data => {
        const itemId = data.id;
        const item = composition.getEngine().jsonSceneData[itemId] as VFXItemData;

        if (item.type === spec.ItemType.mesh) {
          const meshItem = item as spec.ModelMeshItem<'json'>;
          const skin = meshItem.content.options.skin;
          const primitives = meshItem.content.options.primitives;

          primitives.forEach((prim, primId) => {
            if (prim.geometry instanceof Geometry) {
              // 可能已经创建，直接返回
              return;
            }

            const name = `Geom_C${compIndex}_I${itemId}_P${primId}`;
            const riGeometry = cache.getOrCreateGeometry(name, prim.geometry, scene.bins);
            const studioPrim = prim as spec.PrimitiveOptions<'studio'>;

            studioPrim.geometry = riGeometry;
            const material = prim.material;

            if (material.type === spec.MaterialType.pbr) {
              const studioMat = studioPrim.material as spec.MaterialPBROptions<'studio'>;

              studioMat.baseColorTexture = this.getTextureObj(composition.textures, material.baseColorTexture);
              studioMat.metallicRoughnessTexture = this.getTextureObj(composition.textures, material.metallicRoughnessTexture);
              studioMat.normalTexture = this.getTextureObj(composition.textures, material.normalTexture);
              studioMat.occlusionTexture = this.getTextureObj(composition.textures, material.occlusionTexture);
              studioMat.emissiveTexture = this.getTextureObj(composition.textures, material.emissiveTexture);
            } else {
              const studioMat = studioPrim.material as spec.MaterialUnlitOptions<'studio'>;

              studioMat.baseColorTexture = this.getTextureObj(composition.textures, material.baseColorTexture);
            }
          });

          if (skin !== undefined && skin.inverseBindMatrices !== undefined) {
            const studioSkin = skin as any as spec.SkinOptions<'studio'>;
            const inverseBindMatrices = typedArrayFromBinary(scene.bins, skin.inverseBindMatrices);

            if (inverseBindMatrices instanceof Float32Array) {
              studioSkin.inverseBindMatrices = inverseBindMatrices;
            } else {
              console.error(`setupItem3DOptions: Invalid inverseBindMatrices type, ${inverseBindMatrices}`);
            }
          }
        } else if (item.type === spec.ItemType.tree) {
          const jsonItem = item as spec.ModelTreeItem<'json'>;
          const studioItem = item as spec.ModelTreeItem<'studio'>;
          const jsonAnimations = jsonItem.content.options.tree.animations;
          const studioAnimations = studioItem.content.options.tree.animations;

          if (jsonAnimations !== undefined && studioAnimations !== undefined) {
            jsonAnimations.forEach((jsonAnim, i) => {
              const studioAnim = studioAnimations[i];

              jsonAnim.tracks.forEach((jsonTrack, j) => {
                const inputArray = typedArrayFromBinary(scene.bins, jsonTrack.input);
                const outputArray = typedArrayFromBinary(scene.bins, jsonTrack.output);
                const studioTrack = studioAnim.tracks[j];

                if (inputArray instanceof Float32Array) {
                  studioTrack.input = inputArray;
                } else {
                  console.error(`setupItem3DOptions: Type of inputArray should be float32, ${inputArray}`);
                }
                if (outputArray instanceof Float32Array) {
                  studioTrack.output = outputArray;
                } else {
                  console.error(`setupItem3DOptions: Type of outputArray should be float32, ${outputArray}`);
                }
              });
            });
          }
        } else if (item.type === spec.ItemType.skybox) {
          const skybox = item as spec.ModelSkyboxItem<'json'>;
          const studioSkybox = item as spec.ModelSkyboxItem<'studio'>;
          const options = skybox.content.options;
          const studioOptions = studioSkybox.content.options;
          const specularImage = this.getTextureObj(composition.textures, options.specularImage);

          if (specularImage === undefined) {
            console.error(`setupItem3DOptions: skybox specualrImage is undefined, ${CheckerHelper.stringify(options)}`);
          }
          studioOptions.specularImage = specularImage;
          //
          const diffuseImage = this.getTextureObj(composition.textures, options.diffuseImage);

          if (diffuseImage !== undefined) {
            studioOptions.diffuseImage = diffuseImage;
          }
        }
      });
    });

  }

  /**
   * 创建几何体，根据几何参数描述 JSON 和数据数组
   * @param engine - 引擎
   * @param geomJson - 几何参数描述 JSON
   * @param bins - 数据数组
   * @returns 几何体
   */
  static createGeometry (engine: Engine, geomJson: spec.GeometryOptionsJSON, bins: ArrayBuffer[]): Geometry {
    const geomOptions = deserializeGeometry(geomJson, bins);
    const attributes: Record<string, Attribute> = {};

    // 兼容代码，解决 attribute 的名称问题
    for (const attrib in geomOptions.attributes) {
      const attribData = geomOptions.attributes[attrib];
      const name = this.getAttributeName(attrib);

      attributes[name] = attribData;
    }
    geomOptions.attributes = attributes;

    return Geometry.create(engine, geomOptions);
  }

  /**
   * 索引数组类型转换
   * @param type - 类型
   * @param array - 索引数组
   * @returns 索引数组
   */
  static getIndexArray (type: number, array: spec.TypedArray) {
    switch (type) {
      case WebGLRenderingContext['UNSIGNED_INT']:
        return array as Uint32Array;
      case WebGLRenderingContext['UNSIGNED_SHORT']:
        return array as Uint16Array;
      case WebGLRenderingContext['UNSIGNED_BYTE']:
        return array as Uint8Array;
      default:
        console.error(`Invalid index attribute type ${type}`);
    }
  }

  /**
   * 属性名称转换
   * @param name - 旧名称
   * @returns 新名称
   */
  static getAttributeName (name: string): string {
    switch (name) {
      case 'POSITION': return 'aPos';
      case 'NORMAL': return 'aNormal';
      case 'TANGENT': return 'aTangent';
      case 'TEXCOORD_0': return 'aUV';
      case 'TEXCOORD_1': return 'aUV2';
      case 'JOINTS_0': return 'aJoints';
      case 'WEIGHTS_0': return 'aWeights';
    }

    if (!name.startsWith('a')) {
      // aPos, aNormal, aTangent,
      // aUV, aUV2, aJoints, aWeights
      // aTargetXXX
      console.warn(`Unknown attribute name: ${name}`);
    }

    return name;
  }

  /**
   * 获取纹理对象
   * @param textures - 纹理数组
   * @param index - 索引
   * @returns
   */
  static getTextureObj (textures: Texture[], index?: number): Texture | null {
    if (typeof index !== 'number') {
      return null;
    }

    if (index < 0 || index >= textures.length) {
      console.error(`Invalid index for textures: ${index}, ${textures.length}`);
    }

    return textures[index];
  }
}

/**
 * Web 辅助类，负责 Web 相关的基础功能
 */
export class WebHelper {
  /**
   * 获取图像文件名，从 URL 链接中
   * @param url - 链接
   * @param ext - 扩展名
   * @returns
   */
  static getImageFileName (url: string, ext?: string): string {
    const begin = url.lastIndexOf('/');
    const end = url.lastIndexOf('.');
    const substr = url.substring(begin + 1, end);

    return ext ? substr + ext : substr;
  }

  /**
   * 获取当前时间字符串
   * @returns
   */
  static getCurrnetTimeStr (): string {
    const date = new Date(Date.now());
    const timeStr = date.toLocaleString('zh-CN');
    const ms = `${date.getMilliseconds()}`;

    return timeStr.split(/[ /:]+/).join('') + ms.padStart(3, '0');
  }

  /**
   * 将 URL 链接保存成文件
   * @param url - 链接
   * @param filename - 文件名
   */
  static saveFileForURL (url: string, filename: string) {
    const a = document.createElement('a');

    a.setAttribute('download', filename);
    a.target = '_blank';
    a.href = url;
    a.click();
  }

  /**
   * 创建播放器
   * @param manualRender - 是否手动渲染
   * @returns
   */
  static createPlayer (manualRender = true) {
    const canvas = document.createElement('canvas');

    canvas.width = 512;
    canvas.height = 512;

    return new Player({
      canvas,
      renderFramework: 'webgl2',
      env: PLAYER_OPTIONS_ENV_EDITOR,
      renderOptions: {
        willCaptureImage: true,
      },
      manualRender,
    });
  }

  /**
   * 休眠
   * @param ms - 时间，单位是毫秒
   * @returns
   */
  static async sleep (ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 从 glTF 图像加载 HTML 图像元素
   * @param image - glTF 图像
   * @returns HTML 图像元素
   */
  static async loadImageFromGLTFImage (image: GLTFImage): Promise<HTMLImageElement> {
    return loadImage(new Blob([image.imageData], { type: image.mimeType }));
  }

  /**
   * 从图像缓存区数据加载 HTML 图像元素
   * @param image - 图像缓冲区数据
   * @returns
   */
  static async loadImageFromImageData (image: PImageBufferData): Promise<HTMLImageElement> {
    return loadImage(new Blob([image.data], { type: image.mimeType }));
  }

  /**
   * 获取画布渲染的内容，转成 PNG 图片数据
   * @param canvas - HTML 画布元素
   * @returns PNG 图片数据
   */
  static async getCanvasArrayBuffer (canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) {
          resolve(b.arrayBuffer());
        } else {
          reject(new Error('no canvas blob'));
        }
      }, 'image/png', 1);
    });
  }

  /**
   * 从 HTML 图像、视频或位图图像对象获取图像数据
   * @param image - HTML 图像、视频或位图图像
   * @returns PNG 图片数据
   */
  static async getImageArrayBuffer (image: HTMLImageElement | ImageBitmap | HTMLVideoElement): Promise<ArrayBuffer> {
    const cvs = document.createElement('canvas');

    cvs.width = image.width;
    cvs.height = image.height;
    (cvs.getContext('2d') as CanvasRenderingContext2D).drawImage(image, 0, 0);

    return this.getCanvasArrayBuffer(cvs);
  }

  /**
   * 获取画布元素渲染结果
   * @param canvas - 画布元素
   * @returns
   */
  static getCanvasImageData (canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * 翻转图像
   * @param imageData - 图像数据
   * @returns 翻转后的图像
   */
  static flipImageData (imageData: ImageData): ImageData {
    const flipped = document.createElement('canvas');
    const ctx = flipped.getContext('2d') as CanvasRenderingContext2D;

    flipped.width = imageData.width;
    flipped.height = imageData.height;
    // first put the imageData
    ctx.putImageData(imageData, 0, 0);
    // because we've got transparency
    ctx.globalCompositeOperation = 'copy';
    ctx.scale(1, -1); // Y flip
    ctx.translate(0, -imageData.height); // so we can draw at 0,0
    ctx.drawImage(flipped, 0, 0);
    // now we can restore the context to defaults if needed
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    return ctx.getImageData(0, 0, flipped.width, flipped.height);
  }

  /**
   * 从 HTML 图像、视频或位图图像对象获取翻转后的图像数据
   * @param image - HTML 图像、视频或位图图像
   * @returns PNG 图片数据
   */
  static getImageData (image: HTMLImageElement | ImageBitmap | HTMLVideoElement): ImageData {
    const cvs = document.createElement('canvas');

    cvs.width = image.width;
    cvs.height = image.height;
    const ctx = cvs.getContext('2d') as CanvasRenderingContext2D;

    ctx.drawImage(image, 0, 0);

    return this.flipImageData(ctx.getImageData(0, 0, cvs.width, cvs.height));
  }

  /**
   * 获取位图数据，从 HTML 画布元素
   * @param canvas - HTML 画布元素
   * @returns uint8 数组
   */
  static getWebGLCanvasImageBuffer (canvas: HTMLCanvasElement): Uint8Array {
    const ctx = canvas.getContext('webgl2') as WebGL2RenderingContext;
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);

    ctx.readPixels(0, 0, canvas.width, canvas.height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);

    return pixels;
  }
}

/**
 * 顶点属性缓冲区
 */
export class VertexAttribBuffer {
  /**
   * 顶点数组
   */
  data!: VertexArray;
  /**
   * 分量数
   */
  component = 0;
  /**
   * 长度
   */
  length = 0;
  /**
   * 偏移
   */
  offset = 0;
  /**
   * 步长
   */
  stride = 0;
  /**
   * 类型大小
   */
  typeSize = 0;

  /**
   * 获取包围盒，根据顶点数据
   * @param box - 包围盒，会被修改
   * @returns 包围盒
   */
  getBoundingBox (box: Box3) {
    let index = this.offset;
    const point = new Vector3();

    while (index + this.component <= this.length) {
      if (this.component == 2) {
        point.set(this.data[index], this.data[index + 1], 0);
      } else {
        point.set(this.data[index], this.data[index + 1], this.data[index + 2]);
      }
      box.expandByPoint(point);
      index += this.stride;
    }

    return box;
  }
}

class AttributeArray {
  data!: spec.TypedArray;
  //
  length = 0;
  offset = 0;
  stride = 0;
  //
  typeSize = 0;
  compCount = 0;
  //
  signed = false;
  compressed = false;
  compressScale = 1.0;

  create (inAttrib: Attribute, inArray: spec.TypedArray) {
    switch (inAttrib.type) {
      case WebGLRenderingContext['INT']:
        this.typeSize = 4;
        this.signed = true;
        this.compressScale = 1 / 2147483647.0;

        break;
      case WebGLRenderingContext['SHORT']:
        this.typeSize = 2;
        this.signed = true;
        this.compressScale = 1 / 32767.0;

        break;
      default:
        this.typeSize = 4;
        this.signed = true;
        this.compressScale = 1.0;
    }

    this.data = inArray;
    this.length = this.data.length;
    this.compCount = inAttrib.size;
    //
    this.offset = inAttrib.offset ?? 0;
    if (this.offset > 0) {
      if (this.offset % this.typeSize !== 0) { console.error(`Invalid offset ${this.offset}, type size ${this.typeSize}`); }
      this.offset = this.offset / this.typeSize;
    }
    //
    this.stride = inAttrib.stride ?? 0;
    if (this.stride > 0) {
      if (this.stride % this.typeSize !== 0) { console.error(`Invalid stride ${this.stride}, type size ${this.typeSize}`); }
      this.stride = this.stride / this.typeSize;
    } else {
      this.stride = this.compCount;
    }
    //
    this.compressed = inAttrib.normalize === true;
  }

  getData (index: number): [number, number, number, number] | undefined {
    let offset = this.offset;

    offset += index * this.stride;
    if (offset + this.compCount > this.length) { return; }

    let res: [number, number, number, number];

    if (this.compCount === 2) {
      res = [this.data[offset], this.data[offset + 1], 0, 0];
    } else if (this.compCount === 3) {
      res = [this.data[offset], this.data[offset + 1], this.data[offset + 2], 0];
    } else {
      res = [this.data[offset], this.data[offset + 1], this.data[offset + 2], this.data[offset + 3]];
    }

    if (this.compressed) {
      for (let i = 0; i < this.compCount; i++) {
        res[i] *= this.compressScale;
        if (this.signed) {
          res[i] = Math.max(res[i], -1.0);
        }
      }
    }

    return res;
  }

  getLength (): number {
    return Math.round((this.length - this.offset) / this.stride);
  }
}

/**
 * 几何包围盒代理类
 */
export class GeometryBoxProxy {
  /**
   * 渲染开始索引
   */
  drawStart = 0;
  /**
   * 渲染索引数目
   */
  drawCount = 0;
  /**
   * 索引数组
   */
  index?: spec.TypedArray;
  /**
   * 位置数组
   */
  position!: AttributeArray;
  /**
   * 关节点数组
   */
  joint?: AttributeArray;
  /**
   * 权重数组
   */
  weight?: AttributeArray;
  /**
   * 绑定矩阵数组
   */
  bindMatrices: Matrix4[] = [];

  /**
   * 创建函数，根据几何体和绑定矩阵数组
   * @param geometry - 几何体
   * @param bindMatrices - 绑定矩阵数组
   */
  create (geometry: Geometry, bindMatrices: Matrix4[]) {
    this.drawStart = 0;
    this.drawCount = Math.abs(geometry.getDrawCount());
    // FIXME: 需要geometry中的attributes数组，GLGeometry有这个数组，其他的没有
    // @ts-expect-error
    const attributes = geometry.attributes as Record<string, Attribute>;

    //
    this.index = geometry.getIndexData();
    const positionAttrib = attributes['aPos'];
    const positionArray = geometry.getAttributeData('aPos') as spec.TypedArray;

    this.position = new AttributeArray();
    this.position.create(positionAttrib, positionArray);
    //
    const jointAttrib = attributes['aJoints'];
    const weightAttrib = attributes['aWeights'];

    if (jointAttrib !== undefined && weightAttrib !== undefined) {
      const jointArray = geometry.getAttributeData('aJoints') as spec.TypedArray;
      const weightArray = geometry.getAttributeData('aWeights') as spec.TypedArray;

      this.joint = new AttributeArray();
      this.joint.create(jointAttrib, jointArray);
      this.weight = new AttributeArray();
      this.weight.create(weightAttrib, weightArray);
    }
    this.bindMatrices = bindMatrices;
  }

  /**
   * 获取包围盒，如果有骨骼动画，需要先更新位置
   * @param box - 包围盒，会被修改
   * @returns 包围盒
   */
  getBoundingBox (box: Box3) {
    box.makeEmpty();
    const skinMat = new Matrix4();
    const hasAnim = this.joint !== undefined && this.weight !== undefined && this.bindMatrices.length > 0;

    const indexSet: Set<number> = new Set();

    if (this.index !== undefined) {
      for (let i = 0; i < this.drawCount; i++) {
        const j = this.drawStart + i;

        if (j < this.index.length) {
          indexSet.add(this.index[j]);
        }
      }
    } else {
      for (let i = 0; i < this.drawCount; i++) {
        indexSet.add(this.drawStart + i);
      }
    }

    indexSet.forEach(index => {
      const posData = this.position.getData(index);

      if (posData !== undefined) {
        const posVec = Vector3.fromArray(posData);

        if (hasAnim) {
          const jointData = this.joint?.getData(index);
          const weightData = this.weight?.getData(index);

          if (jointData !== undefined && weightData !== undefined) {
            skinMat.setZero();
            let findError = false;

            for (let i = 0; i < 4; i++) {
              if (weightData[i] === 0) {
                continue;
              }

              if (jointData[i] < 0 || jointData[i] >= this.bindMatrices.length) {
                findError = true;

                break;
              }

              const bindMat = this.bindMatrices[jointData[i]];

              skinMat.addScaledMatrix(bindMat, weightData[i]);
            }

            if (!findError) {
              const resVec = skinMat.transformVector4(new Vector4(posVec.x, posVec.y, posVec.z, 1.0));

              if (Math.abs(resVec.w) > 1e-4) {
                resVec.multiply(1.0 / resVec.w);
                posVec.set(resVec.x, resVec.y, resVec.z);
              }
            }
          }
        }

        box.expandByPoint(posVec);
      }
    });

    return box;
  }
}

/**
 * 点击测试代理类，
 */
export class HitTestingProxy {
  /**
   * 渲染开始索引
   */
  drawStart = 0;
  /**
   * 渲染索引数目
   */
  drawCount = 0;
  /**
   * 索引数组
   */
  index?: spec.TypedArray;
  /**
   * 位置数组
   */
  position!: AttributeArray;
  /**
   * 关节点数组
   */
  joint?: AttributeArray;
  /**
   * 权重数组
   */
  weight?: AttributeArray;
  /**
   * 是否双面
   */
  doubleSided = false;
  /**
   * 绑定矩阵数组
   */
  bindMatrices: Matrix4[] = [];
  /**
   * 是否有动画
   */
  hasAnimation = false;
  /**
   * 蒙皮矩阵
   */
  skinMatrix = new Matrix4();

  /**
   * 创建对象，传入几何体、是否双面和绑定矩阵列表
   * @param geometry - 几何体
   * @param doubleSided - 是否双面
   * @param bindMatrices - 绑定矩阵列表
   */
  create (geometry: Geometry, doubleSided: boolean, bindMatrices: Matrix4[]) {
    this.drawStart = 0;
    this.drawCount = Math.abs(geometry.getDrawCount());
    // FIXME: 需要geometry中的attributes数组，GLGeometry有这个数组，其他的没有
    // @ts-expect-error
    const attributes = geometry.attributes as Record<string, Attribute>;

    //
    this.index = geometry.getIndexData();
    const positionAttrib = attributes['aPos'];
    const positionArray = geometry.getAttributeData('aPos') as spec.TypedArray;

    this.position = new AttributeArray();
    this.position.create(positionAttrib, positionArray);
    //
    const jointAttrib = attributes['aJoints'];
    const weightAttrib = attributes['aWeights'];

    if (jointAttrib !== undefined && weightAttrib !== undefined) {
      const jointArray = geometry.getAttributeData('aJoints') as spec.TypedArray;
      const weightArray = geometry.getAttributeData('aWeights') as spec.TypedArray;

      this.joint = new AttributeArray();
      this.joint.create(jointAttrib, jointArray);
      this.weight = new AttributeArray();
      this.weight.create(weightAttrib, weightArray);
    }
    this.doubleSided = doubleSided;
    this.bindMatrices = bindMatrices;
    this.hasAnimation = this.joint !== undefined && this.weight !== undefined && this.bindMatrices.length > 0;
  }

  /**
   * 点击测试，返回射线参数值
   * @param rayOrigin - 射线原点
   * @param rayDirection - 射线方向
   * @returns 射线参数值或 undefined
   */
  getHitPoint (rayOrigin: Vector3, rayDirection: Vector3): number | undefined {
    let mint: number | undefined;
    const p0 = new Vector3(), p1 = new Vector3(), p2 = new Vector3();
    const q0 = new Vector4(), q1 = new Vector4(), q2 = new Vector4();
    const backfaceCulling = !this.doubleSided;

    for (let i = 0; i + 2 < this.drawCount; i += 3) {
      let i0 = this.drawStart + i;
      let i1 = this.drawStart + i + 1;
      let i2 = this.drawStart + i + 2;

      if (this.index !== undefined) {
        i0 = this.index[i0];
        i1 = this.index[i1];
        i2 = this.index[i2];
      }

      const r0 = this.getPosition(i0, p0, q0);
      const r1 = this.getPosition(i1, p1, q1);
      const r2 = this.getPosition(i2, p2, q2);

      if (!r0 || !r1 || !r2) {
        continue;
      }

      const t = RayTriangleTesting(rayOrigin, rayDirection, r0, r1, r2, backfaceCulling);

      if (t === undefined) {
        continue;
      }

      if (mint === undefined || mint > t) {
        mint = t;
      }
    }

    return mint;
  }

  /**
   * 获取顶点位置
   * @param index - 顶点索引
   * @param vec3 - 顶点位置，会被修改和返回
   * @param vec4 - 临时变量，用于骨骼动画时的计算
   * @returns 顶点位置
   */
  getPosition (index: number, vec3: Vector3, vec4: Vector4): Vector3 | null {
    const posData = this.position.getData(index);

    if (posData === undefined) {
      return null;
    }

    if (this.hasAnimation) {
      const jointData = this.joint?.getData(index);
      const weightData = this.weight?.getData(index);

      if (jointData !== undefined && weightData !== undefined) {
        const skinMat = this.skinMatrix;

        skinMat.setZero();
        for (let i = 0; i < 4; i++) {
          if (weightData[i] === 0) { continue; }

          const bindMat = this.bindMatrices[jointData[i]];

          skinMat.addScaledMatrix(bindMat, weightData[i]);
        }

        vec4.set(posData[0], posData[1], posData[2], 1.0);
        const resVec = skinMat.transformVector4(vec4);
        const scale = 1.0 / resVec.w;

        vec3.set(resVec.x * scale, resVec.y * scale, resVec.z * scale);
      }
    } else {
      vec3.set(posData[0], posData[1], posData[2]);
    }

    return vec3;
  }

}

/**
 * 检查辅助类，负责 3D 插件元素数据格式检查和报错
 */
export class CheckerHelper {
  /**
   * 检查数值
   * @param v - 数值
   * @returns
   */
  static checkNumber (v: number): boolean {
    return typeof v === 'number';
  }

  /**
   * 检查数值或未定义
   * @param v - 数值或未定义
   * @returns
   */
  static checkNumberUndef (v?: number): boolean {
    return v === undefined ? true : this.checkNumber(v);
  }

  /**
   * 检查 0 和 1 之间数值
   * @param v - 数值
   * @returns
   */
  static checkNumber01 (v: number): boolean {
    return this.checkNumber(v) && v >= 0 && v <= 1;
  }

  /**
   * 检查 0 和 1 之间数值或未定义
   * @param v - 数值或未定义
   * @returns
   */
  static checkNumber01Undef (v?: number): boolean {
    return v === undefined ? true : this.checkNumber01(v);
  }

  /**
   * 检查正数
   * @param v - 数值
   * @returns
   */
  static checkPositive (v: number): boolean {
    return this.checkNumber(v) && v > 0;
  }

  /**
   * 检查非负数
   * @param v - 数值
   * @returns
   */
  static checkNonnegative (v: number): boolean {
    return this.checkNumber(v) && v >= 0;
  }

  /**
   * 检查非负数或未定义
   * @param v - 数值
   * @returns
   */
  static checkNonnegativeUndef (v?: number): boolean {
    return v === undefined ? true : this.checkNonnegative(v);
  }

  /**
   * 检查布尔类型
   * @param v - 布尔值
   * @returns
   */
  static checkBoolean (v: boolean): boolean {
    return typeof v === 'boolean';
  }

  /**
   * 检查布尔类型或未定义
   * @param v - 布尔值或未定义
   * @returns
   */
  static checkBooleanUndef (v?: boolean): boolean {
    return v === undefined ? true : this.checkBoolean(v);
  }

  /**
   * 检查字符串类型
   * @param v - 字符串
   * @returns
   */
  static checkString (v: string): boolean {
    return typeof v === 'string';
  }

  /**
   * 检查字符串类型或未定义
   * @param v - 字符串或未定义
   * @returns
   */
  static checkStringUndef (v?: string): boolean {
    return v === undefined ? true : this.checkString(v);
  }

  /**
   * 检查浮点数组
   * @param v - 浮点数组
   * @returns
   */
  static checkFloat32Array (v: Float32Array): boolean {
    return v instanceof Float32Array;
  }

  /**
   * 检查浮点数组或未定义
   * @param v - 浮点数组或未定义
   * @returns
   */
  static checkFloat32ArrayUndef (v?: Float32Array): boolean {
    return v === undefined ? true : this.checkFloat32Array(v);
  }

  /**
   * 检查父节点索引
   * @param v - 数值或未定义
   * @returns
   */
  static checkParent (v?: number): boolean {
    if (v === undefined) { return true; }
    if (!this.checkNumber(v)) { return false; }

    return v >= 0;
  }

  /**
   * 检查纹理坐标
   * @param v - 纹理坐标或未定义
   * @returns
   */
  static checkTexCoord (v?: number): boolean {
    if (v === undefined) { return true; }
    if (!this.checkNumber(v)) { return false; }

    return v >= 0 && v <= 1;
  }

  /**
   * 检查二维向量
   * @param v - 二维向量
   * @returns
   */
  static checkVec2 (v: spec.vec2): boolean {
    if (!Array.isArray(v)) { return false; }
    if (v.length != 2) { return false; }

    return v.every(v => this.checkNumber(v));
  }

  /**
   * 检查二维向量或未定义
   * @param v - 二维向量或未定义
   * @returns
   */
  static checkVec2Undef (v?: spec.vec2): boolean {
    return v === undefined ? true : this.checkVec2(v);
  }

  /**
   * 检查三维向量
   * @param v - 三维向量
   * @returns
   */
  static checkVec3 (v: spec.vec3): boolean {
    if (!Array.isArray(v)) { return false; }
    if (v.length != 3) { return false; }

    return v.every(v => this.checkNumber(v));
  }

  /**
   * 检查三维非负向量
   * @param v - 三维向量
   * @returns
   */
  static checkNonnegative3 (v: spec.vec3): boolean {
    if (!Array.isArray(v)) { return false; }
    if (v.length != 3) { return false; }

    return v.every(v => this.checkNonnegative(v));
  }

  /**
   * 检查四维向量
   * @param v - 四维向量
   * @returns
   */
  static checkVec4 (v: spec.vec4): boolean {
    if (!Array.isArray(v)) { return false; }
    if (v.length != 4) { return false; }

    return v.every(v => this.checkNumber(v));
  }

  /**
   * 检查四维向量或未定义
   * @param v - 四维向量或未定义
   * @returns
   */
  static checkNonnegative4 (v: spec.vec4): boolean {
    if (!Array.isArray(v)) { return false; }
    if (v.length != 4) { return false; }

    return v.every(v => this.checkNonnegative(v));
  }

  /**
   * 检查数值数组
   * @param v - 数值数组
   * @returns
   */
  static checkNumberArray (v: number[]): boolean {
    if (!Array.isArray(v)) { return false; }

    return v.every(v => this.checkNumber(v));
  }

  /**
   * 检查纹理对象
   * @param v - 纹理对象
   * @returns
   */
  static checkTexture (v: Texture): boolean {
    if (v instanceof Texture) {
      if (v.isDestroyed) {
        console.error(`Texture is destroyed, ${v.name}`);
      }

      return !v.isDestroyed;
    } else {
      return false;
    }
  }

  /**
   * 检查纹理对象或未定义
   * @param v - 纹理对象或未定义
   * @returns
   */
  static checkTextureUndef (v?: Texture): boolean {
    return v === undefined ? true : this.checkTexture(v);
  }

  /**
   * 检查纹理变换参数
   * @param v - 纹理变换参数
   * @returns
   */
  static checkTexTransform (v: ModelTextureTransform): boolean {
    if (!this.checkVec2Undef(v.offset)) { return false; }
    if (!this.checkNumberUndef(v.rotation)) { return false; }
    if (!this.checkVec2Undef(v.scale)) { return false; }

    if (v.scale !== undefined) {
      if (Math.abs(v.scale[0]) < 1e-5 || Math.abs(v.scale[1]) < 1e-5) {
        // check scale range
        return false;
      }
    }

    return true;
  }

  /**
   * 检查纹理变换参数或未定义
   * @param v - 纹理变换参数或未定义
   * @returns
   */
  static checkTexTransformUndef (v?: ModelTextureTransform): boolean {
    return v === undefined ? true : this.checkTexTransform(v);
  }

  /**
   * 检查材质混合参数或未定义
   * @param v - 材质混合参数或未定义
   * @returns
   */
  static checkMatBlending (v?: spec.MaterialBlending): boolean {
    return v === undefined
      || v === spec.MaterialBlending.opaque
      || v === spec.MaterialBlending.masked
      || v === spec.MaterialBlending.translucent
      || v === spec.MaterialBlending.additive;
  }

  /**
   * 检查材质单双面模式或未定义
   * @param v - 材质单双面模式或未定义
   * @returns
   */
  static checkMatSide (v?: spec.SideMode): boolean {
    return v === undefined || v === spec.SideMode.BACK || v === spec.SideMode.DOUBLE || v === spec.SideMode.FRONT;
  }

  /**
   * 检查动画路径模式
   * @param v - 动画路径模式
   * @returns
   */
  static checkAnimPath (v: string): boolean {
    return v === 'translation' || v === 'rotation' || v === 'scale' || v === 'weights';
  }

  /**
   * 检查动画插值模式
   * @param v - 动画插值模式
   * @returns
   */
  static checkAnimInterp (v: string): boolean {
    return v === 'LINEAR' || v === 'STEP' || v === 'CUBICSPLINE';
  }

  /**
   * 检查几何体
   * @param v - 几何体
   * @param s - 蒙皮参数
   */
  static assertGeometry (v: Geometry, s?: ModelSkinOptions) {
    if (!(v instanceof Geometry)) {
      console.error(`Invalid geometry type ${this.stringify(v)}`);
    }
    // @ts-expect-error
    if (v.isDestroyed === true) {
      console.error('Geometry object is destroyed');
    }
    if (!this.checkNonnegative(v.getDrawStart())) {
      console.error(`Invalid geometry draw start: ${v.getDrawStart()}, ${this.stringify(v)}`);
    }
    // // drawCount不再为负
    // if (!this.checkPositive(v.getDrawCount())) {
    //   throw new Error(`Invalid geometry draw count: ${v.getDrawCount()}, ${this.stringify(v)}`);
    // }

    // Geometry具体内容检查，先忽略
    // const opts = v.options;
    // const drawCount = Math.abs(v.getDrawCount());

    // if (opts !== undefined && drawCount > 0) {
    //   let maxLength = v.drawStart + drawCount;

    //   if (opts.index !== undefined) {
    //     const indexArray = opts.index.data;

    //     if (indexArray.length < maxLength) {
    //       throw new Error(`Index length(${indexArray.length}) is less than draw count(${maxLength}), ${this.stringify(v)}`);
    //     }
    //     let maxIndex = 0;

    //     for (let i = 0; i < drawCount; i++) {
    //       maxIndex = Math.max(indexArray[v.drawStart + i], maxIndex);
    //     }
    //     maxLength = maxIndex + 1;
    //   }
    //   const positionAttrib = opts.attributes['aPos'] as Attribute;

    //   if (positionAttrib === undefined) {
    //     throw new Error(`Position attribute is required, ${this.stringify(v)}`);
    //   }
    //   this.assertGeometryBuffer(v, 'aPos', maxLength);
    //   this.assertGeometryBuffer(v, 'aNormal', maxLength);
    //   this.assertGeometryBuffer(v, 'aTangent', maxLength);
    //   this.assertGeometryBuffer(v, 'aUV', maxLength);
    //   this.assertGeometryBuffer(v, 'aJoints', maxLength);
    //   this.assertGeometryBuffer(v, 'aWeights', maxLength);

    //   // 索引检查
    //   if(s !== undefined){
    //     const matLen = s.inverseBindMatrices?.length ?? 0;
    //     if(matLen > 0){
    //       const jointArray = this.createAttributeArray(v, "aJoints");
    //       if(jointArray !== undefined){
    //         for(let i = 0; i < maxLength; i++){
    //           const data = jointArray.getData(i);
    //           if(data === undefined) continue;
    //           if(Math.max(...data) >= matLen){
    //             throw new Error(`Joint index out of range: ${this.stringify(data)}, matrices: ${matLen}`);
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
  }

  /**
   * 检查几何体缓冲区
   * @param v - 几何体
   * @param name - 名称
   * @param drawCount - 渲染数目
   */
  static assertGeometryBuffer (v: Geometry, name: string, drawCount: number) {
    const attribArray = this.createAttributeArray(v, name);

    if (attribArray !== undefined) {
      if (attribArray.getLength() < drawCount) {
        console.error(`${name} Length(${attribArray.getLength()}) is less than draw count(${drawCount}), ${this.stringify(v)}`);
      }
    }
  }

  /**
   * 创建属性数组
   * @param v - 几何体
   * @param name - 名称
   * @returns
   */
  static createAttributeArray (v: Geometry, name: string): AttributeArray | undefined {
    // @ts-expect-error
    const attributes = v.attributes;

    if (attributes === undefined) { return; }
    const dataAttrib = attributes[name];

    if (dataAttrib === undefined) { return; }
    const dataArray = v.getAttributeData(name);

    if (dataArray === undefined) { return; }
    //
    const attribArray = new AttributeArray();

    attribArray.create(dataAttrib as Attribute, dataArray);

    return attribArray;
  }

  /**
   * 检查蒙皮参数
   * @param v - 蒙皮参数
   */
  static assertModelSkinOptions (v: ModelSkinOptions) {
    if (!this.checkStringUndef(v.name)) { console.error(`Invalid skin name ${v.name}, ${this.stringify(v)}`); }
    if (!this.checkNumberArray(v.joints)) { console.error(`Invalid skin joints ${v.joints}, ${this.stringify(v)}`); }
    if (!this.checkNumberUndef(v.skeleton)) { console.error(`Invalid skin skeleton ${v.skeleton}, ${this.stringify(v)}`); }
    if (!this.checkFloat32ArrayUndef(v.inverseBindMatrices)) { console.error(`Invalid skin inverseBindMatrices ${v.inverseBindMatrices}, ${this.stringify(v)}`); }
    //
    if (v.inverseBindMatrices !== undefined) {
      if (v.inverseBindMatrices.length <= 0 || v.inverseBindMatrices.length % 16 !== 0) { console.error(`Invalid skin inverseBindMatrices length ${v.inverseBindMatrices}, ${this.stringify(v)}`); }
      if (v.joints.length * 16 !== v.inverseBindMatrices.length) { console.error(`Mismatch: skin joints and inverseBindMatrices length, ${v.joints}, ${v.inverseBindMatrices}, ${this.stringify(v)}`); }
      const mat = new Matrix4();

      for (let i = 0; i < v.inverseBindMatrices.length; i += 16) {
        for (let j = 0; j < 16; j++) {
          mat.elements[j] = v.inverseBindMatrices[i + j];
        }
        if (Math.abs(mat.determinant()) < 1e-5) {
          console.error(`Determinant of inverseBindMatrices is too small ${mat.determinant()}, index ${i / 16}, ${this.stringify(v)}`);
        }
      }
    } else {
      if (v.joints.length <= 0) { console.error(`Invalid skin joints length ${v.joints}, ${this.stringify(v)}`); }
    }
  }

  /**
   * 检查材质参数
   * @param v - 材质参数
   */
  static assertMatOptions (v: ModelMaterialOptions) {
    if (v.type === spec.MaterialType.unlit) {
      if (!this.checkString(v.name)) { console.error(`Invalid material name ${v.name}, ${this.stringify(v)}`); }
      //
      if (!this.checkNonnegative4(v.baseColorFactor)) { console.error(`Invalid material baseColorFactor ${v.baseColorFactor}, ${this.stringify(v)}`); }
      if (!this.checkTextureUndef(v.baseColorTexture)) { console.error(`Invalid material baseColorTexture ${v.baseColorTexture}, ${this.stringify(v)}`); }
      if (!this.checkTexTransformUndef(v.baseColorTextureTransform)) { console.error(`Invalid material baseColorTextureTransform ${v.baseColorTextureTransform}, ${this.stringify(v)}`); }
      if (!this.checkTexCoord(v.baseColorTextureCoordinate)) { console.error(`Invalid material baseColorTextureCoordinate ${v.baseColorTextureCoordinate}, ${this.stringify(v)}`); }
      //
      if (!this.checkBooleanUndef(v.depthMask)) { console.error(`Invalid material depthMask ${v.depthMask}, ${this.stringify(v)}`); }
      if (!this.checkMatBlending(v.blending)) { console.error(`Invalid material blending ${v.blending}, ${this.stringify(v)}`); }
      if (!this.checkMatSide(v.side)) { console.error(`Invalid material side ${v.side}, ${this.stringify(v)}`); }
      if (v.blending === spec.MaterialBlending.masked) {
        if (v.alphaCutOff === undefined) { console.error(`Material alphaCutOff is required for mask, ${this.stringify(v)}`); }
      }
      if (!this.checkNumber01Undef(v.alphaCutOff)) { console.error(`Invalid material alphaCutOff ${v.alphaCutOff}, ${this.stringify(v)}`); }
    } else if (v.type === spec.MaterialType.pbr) {
      if (!this.checkString(v.name)) { console.error(`Invalid material name ${v.name}, ${this.stringify(v)}`); }
      //
      if (!this.checkNonnegative4(v.baseColorFactor)) { console.error(`Invalid material baseColorFactor ${v.baseColorFactor}, ${this.stringify(v)}`); }
      if (!this.checkTextureUndef(v.baseColorTexture)) { console.error(`Invalid material baseColorTexture ${v.baseColorTexture}, ${this.stringify(v)}`); }
      if (!this.checkTexTransformUndef(v.baseColorTextureTransform)) { console.error(`Invalid material baseColorTextureTransform ${v.baseColorTextureTransform}, ${this.stringify(v)}`); }
      if (!this.checkTexCoord(v.baseColorTextureCoordinate)) { console.error(`Invalid material baseColorTextureCoordinate ${v.baseColorTextureCoordinate}, ${this.stringify(v)}`); }
      //
      if (!this.checkBooleanUndef(v.useSpecularAA)) { console.error(`Invalid material useSpecularAA ${v.useSpecularAA}, ${this.stringify(v)}`); }
      if (!this.checkNumber01(v.metallicFactor)) { console.error(`Invalid material metallicFactor ${v.metallicFactor}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.roughnessFactor)) { console.error(`Invalid material roughnessFactor ${v.roughnessFactor}, ${this.stringify(v)}`); }
      if (!this.checkTextureUndef(v.metallicRoughnessTexture)) { console.error(`Invalid material metallicRoughnessTexture ${v.metallicRoughnessTexture}, ${this.stringify(v)}`); }
      if (!this.checkTexTransformUndef(v.metallicRoughnessTextureTransform)) { console.error(`Invalid material metallicRoughnessTextureTransform ${v.metallicRoughnessTextureTransform}, ${this.stringify(v)}`); }
      if (!this.checkTexCoord(v.metallicRoughnessTextureCoordinate)) { console.error(`Invalid material metallicRoughnessTextureCoordinate ${v.metallicRoughnessTextureCoordinate}, ${this.stringify(v)}`); }
      //
      if (!this.checkTextureUndef(v.normalTexture)) { console.error(`Invalid material normalTexture ${v.normalTexture}, ${this.stringify(v)}`); }
      if (!this.checkNonnegativeUndef(v.normalTextureScale)) { console.error(`Invalid material normalTextureScale ${v.normalTextureScale}, ${this.stringify(v)}`); }
      if (!this.checkTexTransformUndef(v.normalTextureTransform)) { console.error(`Invalid material normalTextureTransform ${v.normalTextureTransform}, ${this.stringify(v)}`); }
      if (!this.checkTexCoord(v.normalTextureCoordinate)) { console.error(`Invalid material normalTextureCoordinate ${v.normalTextureCoordinate}, ${this.stringify(v)}`); }
      //
      if (!this.checkTextureUndef(v.occlusionTexture)) { console.error(`Invalid material occlusionTexture ${v.occlusionTexture}, ${this.stringify(v)}`); }
      if (!this.checkNumber01Undef(v.occlusionTextureStrength)) { console.error(`Invalid material occlusionTextureStrength ${v.occlusionTextureStrength}, ${this.stringify(v)}`); }
      if (!this.checkTexTransformUndef(v.occlusionTextureTransform)) { console.error(`Invalid material occlusionTextureTransform ${v.occlusionTextureTransform}, ${this.stringify(v)}`); }
      if (!this.checkTexCoord(v.occlusionTextureCoordinate)) { console.error(`Invalid material occlusionTextureCoordinate ${v.occlusionTextureCoordinate}, ${this.stringify(v)}`); }
      //
      //
      if (!this.checkNonnegative4(v.emissiveFactor)) { console.error(`Invalid material emissiveFactor ${v.emissiveFactor}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.emissiveIntensity)) { console.error(`Invalid material emissiveIntensity ${v.emissiveIntensity}, ${this.stringify(v)}`); }
      if (!this.checkTextureUndef(v.emissiveTexture)) { console.error(`Invalid material emissiveTexture ${v.emissiveTexture}, ${this.stringify(v)}`); }
      if (!this.checkTexTransformUndef(v.emissiveTextureTransform)) { console.error(`Invalid material emissiveTextureTransform ${v.emissiveTextureTransform}, ${this.stringify(v)}`); }
      if (!this.checkTexCoord(v.emissiveTextureCoordinate)) { console.error(`Invalid material emissiveTextureCoordinate ${v.emissiveTextureCoordinate}, ${this.stringify(v)}`); }
      //
      if (!this.checkBooleanUndef(v.depthMask)) { console.error(`Invalid material depthMask ${v.depthMask}, ${this.stringify(v)}`); }
      if (!this.checkMatBlending(v.blending)) { console.error(`Invalid material blending ${v.blending}, ${this.stringify(v)}`); }
      if (!this.checkMatSide(v.side)) { console.error(`Invalid material side ${v.side}, ${this.stringify(v)}`); }
      if (v.blending === spec.MaterialBlending.masked) {
        if (v.alphaCutOff === undefined) { console.error(`Material alphaCutOff is required for mask, ${this.stringify(v)}`); }
      }
      if (!this.checkNumber01Undef(v.alphaCutOff)) { console.error(`Invalid material alphaCutOff ${v.alphaCutOff}, ${this.stringify(v)}`); }
    } else {
      console.error(`Invalid material type ${this.stringify(v)}`);
    }
  }

  /**
   * 检查 Primitive 参数
   * @param v - Primitive 参数
   * @param s - 蒙皮参数
   * @returns
   */
  static assertPrimOptions (v: ModelPrimitiveOptions, s?: ModelSkinOptions) {
    this.assertGeometry(v.geometry, s);
    this.assertMatOptions(v.material);

    return true;
  }

  /**
   * 检查 Model 插件 Mesh 参数
   * @param v - Model 插件 Mesh 参数
   */
  static assertModelMeshOptions (v: ModelMeshOptions) {
    if (!this.checkParent(v.parent)) { console.error(`Invalid mesh parent ${v.parent}, ${this.stringify(v)}`); }

    if (v.skin !== undefined) { this.assertModelSkinOptions(v.skin); }

    const morphList: PMorph[] = [];

    for (let i = 0; i < v.primitives.length; i++) {
      const prim = v.primitives[i];

      if (!this.assertPrimOptions(prim)) {
        console.error(`Invalid primitive ${prim}, ${this.stringify(v)}`);
      }
      const morph = new PMorph();

      morph.create(prim.geometry);
      morphList.push(morph);
    }

    for (let i = 1; i < morphList.length; i++) {
      const morph0 = morphList[i - 1];
      const morph1 = morphList[i];

      if (!morph0.equals(morph1)) {
        console.error(`Morph states mismatch: ${this.stringify(morph0)}, ${this.stringify(morph1)}, ${this.stringify(v)}`);
      }
    }

    if (!this.checkBooleanUndef(v.hide)) { console.error(`Invalid mesh hide ${v.hide}, ${this.stringify(v)}`); }
  }

  /**
   * 检查 Model 插件相机参数
   * @param v - Model 插件相机参数
   */
  static assertModelCameraOptions (v: ModelCameraOptions) {
    if (!this.checkParent(v.parent)) { console.error(`Invalid camera parent ${v.parent}, ${this.stringify(v)}`); }
    if (!this.checkNumberUndef(v.aspect)) { console.error(`Invalid camera aspect ${v.aspect}, ${this.stringify(v)}`); }
    if (!this.checkPositive(v.near)) { console.error(`Invalid camera near ${v.near}, ${this.stringify(v)}`); }
    if (!this.checkPositive(v.far) || v.far <= v.near) { console.error(`Invalid camera far ${v.far}, ${this.stringify(v)}`); }
    if (!this.checkPositive(v.fov)) { console.error(`Invalid camera fov ${v.fov}, ${this.stringify(v)}`); }
    if (!this.checkNumber01(v.clipMode)) { console.error(`Invalid camera clipMode ${v.clipMode}, ${this.stringify(v)}`); }
  }

  /**
   * 检查 Model 插件灯光参数
   * @param v - Model 插件灯光参数
   */
  static assertModelLightOptions (v: ModelLightOptions) {
    if (v.lightType === 'directional') {
      if (!this.checkParent(v.parent)) { console.error(`Invalid light parent ${v.parent}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative4(v.color)) { console.error(`Invalid light color ${v.color}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.intensity)) { console.error(`Invalid light intensity ${v.intensity}, ${this.stringify(v)}`); }
    } else if (v.lightType === 'point') {
      if (!this.checkParent(v.parent)) { console.error(`Invalid light parent ${v.parent}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative4(v.color)) { console.error(`Invalid light color ${v.color}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.intensity)) { console.error(`Invalid light intensity ${v.intensity}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.range)) { console.error(`Invalid light range ${v.range}, ${this.stringify(v)}`); }
    } else if (v.lightType === 'spot') {
      if (!this.checkParent(v.parent)) { console.error(`Invalid light parent ${v.parent}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative4(v.color)) { console.error(`Invalid light color ${v.color}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.intensity)) { console.error(`Invalid light intensity ${v.intensity}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.range)) { console.error(`Invalid light range ${v.range}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.innerConeAngle)) { console.error(`Invalid light innerConeAngle ${v.innerConeAngle}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.outerConeAngle)) { console.error(`Invalid light outerConeAngle ${v.outerConeAngle}, ${this.stringify(v)}`); }
    } else if (v.lightType === 'ambient') {
      if (!this.checkParent(v.parent)) { console.error(`Invalid light parent ${v.parent}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative4(v.color)) { console.error(`Invalid light color ${v.color}, ${this.stringify(v)}`); }
      if (!this.checkNonnegative(v.intensity)) { console.error(`Invalid light intensity ${v.intensity}, ${this.stringify(v)}`); }
    } else {
      console.error(`Invalid light type ${this.stringify(v)}`);
    }
  }

  /**
   * 检查 Model 插件天空盒参数
   * @param v - Model 插件天空盒参数
   */
  static assertModelSkyboxOptions (v: ModelSkyboxOptions) {
    if (!this.checkBoolean(v.renderable)) { console.error(`Invalid skybox renderable ${v.renderable}, ${this.stringify(v)}`); }
    if (!this.checkNonnegative(v.intensity)) { console.error(`Invalid skybox intensity ${v.intensity}, ${this.stringify(v)}`); }
    if (!this.checkNonnegative(v.reflectionsIntensity)) { console.error(`Invalid skybox reflectionsIntensity ${v.reflectionsIntensity}, ${this.stringify(v)}`); }
    //
    const c = v.irradianceCoeffs;

    if (c !== undefined) {
      if (!Array.isArray(c) || c.length != 9) { console.error(`Invalid skybox irradianceCoeffs ${c}, ${this.stringify(v)}`); }
      c.forEach(v => {
        if (!this.checkVec3(v as spec.vec3)) { console.error(`Invalid skybox irradianceCoeffs ${c}, ${this.stringify(v)}`); }
      });
    } else if (v.diffuseImage !== undefined) {
      if (!this.checkTexture(v.diffuseImage)) { console.error(`Invalid skybox diffuseImage ${v.diffuseImage}, ${this.stringify(v)}`); }
    } else {
      console.error(`Invalid skybox, irradianceCoeffs or diffuseImage should give one, ${this.stringify(v)}`);
    }
    if (!this.checkTexture(v.specularImage)) { console.error(`Invalid skybox specularImage ${v.specularImage}, ${this.stringify(v)}`); }
    if (!this.checkPositive(v.specularImageSize)) { console.error(`Invalid skybox specularImageSize ${v.specularImageSize}, ${this.stringify(v)}`); }
    if (!this.checkPositive(v.specularMipCount)) { console.error(`Invalid skybox specularMipCount ${v.specularMipCount}, ${this.stringify(v)}`); }
    if (this.pow2(v.specularMipCount) > v.specularImageSize) {
      console.error(`Invalid skybox specularMipCount or specularImageSize, ${this.stringify(v)}`);
    }
  }

  /**
   * 检查 Model 插件动画轨道参数
   * @param v - Model 插件动画轨道参数
   * @returns
   */
  static checkModelAnimTrackOptions (v: ModelAnimTrackOptions) {
    if (!this.checkNonnegative(v.node)) {
      console.error(`Invalid track node ${v.node}, ${this.stringify(v)}`);

      return false;
    }
    if (!this.checkFloat32Array(v.input)) {
      console.error(`Invalid track input ${v.input}, ${this.stringify(v)}`);

      return false;
    }
    if (!this.checkFloat32Array(v.output)) {
      console.error(`Invalid track input ${v.output}, ${this.stringify(v)}`);

      return false;
    }
    if (!this.checkAnimPath(v.path)) {
      console.error(`Invalid track path ${v.path}, ${this.stringify(v)}`);

      return false;
    }
    if (!this.checkAnimInterp(v.interpolation)) {
      console.error(`Invalid track interpolation ${v.interpolation}, ${this.stringify(v)}`);

      return false;
    }

    return true;
  }

  /**
   * 检查 Model 插件动画参数
   * @param v - Model 插件动画参数
   */
  static assertModelAnimOptions (v: ModelAnimationOptions) {
    if (!this.checkStringUndef(v.name)) { console.error(`Invalid animation name ${v.name}, ${this.stringify(v)}`); }
    if (!Array.isArray(v.tracks)) { console.error(`Invalid animation tracks ${v.tracks}, ${this.stringify(v)}`); }
    v.tracks.forEach(t => {
      if (!this.checkModelAnimTrackOptions(t)) { console.error(`Invalid animation track ${t}, ${this.stringify(v)}`); }
    });
  }

  /**
   * 检查场景树参数
   * @param v - 场景树参数
   */
  static assertTreeOptions (v: ModelTreeOptions) {
    if (!this.checkNumberUndef(v.animation)) { console.error(`Invalid tree animation ${v.animation}, ${this.stringify(v)}`); }
    if (v.animations !== undefined) {
      if (!Array.isArray(v.animations)) { console.error(`Invalid tree animations ${v.animations}, ${this.stringify(v)}`); }
      v.animations.forEach(anim => { this.assertModelAnimOptions(anim); });
      if (v.animation !== undefined) {
        if (v.animation < -1 || v.animation >= v.animations.length) { console.error(`Invalid tree animations ${v.animations}, ${this.stringify(v)}`); }
      }
    }
  }

  /**
   * 将对象转成 JSON 字符串，需要忽略函数和渲染相关的对象
   * @param object - 目标对象
   * @returns
   */
  static stringify (object: any) {
    const simpleObject: { [k: string]: any } = {};

    for (const prop in object) {
      // if (typeof(object[prop]) == 'object'){
      //     continue;
      // }
      if (prop === 'internal') {
        // 与WebGL相关的数据，可以忽略
        continue;
      }
      if (typeof (object[prop]) == 'function') {
        continue;
      }
      if (object[prop] instanceof Texture) {
        simpleObject[prop] = object[prop].name;
        continue;
      }
      if (object[prop] instanceof Geometry) {
        simpleObject[prop] = object[prop].name;
        continue;
      }
      if (object[prop] instanceof Renderer) {
        continue;
      }
      simpleObject[prop] = object[prop];
    }

    return JSON.stringify(simpleObject);
  }

  /**
   * 获取 2 的 index 指数结果
   * @param index - 指数
   * @returns
   */
  static pow2 (index: number): number {
    let res = 1;

    while (index-- > 0) { res *= 2; }

    return res;
  }
}

/**
 * 半精度浮点数组类
 */
export class Float16ArrayWrapper {
  /**
   * 大小
   */
  size: number;
  /**
   * 数组
   */
  data: Uint16Array;

  constructor (size: number) {
    this.size = size;
    this.data = new Uint16Array(size);
  }

  /**
   * 将类数值数组转成半进度浮点，并从起始索引开始添加
   * @param number - 类数值数组
   * @param startIndex - 起始索引
   */
  set (number: ArrayLike<number>, startIndex: number) {
    for (let i = 0; i < number.length; i++) {
      this.data[i + startIndex] = toHalf(number[i]);
    }
  }

  /**
   * 获取数组字节数
   */
  get bytes () {
    return this.size * 2;
  }
}

const toHalf = (function () {

  const floatView = new Float32Array(1);
  const int32View = new Int32Array(floatView.buffer);

  /* This method is faster than the OpenEXR implementation (very often
   * used, eg. in Ogre), with the additional benefit of rounding, inspired
   * by James Tursa?s half-precision code. */
  return function toHalf (val: any) {

    floatView[0] = val;
    const x = int32View[0];

    let bits = (x >> 16) & 0x8000; /* Get the sign */
    let m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
    const e = (x >> 23) & 0xff; /* Using int is faster here */

    /* If zero, or denormal, or exponent underflows too much for a denormal
     * half, return signed zero. */
    if (e < 103) {
      return bits;
    }

    /* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
    if (e > 142) {
      bits |= 0x7c00;
      /* If exponent was 0xff and one mantissa bit was set, it means NaN,
       * not Inf, so make sure we set one mantissa bit too. */
      bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);

      return bits;
    }

    /* If exponent underflows but not too much, return a denormal */
    if (e < 113) {
      m |= 0x0800;
      /* Extra rounding may overflow and set mantissa to 0 and exponent
       * to 1, which is OK. */
      bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);

      return bits;
    }

    bits |= ((e - 112) << 10) | (m >> 1);
    /* Extra rounding. An overflow will set mantissa to 0 and increment
     * the exponent, which is OK. */
    bits += m & 1;

    return bits;
  };

}());

