import type { Material, Texture } from '@galacean/effects';
import { spec, glContext } from '@galacean/effects';
import type {
  ModelMaterialOptions,
  ModelMaterialUnlitOptions,
  ModelMaterialPBROptions,
} from '../index';
import { Vector3, Vector4, Matrix3 } from './math';
import {
  PObjectType,
  PMaterialType,
  PBlendMode,
  PFaceSideMode,
  PGlobalState,
} from './common';
import { PObject } from './object';
import { PluginHelper } from '../utility/plugin-helper';
import { PShaderManager } from './shader';

/**
 * 3D 材质基础类，支持公共的材质功能
 */
export abstract class PMaterialBase extends PObject {
  /**
   * 材质类型，主要是 pbr 和 unlit 两类
   */
  materialType: PMaterialType = PMaterialType.none;
  /**
   * 顶点着色器代码
   */
  vertexShaderCode = '';
  /**
   * 片段着色器代码
   */
  fragmentShaderCode = '';
  /**
   * 深度是否写入，默认是写入
   */
  depthMask = true;
  /**
   * 是否深度测试提示，默认开启
   */
  depthTestHint = true;
  /**
   * 混合模式，默认是不透明
   */
  blendMode: PBlendMode = PBlendMode.opaque;
  /**
   * Alpha 测试截断值
   */
  alphaCutOff = 0.5;
  /**
   * 面侧模式，默认是正面
   */
  faceSideMode: PFaceSideMode = PFaceSideMode.front;

  /**
   * 获取着色器特性列表，根据材质状态
   * @returns 特性列表
   */
  getShaderFeatures (): string[] {
    const featureList: string[] = [];

    if (this.isOpaque()) {
      featureList.push('ALPHAMODE_OPAQUE 1');
    } else if (this.isMasked()) {
      featureList.push('ALPHAMODE_MASK 1');
    }

    if (this.faceSideMode === PFaceSideMode.both) {
      featureList.push('DOUBLE_SIDED 1');
    }

    return featureList;
  }

  /**
   * 根据材质状态，更新 GE 材质状态
   * @param material - GE 材质
   */
  updateUniforms (material: Material) {
    if (this.isMasked()) {
      material.setFloat('u_AlphaCutoff', this.alphaCutOff);
    }

    // 渲染 UV 结果输出时，设置 uv 大小
    const renderMode = PGlobalState.getInstance().renderMode3D;

    if (renderMode === spec.RenderMode3D.uv) {
      const debugUVGridSize = PGlobalState.getInstance().renderMode3DUVGridSize;

      material.setFloat('u_DebugUVGridSize', debugUVGridSize);
    }
  }

  /**
   * 生成顶点和片段着色器代码
   * 先获取着色器特性，再根据材质和全局状态，生成着色器代码
   * @param inFeatureList - 外部特性列表
   */
  build (inFeatureList?: string[]) {
    const finalFeatureList = this.getShaderFeatures();

    if (inFeatureList !== undefined) {
      finalFeatureList.push(...inFeatureList);
    }
    const isWebGL2 = PGlobalState.getInstance().isWebGL2;

    if (isWebGL2) {
      finalFeatureList.push('WEBGL2');
    }

    // 目前只有 PRB 和 Unlit 是需要 EDITOR_TRANSFORM，适配编辑器的视口 Offset
    // 阴影 Pass 的渲染是不需要，所以这里特殊处理下
    if (this.materialType !== PMaterialType.shadowBase) {
      const isEditorEvn = PGlobalState.getInstance().isEditorEnv;

      if (isEditorEvn) {
        finalFeatureList.push('EDITOR_TRANSFORM');
      }
    }
    //
    const shaderManager = PShaderManager.getInstance();
    const shaderResult = shaderManager.genShaderCode({
      material: this,
      isWebGL2,
      featureList: finalFeatureList,
    });

    this.vertexShaderCode = shaderResult.vertexShaderCode;
    this.fragmentShaderCode = shaderResult.fragmentShaderCode;
  }

  /**
   * 获取混合模式，根据 GE 混合模式
   * @param mode - GE 混合模式
   * @returns
   */
  getBlendMode (mode?: spec.MaterialBlending): PBlendMode {
    if (mode === spec.MaterialBlending.masked) {
      return PBlendMode.masked;
    } else if (mode === spec.MaterialBlending.translucent) {
      return PBlendMode.translucent;
    } else if (mode === spec.MaterialBlending.additive) {
      return PBlendMode.additive;
    } else {
      return PBlendMode.opaque;
    }
  }

  /**
   * 获取面侧模式，根据 GE 面侧模式
   * @param mode - GE 面侧模式
   * @returns
   */
  getFaceSideMode (mode?: spec.SideMode): PFaceSideMode {
    if (mode === spec.SideMode.DOUBLE) {
      return PFaceSideMode.both;
    } else if (mode === spec.SideMode.BACK) {
      return PFaceSideMode.back;
    } else {
      return PFaceSideMode.front;
    }
  }

  /**
   * 设置材质状态，根据 GE 材质状态
   * @param material - GE 材质
   */
  setMaterialStates (material: Material) {
    if (this.blendMode === PBlendMode.translucent || this.blendMode === PBlendMode.additive) {
      material.blending = true;
      material.depthTest = true;
      material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
      if (this.blendMode === PBlendMode.translucent) {
        material.blendFunction = [
          glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
          glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
        ];
      } else {
        material.blendFunction = [
          glContext.ONE, glContext.ONE,
          glContext.ONE, glContext.ONE,
        ];
      }
      material.depthMask = this.depthMask;
    } else {
      if (PGlobalState.getInstance().isTiny3dMode) {
        material.blending = false;
        material.depthTest = true;
        // Tiny兼容模式下不透明的深度写入始终开
        material.depthMask = true;
      } else {
        material.blending = false;
        material.depthTest = this.depthTestHint;
        material.depthMask = this.depthMask;
      }
    }

    this.setFaceSideStates(material);
  }

  protected setFaceSideStates (material: Material) {
    if (this.isBothFace()) {
      material.culling = false;
    } else if (this.isBackFace()) {
      material.cullFace = glContext.FRONT;
      material.frontFace = glContext.CCW;
      material.culling = true;
    } else {
      material.cullFace = glContext.BACK;
      material.frontFace = glContext.CCW;
      material.culling = true;
    }
  }

  /**
   * 销毁材质，清除着色器代码
   */
  override dispose () {
    this.vertexShaderCode = '';
    this.fragmentShaderCode = '';
  }

  /**
   * 是否合法，材质类型非 none
   * @returns
   */
  override isValid (): boolean {
    return this.materialType !== PMaterialType.none && super.isValid();
  }

  /**
   * 是否不透明
   * @returns
   */
  isOpaque (): boolean {
    return this.blendMode === PBlendMode.opaque;
  }

  /**
   * 是否遮罩
   * @returns
   */
  isMasked (): boolean {
    return this.blendMode === PBlendMode.masked;
  }

  /**
   * 是否半透明
   * @returns
   */
  isTranslucent (): boolean {
    return this.blendMode === PBlendMode.translucent;
  }

  /**
   * 是否加法混合
   * @returns
   */
  isAdditive (): boolean {
    return this.blendMode === PBlendMode.additive;
  }

  /**
   * 是否需要混合
   * @returns
   */
  requireBlend (): boolean {
    return this.blendMode === PBlendMode.translucent || this.blendMode === PBlendMode.additive;
  }

  /**
   * 是否正面模式
   * @returns
   */
  isFrontFace (): boolean {
    return this.faceSideMode === PFaceSideMode.front;
  }

  /**
   * 是否背面模式
   * @returns
   */
  isBackFace (): boolean {
    return this.faceSideMode === PFaceSideMode.back;
  }

  /**
   * 是否双面模式
   * @returns
   */
  isBothFace (): boolean {
    return this.faceSideMode === PFaceSideMode.both;
  }
}

/**
 * 无光照材质类，负责无关照或者不接受光照情况下的物体材质效果
 */
export class PMaterialUnlit extends PMaterialBase {
  private baseColorFactor: Vector4 = new Vector4(1, 1, 1, 1);
  private baseColorTexture?: Texture;

  /**
   * 创建无光照材质，支持基础颜色纹理
   * @param options - 无光照材质参数
   */
  create (options: ModelMaterialUnlitOptions) {
    this.name = options.name;
    this.type = PObjectType.material;
    this.materialType = PMaterialType.unlit;
    //
    if (options.baseColorTexture) {
      this.baseColorTexture = options.baseColorTexture;
    }
    this.setBaseColorFactor(PluginHelper.toPluginColor4(options.baseColorFactor));
    /**
     * 默认需要写入深度值，只有传入false才是false
     */
    if (options.depthMask === false) {
      this.depthMask = false;
    } else {
      this.depthMask = true;
    }
    this.blendMode = this.getBlendMode(options.blending);
    this.alphaCutOff = options.alphaCutOff ?? 0;
    this.faceSideMode = this.getFaceSideMode(options.side);
  }

  /**
   * 销毁材质
   */
  override dispose () {
    super.dispose();
    this.baseColorTexture = undefined;
  }

  /**
   * 获取着色器特性列表，根据材质状态
   * @returns 着色器特性列表
   */
  override getShaderFeatures (): string[] {
    const featureList = super.getShaderFeatures();

    featureList.push('MATERIAL_METALLICROUGHNESS 1');
    if (this.hasBaseColorTexture()) {
      featureList.push('HAS_BASE_COLOR_MAP 1');
    }

    featureList.push('MATERIAL_UNLIT 1');

    return featureList;
  }

  /**
   * 更新对应的 GE 材质中着色器的 Uniform 数据
   * @param material - GE 材质
   */
  override updateUniforms (material: Material) {
    super.updateUniforms(material);
    //
    const uvTransform = new Matrix3().identity();

    material.setVector4('u_BaseColorFactor', this.baseColorFactor);
    if (this.hasBaseColorTexture()) {
      material.setTexture('u_BaseColorSampler', this.getBaseColorTexture());
      material.setInt('u_BaseColorUVSet', 0);
      material.setMatrix3('u_BaseColorUVTransform', uvTransform);
    }
    material.setFloat('u_MetallicFactor', 0.0);
    material.setFloat('u_RoughnessFactor', 0.0);

    material.setFloat('u_Exposure', 1.0);
  }

  /**
   * 是否有基础颜色纹理
   * @returns
   */
  hasBaseColorTexture (): boolean {
    return this.baseColorTexture !== undefined;
  }

  /**
   * 获取基础颜色纹理
   * @returns
   */
  getBaseColorTexture (): Texture {
    return this.baseColorTexture as Texture;
  }

  /**
   * 设置基础颜色纹理
   * @param val - 纹理对象
   */
  setBaseColorTexture (val: Texture) {
    this.baseColorTexture = val;
  }

  /**
   * 获取基础颜色值
   * @returns
   */
  getBaseColorFactor (): Vector4 {
    return this.baseColorFactor;
  }

  /**
   * 设置基础颜色值
   * @param val - 颜色值
   */
  setBaseColorFactor (val: Vector4 | spec.vec4) {
    if (val instanceof Vector4) {
      this.baseColorFactor.set(val.x, val.y, val.z, val.w);
    } else {
      this.baseColorFactor.set(val[0], val[1], val[2], val[3]);
    }
  }

}

/**
 * PBR 材质类，负责基于物理的材质效果，也是渲染中最常用的材质。
 * 目前支持金属度/粗糙度工作流，与其他引擎中的 PBR 材质功能一致。
 */
export class PMaterialPBR extends PMaterialBase {
  /**
   * 基础颜色纹理
   */
  baseColorTexture?: Texture;
  /**
   * 基础颜色纹理变换
   */
  baseColorTextureTrans?: Matrix3;
  /**
   * 基础颜色值，默认是白色 Vector4(1, 1, 1, 1)
   */
  baseColorFactor: Vector4 = new Vector4(1, 1, 1, 1);
  /**
   * 金属度粗超度纹理
   */
  metallicRoughnessTexture?: Texture;
  /**
   * 金属度粗超度纹理变换
   */
  metallicRoughnessTextureTrans?: Matrix3;
  /**
   * 是否高光抗锯齿，能够明显提升高光表现效果
   */
  useSpecularAA = false;
  /**
   * 金属度值
   */
  metallicFactor = 0;
  /**
   * 粗超度值
   */
  roughnessFactor = 1;
  /**
   * 法线纹理
   */
  normalTexture?: Texture;
  /**
   * 法线纹理变换
   */
  normalTextureTrans?: Matrix3;
  /**
   * 法线纹理缩放
   */
  normalTextureScale = 1;
  /**
   * AO 纹理
   */
  occlusionTexture?: Texture;
  /**
   * AO 纹理变换
   */
  occlusionTextureTrans?: Matrix3;
  /**
   * AO 纹理强度
   */
  occlusionTextureStrength = 1;
  /**
   * 自发光纹理
   */
  emissiveTexture?: Texture;
  /**
   * 自发光纹理变换
   */
  emissiveTextureTrans?: Matrix3;
  /**
   * 自发光颜色值，默认是黑色 Vector3(0, 0, 0)
   */
  emissiveFactor: Vector3 = new Vector3(0, 0, 0);
  /**
   * 自发光强度
   */
  emissiveIntensity = 1;
  //
  enableShadow = false;

  /**
   * 创建材质
   * @param options - PBR 材质参数
   */
  create (options: ModelMaterialPBROptions) {
    this.name = options.name;
    this.type = PObjectType.material;
    this.materialType = PMaterialType.pbr;
    //
    if (options.baseColorTexture) { this.baseColorTexture = options.baseColorTexture; }
    if (options.baseColorTextureTransform) {
      this.baseColorTextureTrans = PluginHelper.createUVTransform(options.baseColorTextureTransform);
    }
    this.setBaseColorFactor(PluginHelper.toPluginColor4(options.baseColorFactor));

    if (options.metallicRoughnessTexture) { this.metallicRoughnessTexture = options.metallicRoughnessTexture; }
    if (options.metallicRoughnessTextureTransform) {
      this.metallicRoughnessTextureTrans = PluginHelper.createUVTransform(options.metallicRoughnessTextureTransform);
    }
    this.useSpecularAA = options.useSpecularAA ?? false;
    this.metallicFactor = options.metallicFactor;
    this.roughnessFactor = PluginHelper.clamp(options.roughnessFactor, 0, 1);

    if (options.normalTexture) { this.normalTexture = options.normalTexture; }
    if (options.normalTextureTransform) {
      this.normalTextureTrans = PluginHelper.createUVTransform(options.normalTextureTransform);
    }
    this.normalTextureScale = options.normalTextureScale ?? 1.0;

    if (options.occlusionTexture) { this.occlusionTexture = options.occlusionTexture; }
    if (options.occlusionTextureTransform) {
      this.occlusionTextureTrans = PluginHelper.createUVTransform(options.occlusionTextureTransform);
    }
    this.occlusionTextureStrength = options.occlusionTextureStrength ?? 1.0;

    if (options.emissiveTexture) { this.emissiveTexture = options.emissiveTexture; }
    if (options.emissiveTextureTransform) {
      this.emissiveTextureTrans = PluginHelper.createUVTransform(options.emissiveTextureTransform);
    }
    const emissiveFactor = PluginHelper.toPluginColor4(options.emissiveFactor);

    this.emissiveFactor = Vector3.fromArray(emissiveFactor);
    this.emissiveIntensity = options.emissiveIntensity;

    this.enableShadow = options.enableShadow ?? false;
    /**
     * 默认需要写入深度值，只有传入false才是false
     */
    if (options.depthMask === false) {
      this.depthMask = false;
    } else {
      this.depthMask = true;
    }
    this.blendMode = this.getBlendMode(options.blending);
    this.alphaCutOff = options.alphaCutOff ?? 0;
    this.faceSideMode = this.getFaceSideMode(options.side);
  }

  /**
   * 销毁材质
   */
  override dispose () {
    super.dispose();
    this.baseColorTexture = undefined;
    this.metallicRoughnessTexture = undefined;
    this.normalTexture = undefined;
    this.occlusionTexture = undefined;
    this.emissiveTexture = undefined;
  }

  /**
   * 获取材质特性列表
   * @returns 材质特性列表
   */
  override getShaderFeatures (): string[] {
    const featureList = super.getShaderFeatures();

    featureList.push('MATERIAL_METALLICROUGHNESS 1');
    if (this.hasBaseColorTexture()) {
      featureList.push('HAS_BASE_COLOR_MAP 1');
      if (this.baseColorTextureTrans !== undefined) {
        featureList.push('HAS_BASECOLOR_UV_TRANSFORM 1');
      }
    }
    if (this.hasMetallicRoughnessTexture()) {
      featureList.push('HAS_METALLIC_ROUGHNESS_MAP 1');
      if (this.metallicRoughnessTextureTrans !== undefined) {
        featureList.push('HAS_METALLICROUGHNESS_UV_TRANSFORM 1');
      }
    }
    if (this.useSpecularAA) {
      featureList.push('USE_SPECULAR_AA 1');
    }
    if (this.hasNormalTexture()) {
      featureList.push('HAS_NORMAL_MAP 1');
      if (this.normalTextureTrans !== undefined) {
        featureList.push('HAS_NORMAL_UV_TRANSFORM 1');
      }
    }
    if (this.hasOcclusionTexture()) {
      featureList.push('HAS_OCCLUSION_MAP 1');
      if (this.occlusionTextureTrans !== undefined) {
        featureList.push('HAS_OCCLUSION_UV_TRANSFORM 1');
      }
    }
    if (this.hasEmissiveTexture()) {
      featureList.push('HAS_EMISSIVE_MAP 1');
      if (this.emissiveTextureTrans !== undefined) {
        featureList.push('HAS_EMISSIVE_UV_TRANSFORM 1');
      }
    } else if (this.hasEmissiveFactor()) {
      featureList.push('HAS_EMISSIVE 1');
    }

    return featureList;
  }

  /**
   * 更新关联的 GE 材质中着色器的 Uniform 数据
   * @param material - GE 材质
   */
  override updateUniforms (material: Material) {
    super.updateUniforms(material);
    //
    const uvTransform = new Matrix3().identity();

    material.setVector4('u_BaseColorFactor', this.baseColorFactor);
    if (this.baseColorTexture !== undefined) {
      material.setTexture('u_BaseColorSampler', this.baseColorTexture);
      material.setInt('u_BaseColorUVSet', 0);
      if (this.baseColorTextureTrans !== undefined) {
        material.setMatrix3('u_BaseColorUVTransform', this.baseColorTextureTrans);
      } else {
        // fill other data
        material.setMatrix3('u_BaseColorUVTransform', uvTransform);
      }
    }
    //
    material.setFloat('u_MetallicFactor', this.metallicFactor);
    material.setFloat('u_RoughnessFactor', this.roughnessFactor);
    if (this.metallicRoughnessTexture !== undefined) {
      material.setTexture('u_MetallicRoughnessSampler', this.metallicRoughnessTexture);
      material.setInt('u_MetallicRoughnessUVSet', 0);
      if (this.metallicRoughnessTextureTrans !== undefined) {
        material.setMatrix3('u_MetallicRoughnessUVTransform', this.metallicRoughnessTextureTrans);
      } else {
        // fill other data
        material.setMatrix3('u_MetallicRoughnessUVTransform', uvTransform);
      }
    }
    //
    if (this.normalTexture !== undefined) {
      material.setTexture('u_NormalSampler', this.normalTexture);
      material.setFloat('u_NormalScale', this.normalTextureScale);
      material.setInt('u_NormalUVSet', 0);
      if (this.normalTextureTrans !== undefined) {
        material.setMatrix3('u_NormalUVTransform', this.normalTextureTrans);
      } else {
        // fill other data
        material.setMatrix3('u_NormalUVTransform', uvTransform);
      }
    }
    //
    if (this.occlusionTexture !== undefined) {
      material.setTexture('u_OcclusionSampler', this.occlusionTexture);
      material.setFloat('u_OcclusionStrength', this.occlusionTextureStrength);
      material.setInt('u_OcclusionUVSet', 0);
      if (this.occlusionTextureTrans !== undefined) {
        material.setMatrix3('u_OcclusionUVTransform', this.occlusionTextureTrans);
      } else {
        // fill other data
        material.setMatrix3('u_OcclusionUVTransform', uvTransform);
      }
    }
    //
    if (this.emissiveTexture !== undefined) {
      const emissiveFactor = this.getEmissiveFactor();

      material.setTexture('u_EmissiveSampler', this.emissiveTexture);
      material.setVector3('u_EmissiveFactor', emissiveFactor);
      material.setInt('u_EmissiveUVSet', 0);
      if (this.emissiveTextureTrans !== undefined) {
        material.setMatrix3('u_EmissiveUVTransform', this.emissiveTextureTrans);
      } else {
        // fill other data
        material.setMatrix3('u_EmissiveUVTransform', uvTransform);
      }
    } else if (this.hasEmissiveFactor()) {
      const emissiveFactor = this.getEmissiveFactor();

      material.setVector3('u_EmissiveFactor', emissiveFactor);
    }

    material.setFloat('u_Exposure', 3.0);
  }

  /**
   * 是否有基础颜色纹理
   * @returns
   */
  hasBaseColorTexture (): boolean {
    return this.baseColorTexture !== undefined;
  }

  /**
   * 是否有基础颜色纹理变换
   * @returns
   */
  hasBaseColorTextureTrans (): boolean {
    return this.baseColorTextureTrans !== undefined;
  }

  /**
   * 设置基础颜色纹理
   * @param val - 纹理
   */
  setBaseColorTexture (val: Texture) {
    this.baseColorTexture = val;
  }

  /**
   * 获取基础颜色纹理
   * @returns
   */
  getBaseColorFactor (): Vector4 {
    return this.baseColorFactor;
  }

  /**
   * 设置基础颜色值
   * @param val - 颜色值
   */
  setBaseColorFactor (val: Vector4 | spec.vec4) {
    if (val instanceof Vector4) {
      // for Vector4
      this.baseColorFactor.set(val.x, val.y, val.z, val.w);
    } else {
      // for vec4
      this.baseColorFactor.set(val[0], val[1], val[2], val[3]);
    }
  }

  /**
   * 是否有金属度粗超度纹理
   * @returns
   */
  hasMetallicRoughnessTexture (): boolean {
    return this.metallicRoughnessTexture !== undefined;
  }

  /**
   * 是否有金属度粗超度纹理坐标变换
   * @returns
   */
  hasMetallicRoughnessTextureTrans (): boolean {
    return this.metallicRoughnessTextureTrans !== undefined;
  }

  /**
   * 获取金属度粗超度纹理
   * @returns
   */
  getMetallicRoughnessTexture (): Texture {
    return this.metallicRoughnessTexture as Texture;
  }

  /**
   * 设置金属度粗超度纹理
   * @param val - 纹理
   */
  setMetallicRoughnessTexture (val: Texture) {
    this.metallicRoughnessTexture = val;
  }

  /**
   * 是否有法线纹理
   * @returns
   */
  hasNormalTexture (): boolean {
    return this.normalTexture !== undefined;
  }

  /**
   * 是否有法线纹理坐标变换
   * @returns
   */
  hasNormalTextureTrans (): boolean {
    return this.normalTextureTrans !== undefined;
  }

  /**
   * 获取法线纹理
   * @returns
   */
  getNormalTexture (): Texture {
    return this.normalTexture as Texture;
  }

  /**
   * 设置法线纹理
   * @param val - 纹理
   */
  setNormalTexture (val: Texture) {
    this.normalTexture = val;
  }

  /**
   * 是否有遮挡纹理
   * @returns
   */
  hasOcclusionTexture (): boolean {
    return this.occlusionTexture !== undefined;
  }

  /**
   * 是否有遮挡纹理坐标变换
   * @returns
   */
  hasOcclusionTextureTrans (): boolean {
    return this.occlusionTextureTrans !== undefined;
  }

  /**
   * 获取遮挡纹理
   * @returns
   */
  getOcclusionTexture (): Texture {
    return this.occlusionTexture as Texture;
  }

  /**
   * 设置遮挡纹理
   * @param val - 纹理
   */
  setOcclusionTexture (val: Texture) {
    this.occlusionTexture = val;
  }

  /**
   * 是否有自发光纹理
   * @returns
   */
  hasEmissiveTexture (): boolean {
    return this.emissiveTexture !== undefined;
  }

  /**
   * 是否有自发光纹理坐标变换
   * @returns
   */
  hasEmissiveTextureTrans (): boolean {
    return this.emissiveTextureTrans !== undefined;
  }

  /**
   * 获取自发光纹理
   * @returns
   */
  getEmissiveTexture (): Texture {
    return this.emissiveTexture as Texture;
  }

  /**
   * 设置自发光纹理
   * @param val - 纹理
   */
  setEmissiveTexture (val: Texture) {
    this.emissiveTexture = val;
  }

  /**
   * 是否有自发光颜色，包含强度
   * @returns
   */
  hasEmissiveFactor (): boolean {
    return this.emissiveFactor.sum() * this.emissiveIntensity > 0;
  }

  /**
   * 获取自发光颜色，包含强度
   * @returns
   */
  getEmissiveFactor (): Vector3 {
    return this.emissiveFactor.clone().multiply(this.emissiveIntensity);
  }

  /**
   * 设置自发光颜色
   * @param val - 颜色
   */
  setEmissiveFactor (val: Vector3 | spec.vec3) {
    if (val instanceof Vector3) {
      // Vector3
      this.emissiveFactor.set(val.x, val.y, val.z);
    } else {
      // vec3
      this.emissiveFactor.set(val[0], val[1], val[2]);
    }
  }

}

/**
 * 材质类型，包括无光照材质和 PBR 材质
 */
export type PMaterial = PMaterialUnlit | PMaterialPBR;

/**
 * 创建插件材质对象
 * @param options - 材质参数
 * @returns 材质对象
 */
export function createPluginMaterial (options: ModelMaterialOptions): PMaterial {
  if (options.type === spec.MaterialType.pbr) {
    const materialPBR = new PMaterialPBR();

    materialPBR.create(options);

    return materialPBR;
  } else {
    const materialUnlit = new PMaterialUnlit();

    materialUnlit.create(options);

    return materialUnlit;
  }
}

export function createInternalMaterial (options: {}): {} {
  return {};
}
