import * as spec from '@galacean/effects-specification';
import type { Color, Matrix3, Quaternion, Vector2, Vector3 } from '@galacean/effects-math/es/core/index';
import { Vector4, Matrix4 } from '@galacean/effects-math/es/core/index';
import * as math from '@galacean/effects-math/es/core/index';
import type { GlobalUniforms, Renderer, ShaderVariant, ShaderWithSource } from '../render';
import { Shader } from '../render/shader';
import type { Texture } from '../texture';
import type { DestroyOptions, Disposable } from '../utils';
import { assertExist, generateGUID, isFunction, logger, throwDestroyedError } from '../utils';
import type { UniformValue } from './types';
import type { Engine } from '../engine';
import { EffectsObject } from '../effects-object';
import { MaterialState } from './material-state';
import { glContext } from '../gl';

/**
 * 材质销毁设置
 */
export interface MaterialDestroyOptions {
  /**
   * 纹理的销毁设置
   */
  textures?: DestroyOptions,
}

/**
 * 材质渲染类型
 */
export enum MaterialRenderType {
  normal = 0,
  transformFeedback = 1,
}

export type UndefinedAble<U> = U | undefined;

/**
 * 材质属性
 */
export interface MaterialProps {
  /**
   * shader 文本和属性
   */
  shader: ShaderWithSource,
  /**
   * 材质的名称，未传入会自动设置为 `Material[seed]`
   */
  name?: string,
  /**
   * 渲染类型
   */
  renderType?: MaterialRenderType,
  /**
   * uniform 数据
   */
  uniformValues?: Record<string, UniformValue>,
}

/**
 * 用于设置材质默认名称的自增序号
 * @internal
 */
let seed = 1;

/**
 * Material 类
 */
export class Material extends EffectsObject implements Disposable {
  shaderVariant: ShaderVariant;

  // TODO: 待移除
  shaderSource: ShaderWithSource;
  stringTags: Record<string, string> = {};
  readonly enabledMacros: Record<string, number | boolean> = {};
  readonly renderType: MaterialRenderType;
  readonly name: string;
  readonly props: MaterialProps;

  protected destroyed = false;
  protected initialized = false;
  protected shaderDirty = true;

  private _shader: Shader;

  protected floats: Record<string, number> = {};
  protected ints: Record<string, number> = {};
  protected vector2s: Record<string, Vector2> = {};
  protected vector3s: Record<string, Vector3> = {};
  protected vector4s: Record<string, Vector4> = {};
  protected colors: Record<string, Color> = {};
  protected quaternions: Record<string, Quaternion> = {};
  protected matrices: Record<string, Matrix4> = {};
  protected matrice3s: Record<string, Matrix3> = {};
  protected textures: Record<string, Texture> = {};
  protected floatArrays: Record<string, number[]> = {};
  protected vector4Arrays: Record<string, number[]> = {};
  protected matrixArrays: Record<string, number[]> = {};

  protected samplers: string[] = [];
  protected uniforms: string[] = [];

  protected uniformDirty = true;
  protected macrosDirty = true;
  protected materialState = new MaterialState();

  constructor (
    engine: Engine,
    props?: MaterialProps,
  ) {
    super(engine);

    if (props) {
      const {
        name = 'Material' + seed++,
        renderType = MaterialRenderType.normal,
        shader,
      } = props;

      this.name = name;
      this.renderType = renderType; // TODO 没有地方用到
      this.shaderSource = shader;
      this.props = props;

      this._shader = new Shader(engine);
      this._shader.shaderData = {
        ...props.shader,
        id: generateGUID(),
        dataType: spec.DataType.Shader,
      };
    } else {
      this.name = 'Material' + seed++;
      this.renderType = MaterialRenderType.normal;
    }
  }

  get shader () {
    return this._shader;
  }

  set shader (value: Shader) {
    if (this._shader === value) {
      return;
    }
    this._shader = value;
    this.shaderDirty = true;
  }

  /**
   * 材质的主纹理
   */
  get mainTexture () {
    return this.getTexture('_MainTex') as Texture;
  }

  set mainTexture (value: Texture) {
    this.setTexture('_MainTex', value);
  }

  /**
   * 材质的主颜色
   */
  get color () {
    return this.getColor('_Color') as Color;
  }

  set color (value: Color) {
    this.setColor('_Color', value);
  }

  /*** 渲染状态 getter/setter ***/

  get blending () {
    return this.materialState.blending;
  }
  set blending (blending: UndefinedAble<boolean>) {
    blending !== undefined && this.materialState.setBlending(blending);
  }

  get blendColor () {
    return this.materialState.blendColor;
  }
  set blendColor (color: UndefinedAble<[r: number, g: number, b: number, a: number]>) {
    color && this.materialState.setBlendColor(color);
  }

  get blendFunction () {
    return this.materialState.blendFunctionParameters;
  }
  set blendFunction (func: UndefinedAble<[blendSrc: number, blendDst: number, blendSrcAlpha: number, blendDstAlpha: number]>) {
    func && this.materialState.setBlendFunctionParameters(func);
  }

  get blendEquation () {
    return this.materialState.blendEquationParameters;
  }
  set blendEquation (equation: UndefinedAble<[rgb: number, alpha: number]>) {
    equation && this.materialState.setBlendEquationParameters(equation);
  }

  get depthTest () {
    return this.materialState.depthTest;
  }
  set depthTest (value: UndefinedAble<boolean>) {
    value !== undefined && this.materialState.setDepthTest(value);
  }

  get depthMask () {
    return this.materialState.depthMask;
  }
  set depthMask (value: UndefinedAble<boolean>) {
    value !== undefined && this.materialState.setDepthMask(value);
  }

  get depthRange () {
    return this.materialState.depthRange;
  }
  set depthRange (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setDepthRange(value);
  }

  get depthFunc () {
    return this.materialState.depthFunc;
  }
  set depthFunc (value: UndefinedAble<number>) {
    value !== undefined && this.materialState.setDepthFunc(value);
  }

  get polygonOffsetFill () {
    return this.materialState.polygonOffsetFill;
  }
  set polygonOffsetFill (value: UndefinedAble<boolean>) {
    value !== undefined && this.materialState.setPolygonOffsetFill(value);
  }

  get polygonOffset () {
    return this.materialState.polygonOffset;
  }
  set polygonOffset (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setPolygonOffset(value);
  }

  get sampleAlphaToCoverage () {
    return this.materialState.sampleAlphaToCoverage;
  }
  set sampleAlphaToCoverage (value: UndefinedAble<boolean>) {
    value !== undefined && this.materialState.setSampleAlphaToCoverage(value);
  }

  get colorMask () {
    return this.materialState.colorMask[0];
  }
  set colorMask (value: boolean) {
    this.materialState.setColorMask(value);
  }

  get stencilTest () {
    return this.materialState.stencilTest;
  }
  set stencilTest (value: UndefinedAble<boolean>) {
    value !== undefined && this.materialState.setStencilTest(value);
  }

  get stencilMask () {
    return this.materialState.stencilMask;
  }
  set stencilMask (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setStencilMask(value);
  }

  get stencilRef () {
    return this.materialState.stencilRef;
  }
  set stencilRef (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setStencilRef(value);
  }

  get stencilFunc () {
    return this.materialState.stencilFunc;
  }
  set stencilFunc (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setStencilFunc(value);
  }

  get stencilOpFail () {
    return this.materialState.stencilOpFail;
  }
  set stencilOpFail (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setStencilOpFail(value);
  }

  get stencilOpZFail () {
    return this.materialState.stencilOpZFail;
  }
  set stencilOpZFail (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setStencilOpZFail(value);
  }

  get stencilOpZPass () {
    return this.materialState.stencilOpZPass;
  }
  set stencilOpZPass (value: UndefinedAble<[number, number]>) {
    value && this.materialState.setStencilOpZPass(value);
  }

  get culling () {
    return this.materialState.culling;
  }
  set culling (value: UndefinedAble<boolean>) {
    value !== undefined && this.materialState.setCulling(value);
  }

  get frontFace () {
    return this.materialState.frontFace;
  }
  set frontFace (value: UndefinedAble<number>) {
    value !== undefined && this.materialState.setFrontFace(value);
  }

  get cullFace () {
    return this.materialState.cullFace;
  }
  set cullFace (value: UndefinedAble<number>) {
    value !== undefined && this.materialState.setCullFace(value);
  }

  /*** Macro 管理 ***/

  enableMacro (keyword: string, value?: boolean | number): void {
    if (!this.isMacroEnabled(keyword) || this.enabledMacros[keyword] !== value) {
      this.enabledMacros[keyword] = value ?? true;
      this.macrosDirty = true;
    }
  }

  disableMacro (keyword: string): void {
    if (this.isMacroEnabled(keyword)) {
      delete this.enabledMacros[keyword];
      this.macrosDirty = true;
    }
  }

  isMacroEnabled (keyword: string): boolean {
    return this.enabledMacros[keyword] !== undefined;
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  /*** GPU 资源初始化 ***/

  initialize (): void {
    const engine = this.engine;

    this.createShaderVariant();
    this.shaderVariant.initialize();
    if (this.initialized) {
      return;
    }
    engine.addMaterial(this);
    Object.keys(this.textures).forEach(key => {
      const texture = this.textures[key];

      if (!isFunction(texture.initialize)) {
        logger.error(`Failed to initialize texture: ${JSON.stringify(texture)}. Ensure the texture conforms to the expected format.`);

        return;
      }
      texture.initialize();
    });
    this.initialized = true;
  }

  createShaderVariant () {
    if (this.shaderDirty || this.macrosDirty) {
      this.shaderVariant = this._shader.createVariant(this.enabledMacros);
      this.macrosDirty = false;
      this.shaderDirty = false;
      this.uniformDirty = true;
    }
  }

  setupStates (engine: Engine) {
    this.materialState.apply(engine);
  }

  use (renderer: Renderer, globalUniforms?: GlobalUniforms) {
    const engine = renderer.engine;
    const shaderVariant = this.shaderVariant;

    shaderVariant.bind();
    this.setupStates(engine);
    let name: string;

    if (globalUniforms) {
      for (name of globalUniforms.uniforms) {
        this.checkUniform(name);
      }
      for (name of globalUniforms.samplers) {
        if (!this.samplers.includes(name)) {
          this.samplers.push(name);
          this.uniformDirty = true;
        }
      }
    }

    if (this.uniformDirty) {
      shaderVariant.fillShaderInformation(this.uniforms, this.samplers);
      this.uniformDirty = false;
    }

    if (globalUniforms) {
      for (name in globalUniforms.floats) {
        shaderVariant.setFloat(name, globalUniforms.floats[name]);
      }
      for (name in globalUniforms.ints) {
        shaderVariant.setInt(name, globalUniforms.ints[name]);
      }
      for (name in globalUniforms.vector4s) {
        shaderVariant.setVector4(name, globalUniforms.vector4s[name]);
      }
      for (name in globalUniforms.vector3s) {
        shaderVariant.setVector3(name, globalUniforms.vector3s[name]);
      }
      for (name in globalUniforms.matrices) {
        shaderVariant.setMatrix(name, globalUniforms.matrices[name]);
      }
    }

    for (name in this.textures) {
      this.textures[name].initialize();
    }
    for (name in this.floats) {
      shaderVariant.setFloat(name, this.floats[name]);
    }
    for (name in this.ints) {
      shaderVariant.setInt(name, this.ints[name]);
    }
    for (name in this.floatArrays) {
      shaderVariant.setFloats(name, this.floatArrays[name]);
    }
    for (name in this.textures) {
      shaderVariant.setTexture(name, this.textures[name]);
    }
    for (name in this.vector2s) {
      shaderVariant.setVector2(name, this.vector2s[name]);
    }
    for (name in this.vector3s) {
      shaderVariant.setVector3(name, this.vector3s[name]);
    }
    for (name in this.vector4s) {
      shaderVariant.setVector4(name, this.vector4s[name]);
    }
    for (name in this.colors) {
      shaderVariant.setColor(name, this.colors[name]);
    }
    for (name in this.quaternions) {
      shaderVariant.setQuaternion(name, this.quaternions[name]);
    }
    for (name in this.matrices) {
      shaderVariant.setMatrix(name, this.matrices[name]);
    }
    for (name in this.matrice3s) {
      shaderVariant.setMatrix3(name, this.matrice3s[name]);
    }
    for (name in this.vector4Arrays) {
      shaderVariant.setVector4Array(name, this.vector4Arrays[name]);
    }
    for (name in this.matrixArrays) {
      shaderVariant.setMatrixArray(name, this.matrixArrays[name]);
    }
  }

  /*** Uniform get/set 方法 ***/

  getFloat (name: string): number | null {
    return this.floats[name];
  }
  setFloat (name: string, value: number) {
    this.checkUniform(name);
    this.floats[name] = value;
  }

  getInt (name: string): number | null {
    return this.ints[name];
  }
  setInt (name: string, value: number) {
    this.checkUniform(name);
    this.ints[name] = value;
  }

  getFloats (name: string): number[] | null {
    return this.floatArrays[name];
  }
  setFloats (name: string, value: number[]) {
    this.checkUniform(name);
    this.floatArrays[name] = value;
  }

  getVector2 (name: string): Vector2 | null {
    return this.vector2s[name];
  }
  setVector2 (name: string, value: Vector2): void {
    this.checkUniform(name);
    this.vector2s[name] = value;
  }

  getVector3 (name: string): Vector3 | null {
    return this.vector3s[name];
  }
  setVector3 (name: string, value: Vector3): void {
    this.checkUniform(name);
    this.vector3s[name] = value;
  }

  getVector4 (name: string): Vector4 | null {
    return this.vector4s[name];
  }
  setVector4 (name: string, value: Vector4): void {
    this.checkUniform(name);
    this.vector4s[name] = value;
  }

  getColor (name: string): Color | null {
    return this.colors[name];
  }
  setColor (name: string, value: Color): void {
    this.checkUniform(name);
    this.colors[name] = value;
  }

  getQuaternion (name: string): Quaternion | null {
    return this.quaternions[name];
  }
  setQuaternion (name: string, value: Quaternion): void {
    this.checkUniform(name);
    this.quaternions[name] = value;
  }

  getMatrix (name: string): Matrix4 | null {
    return this.matrices[name];
  }
  setMatrix (name: string, value: Matrix4): void {
    this.checkUniform(name);
    this.matrices[name] = value;
  }
  setMatrix3 (name: string, value: Matrix3): void {
    this.checkUniform(name);
    this.matrice3s[name] = value;
  }

  getVector4Array (name: string): number[] {
    return this.vector4Arrays[name];
  }
  setVector4Array (name: string, array: Vector4[]): void {
    this.checkUniform(name);
    this.vector4Arrays[name] = [];
    for (const v of array) {
      this.vector4Arrays[name].push(v.x, v.y, v.z, v.w);
    }
  }

  getMatrixArray (name: string): number[] | null {
    return this.matrixArrays[name];
  }
  setMatrixArray (name: string, array: Matrix4[]): void {
    this.checkUniform(name);
    this.matrixArrays[name] = [];
    for (const m of array) {
      for (let i = 0; i < 16; i++) {
        this.matrixArrays[name].push(m.elements[i]);
      }
    }
  }
  setMatrixNumberArray (name: string, array: number[]): void {
    this.checkUniform(name);
    this.matrixArrays[name] = array;
  }

  getTexture (name: string): Texture | null {
    return this.textures[name];
  }
  setTexture (name: string, texture: Texture) {
    if (!this.samplers.includes(name)) {
      this.samplers.push(name);
      this.uniformDirty = true;
    }
    this.textures[name] = texture;
  }

  hasUniform (name: string): boolean {
    return this.uniforms.includes(name) || this.samplers.includes(name);
  }

  /*** 克隆 ***/

  clone (props?: MaterialProps): Material {
    const newProps = props ? props : this.props;
    const engine = this.engine;

    assertExist(engine);
    const clonedMaterial = Material.create(engine, newProps);

    clonedMaterial.materialState = Object.assign(new MaterialState(), clonedMaterial.materialState);
    clonedMaterial.floats = this.floats;
    clonedMaterial.ints = this.ints;
    clonedMaterial.vector2s = this.vector2s;
    clonedMaterial.vector3s = this.vector3s;
    clonedMaterial.vector4s = this.vector4s;
    clonedMaterial.colors = this.colors;
    clonedMaterial.quaternions = this.quaternions;
    clonedMaterial.matrices = this.matrices;
    clonedMaterial.textures = this.textures;
    clonedMaterial.floatArrays = this.floatArrays;
    clonedMaterial.vector4Arrays = this.vector4Arrays;
    clonedMaterial.matrixArrays = this.matrixArrays;
    clonedMaterial.samplers = this.samplers;
    clonedMaterial.uniforms = this.uniforms;
    clonedMaterial.uniformDirty = true;

    return clonedMaterial;
  }

  cloneUniforms (sourceMaterial: Material): void {
    let name: string;

    for (name in sourceMaterial.floats) {
      this.setFloat(name, sourceMaterial.floats[name]);
    }
    for (name in sourceMaterial.ints) {
      this.setInt(name, sourceMaterial.ints[name]);
    }
    for (name in sourceMaterial.floatArrays) {
      this.setFloats(name, sourceMaterial.floatArrays[name]);
    }
    for (name in sourceMaterial.textures) {
      this.setTexture(name, sourceMaterial.textures[name]);
    }
    for (name in sourceMaterial.vector2s) {
      this.setVector2(name, sourceMaterial.vector2s[name]);
    }
    for (name in sourceMaterial.vector3s) {
      this.setVector3(name, sourceMaterial.vector3s[name]);
    }
    for (name in sourceMaterial.vector4s) {
      this.setVector4(name, sourceMaterial.vector4s[name]);
    }
    for (name in sourceMaterial.colors) {
      this.setColor(name, sourceMaterial.colors[name]);
    }
    for (name in sourceMaterial.quaternions) {
      this.setQuaternion(name, sourceMaterial.quaternions[name]);
    }
    for (name in sourceMaterial.matrices) {
      this.setMatrix(name, sourceMaterial.matrices[name]);
    }
    for (name in sourceMaterial.vector4Arrays) {
      const vec4Array: Vector4[] = [];

      for (let i = 0; i < sourceMaterial.vector4Arrays[name].length; i += 4) {
        vec4Array.push(new Vector4(
          sourceMaterial.vector4Arrays[name][i],
          sourceMaterial.vector4Arrays[name][i + 1],
          sourceMaterial.vector4Arrays[name][i + 2],
          sourceMaterial.vector4Arrays[name][i + 3],
        ));
      }
      this.setVector4Array(name, vec4Array);
    }
    for (name in sourceMaterial.matrixArrays) {
      const mat4Array: Matrix4[] = [];

      for (let i = 0; i < sourceMaterial.matrixArrays[name].length; i += 16) {
        const matrix = Matrix4.fromIdentity();

        for (let j = 0; j < 16; j++) {
          matrix.elements[j] = (sourceMaterial.matrixArrays[name][i + j]);
        }
        mat4Array.push(matrix);
      }
      this.setMatrixArray(name, mat4Array);
    }
  }

  /*** 序列化 ***/

  override fromData (data: spec.MaterialData): void {
    super.fromData(data);

    this.uniforms = [];
    this.samplers = [];
    this.textures = {};
    this.floats = {};
    this.ints = {};
    this.floatArrays = {};
    this.vector4s = {};

    const propertiesData = {
      ...data,
    };

    if (data.stringTags['RenderType'] !== undefined) {
      this.blending = data.stringTags['RenderType'] === spec.RenderType.Transparent;
    }
    if (data.floats['ZTest'] !== undefined) {
      this.depthTest = data.floats['ZTest'] !== 0;
    }
    if (data.floats['ZWrite'] !== undefined) {
      this.depthMask = data.floats['ZWrite'] !== 0;
    }

    const renderFace = data.stringTags['RenderFace'];

    if (renderFace === spec.RenderFace.Front) {
      this.culling = true;
      this.cullFace = glContext.BACK;
    } else if (renderFace === spec.RenderFace.Back) {
      this.culling = true;
      this.cullFace = glContext.FRONT;
    } else {
      this.culling = false;
    }

    let name: string;

    for (name in propertiesData.floats) {
      this.setFloat(name, propertiesData.floats[name]);
    }
    for (name in propertiesData.ints) {
      this.setInt(name, propertiesData.ints[name]);
    }
    for (name in propertiesData.vector4s) {
      const vector4Value = propertiesData.vector4s[name];

      this.setVector4(name, new math.Vector4(vector4Value.x, vector4Value.y, vector4Value.z, vector4Value.w));
    }
    for (name in propertiesData.colors) {
      const colorValue = propertiesData.colors[name];

      this.setColor(name, new math.Color(colorValue.r, colorValue.g, colorValue.b, colorValue.a));
    }
    for (name in propertiesData.textures) {
      const textureProperties = propertiesData.textures[name];

      const texture = this.engine.findObject<Texture>(textureProperties.texture);

      // TODO 纹理通过 id 加入场景数据
      this.setTexture(name, texture);
      const offset = textureProperties.offset;
      const scale = textureProperties.scale;

      if (offset && scale) {
        this.setVector4(name + '_ST', new Vector4(scale.x, scale.y, offset.x, offset.y));
      }
    }

    if (data.shader) {
      const shader = this.engine.findObject<Shader>(data.shader);

      if (shader) {
        this.shader = shader;
        this.shaderSource = shader.shaderData;
      }
    }
    this.stringTags = data.stringTags ?? {};
    this.initialized = false;
  }

  override toData (): spec.MaterialData {
    // @ts-expect-error
    const materialData: spec.MaterialData = this.definition;

    if (this._shader) {
      // @ts-expect-error
      materialData.shader = this._shader;
    }
    materialData.floats = {};
    materialData.ints = {};
    materialData.vector4s = {};
    materialData.colors = {};
    materialData.textures = {};
    materialData.dataType = spec.DataType.Material;
    materialData.stringTags = this.stringTags;

    for (const name in this.floats) {
      materialData.floats[name] = this.floats[name];
    }
    for (const name in this.ints) {
      materialData.ints[name] = this.ints[name];
    }
    for (const name in this.vector4s) {
      materialData.vector4s[name] = this.vector4s[name];
    }
    for (const name in this.colors) {
      materialData.colors[name] = this.colors[name];
    }
    for (const name in this.textures) {
      if (!materialData.textures[name]) {
        materialData.textures[name] = {
          texture: this.textures[name],
        };
      }
      const textureProperties = materialData.textures[name];
      const scaleOffset = this.getVector4(name + '_ST');

      if (scaleOffset) {
        textureProperties.scale = { x: scaleOffset.x, y: scaleOffset.y };
        textureProperties.offset = { x: scaleOffset.z, y: scaleOffset.w };
        delete materialData.vector4s[name + '_ST'];
      }
    }

    return materialData;
  }

  /**
   * 创建 Material
   */
  static create: (engine: Engine, props?: MaterialProps) => Material = (engine, props) => {
    return new Material(engine, props);
  };

  /*** 内部方法 ***/

  private checkUniform (uniformName: string): void {
    if (!this.uniforms.includes(uniformName)) {
      this.uniforms.push(uniformName);
      this.uniformDirty = true;
    }
  }

  override dispose () {
    if (this.destroyed) {
      return;
    }
    this.shaderVariant?.dispose();
    this.textures = {};

    // @ts-expect-error
    this.shaderSource = null;
    this.floats = {};
    this.ints = {};
    this.vector2s = {};
    this.vector3s = {};
    this.vector4s = {};
    this.quaternions = {};
    this.matrices = {};
    this.matrice3s = {};
    this.textures = {};
    this.floatArrays = {};
    this.vector4Arrays = {};
    this.matrixArrays = {};
    this.samplers = [];
    this.uniforms = [];
    this.initialize = throwDestroyedError as unknown as () => Material;
    this.destroyed = true;

    if (this.engine !== undefined) {
      this.engine.removeMaterial(this);
    }

    super.dispose();
  }
}
