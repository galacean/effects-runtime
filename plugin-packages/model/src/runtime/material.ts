import type { Texture, Material } from '@galacean/effects';
import { spec, glContext } from '@galacean/effects';
import type { MacroInfo } from '../index';
import type { Matrix3 } from './math';
import { Vector3, Vector4, Color } from './math';
import { PObjectType, PMaterialType, PGlobalState, PBRShaderGUID } from './common';
import { PObject } from './object';
import { PluginHelper } from '../utility/plugin-helper';
import { PShaderManager } from './shader';

/**
 * 3D 材质基础类，支持公共的材质功能
 */
export abstract class PMaterialBase extends PObject {
  effectMaterial: Material;
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
  ZWrite = true;
  /**
   * 是否深度测试提示，默认开启
   */
  ZTest = true;
  /**
   * 渲染类型，默认是不透明
   */
  renderType: spec.RenderType = spec.RenderType.Opaque;
  /**
   * 是否 Alpha 裁剪，默认关闭
   */
  alphaClip = false;
  /**
   * Alpha 测试截断值
   */
  alphaCutoff = 0.5;
  /**
   * 面侧模式，默认是正面
   */
  renderFace: spec.RenderFace = spec.RenderFace.Front;

  /**
   * 获取着色器特性列表，根据材质状态
   * @returns 特性列表
   */
  getShaderFeatures (): string[] {
    const featureList: string[] = [];

    if (this.isAlphaClip()) {
      featureList.push('ALPHAMODE_MASK 1');
    } else if (this.isOpaque()) {
      featureList.push('ALPHAMODE_OPAQUE 1');
    }

    if (this.renderFace === spec.RenderFace.Both) {
      featureList.push('DOUBLE_SIDED 1');
    }

    return featureList;
  }

  getShaderMacros (): MacroInfo[] {
    const macroList: MacroInfo[] = [];

    if (this.isAlphaClip()) {
      macroList.push({ name: 'ALPHAMODE_MASK' });
    } else if (this.isOpaque()) {
      macroList.push({ name: 'ALPHAMODE_OPAQUE' });
    }

    if (this.renderFace === spec.RenderFace.Both) {
      macroList.push({ name: 'DOUBLE_SIDED' });
    }

    return macroList;
  }

  /**
   * 根据材质状态，更新 GE 材质状态
   * @param material - GE 材质
   */
  updateUniforms (material: Material) {
    // 渲染 UV 结果输出时，设置 uv 大小
    const renderMode = PGlobalState.getInstance().renderMode3D;

    if (renderMode === spec.RenderMode3D.uv) {
      const debugUVGridSize = PGlobalState.getInstance().renderMode3DUVGridSize;

      material.setFloat('_DebugUVGridSize', debugUVGridSize);
    }
  }

  /**
   * 生成顶点和片段着色器代码
   * 先获取着色器特性，再根据材质和全局状态，生成着色器代码
   * @param inFeatureList - 外部特性列表
   */
  build (inFeatureList?: string[]) {
    const finalFeatureList = this.getFeatureList(inFeatureList);
    const isWebGL2 = PGlobalState.getInstance().isWebGL2;
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

  getFeatureList (inFeatureList?: string[]) {
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

    return finalFeatureList;
  }

  getMacroList (inMacroList?: MacroInfo[]) {
    const finalMacroList = this.getShaderMacros();

    if (inMacroList !== undefined) {
      finalMacroList.push(...inMacroList);
    }
    const isWebGL2 = PGlobalState.getInstance().isWebGL2;

    if (isWebGL2) {
      finalMacroList.push({ name: 'WEBGL2' });
    }

    // 目前只有 PRB 和 Unlit 是需要 EDITOR_TRANSFORM，适配编辑器的视口 Offset
    // 阴影 Pass 的渲染是不需要，所以这里特殊处理下
    if (this.materialType !== PMaterialType.shadowBase) {
      const isEditorEvn = PGlobalState.getInstance().isEditorEnv;

      if (isEditorEvn) {
        finalMacroList.push({ name: 'EDITOR_TRANSFORM' });
      }
    }

    return finalMacroList;
  }

  /**
   * 设置材质状态，根据 GE 材质状态
   * @param material - GE 材质
   */
  setMaterialStates (material: Material) {
    if (this.renderType === spec.RenderType.Transparent) {
      material.blending = true;
      material.depthTest = this.ZTest;
      material.depthMask = this.ZWrite;
      material.blendEquation = [glContext.FUNC_ADD, glContext.FUNC_ADD];
      material.blendFunction = [
        glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
        glContext.ONE, glContext.ONE_MINUS_SRC_ALPHA,
      ];
    } else {
      if (PGlobalState.getInstance().isTiny3dMode) {
        material.blending = false;
        material.depthTest = true;
        // Tiny兼容模式下不透明的深度写入始终开
        material.depthMask = true;
      } else {
        material.blending = false;
        material.depthTest = this.ZTest;
        material.depthMask = this.ZWrite;
      }
    }

    this.setFaceSideStates(material);
  }

  protected setFaceSideStates (material: Material) {
    if (this.isBothSide()) {
      material.culling = false;
    } else if (this.isBackSide()) {
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
    return this.renderType === spec.RenderType.Opaque;
  }

  /**
   * 是否 Alpha 裁剪
   * @returns
   */
  isAlphaClip (): boolean {
    return this.alphaClip;
  }

  /**
   * 是否半透明
   * @returns
   */
  isTransparent (): boolean {
    return this.renderType === spec.RenderType.Transparent;
  }

  /**
   * 是否正面模式
   * @returns
   */
  isFrontSide (): boolean {
    return this.renderFace === spec.RenderFace.Front;
  }

  /**
   * 是否背面模式
   * @returns
   */
  isBackSide (): boolean {
    return this.renderFace === spec.RenderFace.Back;
  }

  /**
   * 是否双面模式
   * @returns
   */
  isBothSide (): boolean {
    return this.renderFace === spec.RenderFace.Both;
  }
}

/**
 * 无光照材质类，负责无关照或者不接受光照情况下的物体材质效果
 */
export class PMaterialUnlit extends PMaterialBase {
  /**
   * 基础颜色纹理
   */
  baseColorTexture?: Texture;
  /**
   * 基础颜色纹理变换
   */
  baseColorTextureTrans: Matrix3;
  /**
   * 基础颜色值，默认是白色 Color(1, 1, 1, 1)
   */
  baseColorFactor: Color = new Color(1, 1, 1, 1);

  /**
   * 创建无光照材质，支持基础颜色纹理
   * @param material - effect 材质对象
   */
  create (material: Material) {
    this.effectMaterial = material;
    this.name = material.name;
    this.type = PObjectType.material;
    this.materialType = PMaterialType.unlit;
    //
    this.baseColorTexture = material.getTexture('_BaseColorSampler') ?? undefined;
    this.baseColorTextureTrans = PluginHelper.createUVTransform(material, '_BaseColorSampler_ST', '_BaseColorRotation');
    this.baseColorFactor = material.getColor('_BaseColorFactor') ?? new Color(1.0, 1.0, 1.0, 1.0);
    //
    this.ZWrite = material.getFloat('ZWrite') !== 0;
    this.ZTest = material.getFloat('ZTest') !== 0;
    this.renderType = material.stringTags['RenderType'] as spec.RenderType ?? spec.RenderType.Opaque;
    this.alphaClip = material.getFloat('AlphaClip') === 1;
    this.alphaCutoff = material.getFloat('_AlphaCutoff') ?? 0;
    this.renderFace = material.stringTags['RenderFace'] as spec.RenderFace ?? spec.RenderFace.Front;
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

  override getShaderMacros (): MacroInfo[] {
    const macroList = super.getShaderMacros();

    macroList.push({ name: 'MATERIAL_METALLICROUGHNESS' });
    if (this.hasBaseColorTexture()) {
      macroList.push({ name: 'HAS_BASE_COLOR_MAP' });
    }

    macroList.push({ name: 'MATERIAL_UNLIT' });

    return macroList;
  }

  /**
   * 更新对应的 GE 材质中着色器的 Uniform 数据
   * @param material - GE 材质
   */
  override updateUniforms (material: Material) {
    super.updateUniforms(material);

    if (this.baseColorTexture !== undefined) {
      material.setInt('_BaseColorUVSet', 0);
      material.setMatrix3('_BaseColorUVTransform', this.baseColorTextureTrans);
    }

    material.setFloat('_MetallicFactor', 0);
    material.setFloat('_RoughnessFactor', 0);

    material.setFloat('_Exposure', 1.0);
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
   * 获取基础颜色纹理
   * @returns
   */
  getBaseColorFactor (): Color {
    return this.baseColorFactor;
  }

  /**
   * 设置基础颜色值
   * @param val - 颜色值
   */
  setBaseColorFactor (val: Color | Vector4 | spec.vec4) {
    if (val instanceof Color) {
      // for Color
      this.baseColorFactor.set(val.r, val.g, val.b, val.a);
    } else if (val instanceof Vector4) {
      // for Vector4
      this.baseColorFactor.set(val.x, val.y, val.z, val.w);
    } else {
      // for vec4
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
  baseColorTextureTrans: Matrix3;
  /**
   * 基础颜色值，默认是白色 Color(1, 1, 1, 1)
   */
  baseColorFactor: Color = new Color(1, 1, 1, 1);
  /**
   * 金属度粗超度纹理
   */
  metallicRoughnessTexture?: Texture;
  /**
   * 金属度粗超度纹理变换
   */
  metallicRoughnessTextureTrans: Matrix3;
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
  normalTextureTrans: Matrix3;
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
  occlusionTextureTrans: Matrix3;
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
  emissiveTextureTrans: Matrix3;
  /**
   * 自发光颜色值，默认是黑色 Vector4(0, 0, 0, 0)
   */
  emissiveFactor: Color = new Color(0, 0, 0, 0);
  /**
   * 自发光强度
   */
  emissiveIntensity = 1;

  /**
   * 创建材质
   * @param material - effect 材质对象
   */
  create (material: Material) {
    this.effectMaterial = material;
    this.name = material.name;
    this.type = PObjectType.material;
    this.materialType = PMaterialType.pbr;
    //
    this.baseColorTexture = material.getTexture('_BaseColorSampler') ?? undefined;
    this.baseColorTextureTrans = PluginHelper.createUVTransform(material, '_BaseColorSampler_ST', '_BaseColorRotation');
    this.baseColorFactor = material.getColor('_BaseColorFactor') ?? new Color(1.0, 1.0, 1.0, 1.0);
    //
    this.metallicRoughnessTexture = material.getTexture('_MetallicRoughnessSampler') ?? undefined;
    this.metallicRoughnessTextureTrans = PluginHelper.createUVTransform(material, '_MetallicRoughnessSampler_ST', '_MetallicRoughnessRotation');
    this.useSpecularAA = material.getFloat('_SpecularAA') === 1;
    this.metallicFactor = material.getFloat('_MetallicFactor') ?? 1;
    this.roughnessFactor = material.getFloat('_RoughnessFactor') ?? 0;
    //
    this.normalTexture = material.getTexture('_NormalSampler') ?? undefined;
    this.normalTextureTrans = PluginHelper.createUVTransform(material, '_NormalSampler_ST', '_NormalRotation');
    this.normalTextureScale = material.getFloat('_NormalScale') ?? 1;
    //
    this.occlusionTexture = material.getTexture('_OcclusionSampler') ?? undefined;
    this.occlusionTextureTrans = PluginHelper.createUVTransform(material, '_OcclusionSampler_ST', '_OcclusionRotation');
    this.occlusionTextureStrength = material.getFloat('_OcclusionStrength') ?? 1;
    //
    this.emissiveTexture = material.getTexture('_EmissiveSampler') ?? undefined;
    this.emissiveTextureTrans = PluginHelper.createUVTransform(material, '_EmissiveSampler_ST', '_EmissiveRotation');
    this.emissiveFactor = material.getColor('_EmissiveFactor') ?? new Color(0, 0, 0, 1);
    this.emissiveIntensity = material.getFloat('_EmissiveIntensity') ?? 1;
    //
    this.ZWrite = material.getFloat('ZWrite') !== 0;
    this.ZTest = material.getFloat('ZTest') !== 0;
    this.renderType = material.stringTags['RenderType'] as spec.RenderType ?? spec.RenderType.Opaque;
    this.alphaClip = material.getFloat('AlphaClip') === 1;
    this.alphaCutoff = material.getFloat('_AlphaCutoff') ?? 0;
    this.renderFace = material.stringTags['RenderFace'] as spec.RenderFace ?? spec.RenderFace.Front;
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
    } else if (this.hasEmissiveValue()) {
      featureList.push('HAS_EMISSIVE 1');
    }

    return featureList;
  }

  override getShaderMacros (): MacroInfo[] {
    const macroList = super.getShaderMacros();

    macroList.push({ name: 'MATERIAL_METALLICROUGHNESS' });
    if (this.hasBaseColorTexture()) {
      macroList.push({ name: 'HAS_BASE_COLOR_MAP' });
      if (this.baseColorTextureTrans !== undefined) {
        macroList.push({ name: 'HAS_BASECOLOR_UV_TRANSFORM' });
      }
    }
    if (this.hasMetallicRoughnessTexture()) {
      macroList.push({ name: 'HAS_METALLIC_ROUGHNESS_MAP' });
      if (this.metallicRoughnessTextureTrans !== undefined) {
        macroList.push({ name: 'HAS_METALLICROUGHNESS_UV_TRANSFORM' });
      }
    }
    if (this.useSpecularAA) {
      macroList.push({ name: 'USE_SPECULAR_AA' });
    }
    if (this.hasNormalTexture()) {
      macroList.push({ name: 'HAS_NORMAL_MAP' });
      if (this.normalTextureTrans !== undefined) {
        macroList.push({ name: 'HAS_NORMAL_UV_TRANSFORM' });
      }
    }
    if (this.hasOcclusionTexture()) {
      macroList.push({ name: 'HAS_OCCLUSION_MAP' });
      if (this.occlusionTextureTrans !== undefined) {
        macroList.push({ name: 'HAS_OCCLUSION_UV_TRANSFORM' });
      }
    }
    if (this.hasEmissiveTexture()) {
      macroList.push({ name: 'HAS_EMISSIVE_MAP' });
      if (this.emissiveTextureTrans !== undefined) {
        macroList.push({ name: 'HAS_EMISSIVE_UV_TRANSFORM' });
      }
    } else if (this.hasEmissiveValue()) {
      macroList.push({ name: 'HAS_EMISSIVE' });
    }

    return macroList;
  }

  /**
   * 更新关联的 GE 材质中着色器的 Uniform 数据
   * @param material - GE 材质
   */
  override updateUniforms (material: Material) {
    super.updateUniforms(material);

    if (this.baseColorTexture !== undefined) {
      material.setInt('_BaseColorUVSet', 0);
      material.setMatrix3('_BaseColorUVTransform', this.baseColorTextureTrans);
    }
    //
    if (this.metallicRoughnessTexture !== undefined) {
      material.setInt('_MetallicRoughnessUVSet', 0);
      material.setMatrix3('_MetallicRoughnessUVTransform', this.metallicRoughnessTextureTrans);
    }
    //
    if (this.normalTexture !== undefined) {
      material.setInt('_NormalUVSet', 0);
      material.setMatrix3('_NormalUVTransform', this.normalTextureTrans);
    }
    //
    if (this.occlusionTexture !== undefined) {
      material.setInt('_OcclusionUVSet', 0);
      material.setMatrix3('_OcclusionUVTransform', this.occlusionTextureTrans);
    }
    //
    if (this.emissiveTexture !== undefined) {
      material.setInt('_EmissiveUVSet', 0);
      material.setMatrix3('_EmissiveUVTransform', this.emissiveTextureTrans);
    }

    material.setFloat('_Exposure', 3.0);
  }

  /**
   * 是否有基础颜色纹理
   * @returns
   */
  hasBaseColorTexture (): boolean {
    return this.baseColorTexture !== undefined;
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
  getBaseColorFactor (): Color {
    return this.baseColorFactor;
  }

  /**
   * 设置基础颜色值
   * @param val - 颜色值
   */
  setBaseColorFactor (val: Color | Vector4 | spec.vec4) {
    if (val instanceof Color) {
      // for Vector4
      this.baseColorFactor.set(val.r, val.g, val.b, val.a);
    } else if (val instanceof Vector4) {
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
   * 是否有自发光值，包含强度
   * @returns
   */
  hasEmissiveValue (): boolean {
    return this.emissiveFactor.luminance() * this.emissiveIntensity > 0;
  }

  /**
   * 获取自发光颜色
   * @returns
   */
  getEmissiveFactor (): Color {
    return this.emissiveFactor;
  }

  /**
   * 设置自发光颜色
   * @param val - 颜色
   */
  setEmissiveFactor (val: Color | Vector3 | spec.vec3) {
    if (val instanceof Color) {
      // Color
      this.emissiveFactor.set(val.r, val.g, val.b, val.a);
    } else if (val instanceof Vector3) {
      // Vector3
      this.emissiveFactor.set(val.x, val.y, val.z, 0);
    } else {
      // vec3
      this.emissiveFactor.set(val[0], val[1], val[2], 0);
    }
  }

  /**
   * 获取自发光强度
   * @returns
   */
  getEmissiveIntensity (): number {
    return this.emissiveIntensity;
  }

  /**
   * 设置自发光强度
   * @param val - 强度
   */
  setEmissiveIntensity (val: number) {
    this.emissiveIntensity = val;
  }
}

/**
 * 材质类型，包括无光照材质和 PBR 材质
 */
export type PMaterial = PMaterialUnlit | PMaterialPBR;

/**
 * 创建插件材质对象
 * @param material - Effects 材质对象
 * @returns 材质对象
 */
export function createPluginMaterial (material: Material): PMaterial {
  if (material.shader.getInstanceId() === PBRShaderGUID) {
    const materialPBR = new PMaterialPBR();

    materialPBR.create(material);

    return materialPBR;
  } else {
    const materialUnlit = new PMaterialUnlit();

    materialUnlit.create(material);

    return materialUnlit;
  }
}
