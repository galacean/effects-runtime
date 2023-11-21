import type { Material, Texture } from '@galacean/effects';
import { spec, glContext } from '@galacean/effects';
import type {
  ModelMaterialOptions,
  ModelMaterialUnlitOptions,
  ModelMaterialPBROptions,
} from '../index';
import { Vector3, Vector4, Matrix3 } from '../math';
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

export abstract class PMaterialBase extends PObject {
  materialType: PMaterialType = PMaterialType.none;
  vertexShaderCode = '';
  fragmentShaderCode = '';
  /**
   * 深度是否写入，默认是写入(true)
   */
  depthMask = true;
  depthTestHint = true;
  blendMode: PBlendMode = PBlendMode.opaque;
  alphaCutOff = 0.5;
  faceSideMode: PFaceSideMode = PFaceSideMode.front;

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

  getFaceSideMode (mode?: spec.SideMode): PFaceSideMode {
    if (mode === spec.SideMode.DOUBLE) {
      return PFaceSideMode.both;
    } else if (mode === spec.SideMode.BACK) {
      return PFaceSideMode.back;
    } else {
      return PFaceSideMode.front;
    }
  }

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

  override dispose () {
    this.vertexShaderCode = '';
    this.fragmentShaderCode = '';
  }

  override isValid (): boolean {
    return this.materialType !== PMaterialType.none && super.isValid();
  }

  isOpaque (): boolean {
    return this.blendMode === PBlendMode.opaque;
  }

  isMasked (): boolean {
    return this.blendMode === PBlendMode.masked;
  }

  isTranslucent (): boolean {
    return this.blendMode === PBlendMode.translucent;
  }

  isAdditive (): boolean {
    return this.blendMode === PBlendMode.additive;
  }

  requireBlend (): boolean {
    return this.blendMode === PBlendMode.translucent || this.blendMode === PBlendMode.additive;
  }

  isFrontFace (): boolean {
    return this.faceSideMode === PFaceSideMode.front;
  }

  isBackFace (): boolean {
    return this.faceSideMode === PFaceSideMode.back;
  }

  isBothFace (): boolean {
    return this.faceSideMode === PFaceSideMode.both;
  }

}

export class PMaterialUnlit extends PMaterialBase {
  private baseColorFactor: Vector4 = new Vector4(1, 1, 1, 1);
  private baseColorTexture?: Texture;

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

  override dispose () {
    super.dispose();
    this.baseColorTexture = undefined;
  }

  override getShaderFeatures (): string[] {
    const featureList = super.getShaderFeatures();

    featureList.push('MATERIAL_METALLICROUGHNESS 1');
    if (this.hasBaseColorTexture()) {
      featureList.push('HAS_BASE_COLOR_MAP 1');
    }

    featureList.push('MATERIAL_UNLIT 1');

    return featureList;
  }

  override updateUniforms (material: Material) {
    super.updateUniforms(material);
    //
    const uvTransform = Matrix3.IDENTITY.clone();

    material.setVector4('u_BaseColorFactor', this.baseColorFactor.toArray() as spec.vec4);
    if (this.hasBaseColorTexture()) {
      material.setTexture('u_BaseColorSampler', this.getBaseColorTexture());
      material.setInt('u_BaseColorUVSet', 0);
      material.setMatrix('u_BaseColorUVTransform', uvTransform.toArray() as spec.mat4);
    }
    material.setFloat('u_MetallicFactor', 0.0);
    material.setFloat('u_RoughnessFactor', 0.0);

    material.setFloat('u_Exposure', 1.0);
  }

  hasBaseColorTexture (): boolean {
    return this.baseColorTexture !== undefined;
  }

  getBaseColorTexture (): Texture {
    return this.baseColorTexture as Texture;
  }

  setBaseColorTexture (val: Texture) {
    this.baseColorTexture = val;
  }

  getBaseColorFactor (): Vector4 {
    return this.baseColorFactor;
  }

  setBaseColorFactor (val: Vector4 | spec.vec4) {
    if (val instanceof Vector4) {
      this.baseColorFactor.set(val.x, val.y, val.z, val.w);
    } else {
      this.baseColorFactor.set(val[0], val[1], val[2], val[3]);
    }
  }

}

export class PMaterialPBR extends PMaterialBase {
  baseColorTexture?: Texture;
  baseColorTextureTrans?: Matrix3;
  baseColorFactor = new Vector4(1, 1, 1, 1);
  //
  metallicRoughnessTexture?: Texture;
  metallicRoughnessTextureTrans?: Matrix3;
  useSpecularAA = false;
  metallicFactor = 0;
  roughnessFactor = 1;
  //
  normalTexture?: Texture;
  normalTextureTrans?: Matrix3;
  normalTextureScale = 1;
  //
  occlusionTexture?: Texture;
  occlusionTextureTrans?: Matrix3;
  occlusionTextureStrength = 1;
  //
  emissiveTexture?: Texture;
  emissiveTextureTrans?: Matrix3;
  emissiveFactor = new Vector3(0, 0, 0);
  emissiveIntensity = 1;
  //
  enableShadow = false;

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

  override dispose () {
    super.dispose();
    this.baseColorTexture = undefined;
    this.metallicRoughnessTexture = undefined;
    this.normalTexture = undefined;
    this.occlusionTexture = undefined;
    this.emissiveTexture = undefined;
  }

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

  override updateUniforms (material: Material) {
    super.updateUniforms(material);
    //
    const uvTransform = Matrix3.IDENTITY.clone();

    material.setVector4('u_BaseColorFactor', this.baseColorFactor.toArray() as spec.vec4);
    if (this.baseColorTexture !== undefined) {
      material.setTexture('u_BaseColorSampler', this.baseColorTexture);
      material.setInt('u_BaseColorUVSet', 0);
      if (this.baseColorTextureTrans !== undefined) {
        material.setMatrix3('u_BaseColorUVTransform', this.baseColorTextureTrans.toArray() as spec.mat3);
      } else {
        // fill other data
        material.setMatrix3('u_BaseColorUVTransform', uvTransform.toArray() as spec.mat3);
      }
    }
    //
    material.setFloat('u_MetallicFactor', this.metallicFactor);
    material.setFloat('u_RoughnessFactor', this.roughnessFactor);
    if (this.metallicRoughnessTexture !== undefined) {
      material.setTexture('u_MetallicRoughnessSampler', this.metallicRoughnessTexture);
      material.setInt('u_MetallicRoughnessUVSet', 0);
      if (this.metallicRoughnessTextureTrans !== undefined) {
        material.setMatrix3('u_MetallicRoughnessUVTransform', this.metallicRoughnessTextureTrans.toArray() as spec.mat3);
      } else {
        // fill other data
        material.setMatrix3('u_MetallicRoughnessUVTransform', uvTransform.toArray() as spec.mat3);
      }
    }
    //
    if (this.normalTexture !== undefined) {
      material.setTexture('u_NormalSampler', this.normalTexture);
      material.setFloat('u_NormalScale', this.normalTextureScale);
      material.setInt('u_NormalUVSet', 0);
      if (this.normalTextureTrans !== undefined) {
        material.setMatrix3('u_NormalUVTransform', this.normalTextureTrans.toArray() as spec.mat3);
      } else {
        // fill other data
        material.setMatrix3('u_NormalUVTransform', uvTransform.toArray() as spec.mat3);
      }
    }
    //
    if (this.occlusionTexture !== undefined) {
      material.setTexture('u_OcclusionSampler', this.occlusionTexture);
      material.setFloat('u_OcclusionStrength', this.occlusionTextureStrength);
      material.setInt('u_OcclusionUVSet', 0);
      if (this.occlusionTextureTrans !== undefined) {
        material.setMatrix3('u_OcclusionUVTransform', this.occlusionTextureTrans.toArray() as spec.mat3);
      } else {
        // fill other data
        material.setMatrix3('u_OcclusionUVTransform', uvTransform.toArray() as spec.mat3);
      }
    }
    //
    if (this.emissiveTexture !== undefined) {
      const emissiveFactor = this.getEmissiveFactor();

      material.setTexture('u_EmissiveSampler', this.emissiveTexture);
      material.setVector3('u_EmissiveFactor', emissiveFactor.toArray() as spec.vec3);
      material.setInt('u_EmissiveUVSet', 0);
      if (this.emissiveTextureTrans !== undefined) {
        material.setMatrix3('u_EmissiveUVTransform', this.emissiveTextureTrans.toArray() as spec.mat3);
      } else {
        // fill other data
        material.setMatrix3('u_EmissiveUVTransform', uvTransform.toArray() as spec.mat3);
      }
    } else if (this.hasEmissiveFactor()) {
      const emissiveFactor = this.getEmissiveFactor();

      material.setVector3('u_EmissiveFactor', emissiveFactor.toArray() as spec.vec3);
    }

    material.setFloat('u_Exposure', 3.0);
  }

  hasBaseColorTexture (): boolean {
    return this.baseColorTexture !== undefined;
  }

  hasBaseColorTextureTrans (): boolean {
    return this.baseColorTextureTrans !== undefined;
  }

  setBaseColorTexture (val: Texture) {
    this.baseColorTexture = val;
  }

  getBaseColorFactor (): Vector4 {
    return this.baseColorFactor;
  }

  setBaseColorFactor (val: Vector4 | spec.vec4) {
    if (val instanceof Vector4) {
      // for Vector4
      this.baseColorFactor.set(val.x, val.y, val.z, val.w);
    } else {
      // for vec4
      this.baseColorFactor.set(val[0], val[1], val[2], val[3]);
    }
  }

  hasMetallicRoughnessTexture (): boolean {
    return this.metallicRoughnessTexture !== undefined;
  }

  hasMetallicRoughnessTextureTrans (): boolean {
    return this.metallicRoughnessTextureTrans !== undefined;
  }

  getMetallicRoughnessTexture (): Texture {
    return this.metallicRoughnessTexture as Texture;
  }

  setMetallicRoughnessTexture (val: Texture) {
    this.metallicRoughnessTexture = val;
  }

  hasNormalTexture (): boolean {
    return this.normalTexture !== undefined;
  }

  hasNormalTextureTrans (): boolean {
    return this.normalTextureTrans !== undefined;
  }

  getNormalTexture (): Texture {
    return this.normalTexture as Texture;
  }

  setNormalTexture (val: Texture) {
    this.normalTexture = val;
  }

  hasOcclusionTexture (): boolean {
    return this.occlusionTexture !== undefined;
  }

  hasOcclusionTextureTrans (): boolean {
    return this.occlusionTextureTrans !== undefined;
  }

  getOcclusionTexture (): Texture {
    return this.occlusionTexture as Texture;
  }

  setOcclusionTexture (val: Texture) {
    this.occlusionTexture = val;
  }

  hasEmissiveTexture (): boolean {
    return this.emissiveTexture !== undefined;
  }

  hasEmissiveTextureTrans (): boolean {
    return this.emissiveTextureTrans !== undefined;
  }

  getEmissiveTexture (): Texture {
    return this.emissiveTexture as Texture;
  }

  setEmissiveTexture (val: Texture) {
    this.emissiveTexture = val;
  }

  hasEmissiveFactor (): boolean {
    return this.emissiveFactor.sum() * this.emissiveIntensity > 0;
  }

  getEmissiveFactor (): Vector3 {
    return this.emissiveFactor.clone().multiplyScalar(this.emissiveIntensity);
  }

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

export type PMaterial = PMaterialUnlit | PMaterialPBR;

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
