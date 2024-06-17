import type {
  Engine, GlobalUniforms, MaterialDestroyOptions, MaterialProps, MaterialStates,
  Renderer, Texture, UndefinedAble,
} from '@galacean/effects-core';
import {
  spec, DestroyOptions, Material, Shader, assertExist, generateGUID, isFunction, logger,
  math, throwDestroyedError,
} from '@galacean/effects-core';
import type { GLEngine } from './gl-engine';
import { GLMaterialState } from './gl-material-state';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLShaderVariant } from './gl-shader';
import type { GLTexture } from './gl-texture';

type Color = math.Color;
type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;
type Matrix3 = math.Matrix3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

const { Vector4, Matrix4 } = math;

export class GLMaterial extends Material {
  shaderVariant: GLShaderVariant;

  // material存放的uniform数据。
  private floats: Record<string, number> = {};
  private ints: Record<string, number> = {};
  private vector2s: Record<string, Vector2> = {};
  private vector3s: Record<string, Vector3> = {};
  private vector4s: Record<string, Vector4> = {};
  private colors: Record<string, Color> = {};
  private quaternions: Record<string, Quaternion> = {};
  private matrices: Record<string, Matrix4> = {};
  private matrice3s: Record<string, Matrix3> = {};
  private textures: Record<string, Texture> = {};
  private floatArrays: Record<string, number[]> = {};
  private vector4Arrays: Record<string, number[]> = {};
  private matrixArrays: Record<string, number[]> = {};

  private samplers: string[] = [];  // material存放的sampler名称。
  private uniforms: string[] = [];  // material存放的uniform名称（不包括sampler）。

  private uniformDirtyFlag = true;
  private macrosDirtyFlag = true;
  private readonly macros: Record<string, number | boolean> = {};
  private glMaterialState = new GLMaterialState();

  constructor (
    engine: Engine,
    props?: MaterialProps,
  ) {
    super(engine, props);
    if (props) {
      this.shader = new Shader(engine);
      this.shader.shaderData = {
        ...props.shader,
        id: generateGUID(),
        dataType: spec.DataType.Shader,
      };
    }
  }

  override get blending () {
    return this.glMaterialState.blending;
  }
  override set blending (blending: UndefinedAble<boolean>) {
    blending !== undefined && this.glMaterialState.setBlending(blending);
  }

  override get blendColor () {
    return this.glMaterialState.blendColor;
  }
  override set blendColor (color: UndefinedAble<[r: number, g: number, b: number, a: number]>) {
    color && this.glMaterialState.setBlendColor(color);
  }

  override get blendFunction () {
    return this.glMaterialState.blendFunctionParameters;
  }
  override set blendFunction (func: UndefinedAble<[blendSrc: number, blendDst: number, blendSrcAlpha: number, blendDstAlpha: number]>) {
    func && this.glMaterialState.setBlendFunctionParameters(func);
  }

  override get blendEquation () {
    return this.glMaterialState.blendEquationParameters;
  }
  override set blendEquation (equation: UndefinedAble<[rgb: number, alpha: number]>) {
    equation && this.glMaterialState.setBlendEquationParameters(equation);
  }

  override get depthTest () {
    return this.glMaterialState.depthTest;
  }
  override set depthTest (value: UndefinedAble<boolean>) {
    value !== undefined && this.glMaterialState.setDepthTest(value);
  }

  override get depthMask () {
    return this.glMaterialState.depthMask;
  }
  override set depthMask (value: UndefinedAble<boolean>) {
    value !== undefined && this.glMaterialState.setDepthMask(value);
  }

  override get depthRange () {
    return this.glMaterialState.depthRange;
  }
  override set depthRange (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setDepthRange(value);
  }

  override get depthFunc () {
    return this.glMaterialState.depthFunc;
  }
  override set depthFunc (value: UndefinedAble<number>) {
    value !== undefined && this.glMaterialState.setDepthFunc(value);
  }

  override get polygonOffsetFill () {
    return this.glMaterialState.polygonOffsetFill;
  }
  override set polygonOffsetFill (value: UndefinedAble<boolean>) {
    value !== undefined && this.glMaterialState.setPolygonOffsetFill(value);
  }

  override get polygonOffset () {
    return this.glMaterialState.polygonOffset;
  }
  override set polygonOffset (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setPolygonOffset(value);
  }

  override get sampleAlphaToCoverage () {
    return this.glMaterialState.sampleAlphaToCoverage;
  }
  override set sampleAlphaToCoverage (value: UndefinedAble<boolean>) {
    value !== undefined && this.glMaterialState.setSampleAlphaToCoverage(value);
  }

  override get colorMask () {
    return this.glMaterialState.colorMask;
  }
  override set colorMask (value: UndefinedAble<[r: boolean, g: boolean, b: boolean, a: boolean]>) {
    value && this.glMaterialState.setColorMask(value);
  }

  override get stencilTest () {
    return this.glMaterialState.stencilTest;
  }
  override set stencilTest (value: UndefinedAble<boolean>) {
    value !== undefined && this.glMaterialState.setStencilTest(value);
  }

  override get stencilMask () {
    return this.glMaterialState.stencilMask;
  }
  override set stencilMask (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setStencilMask(value);
  }

  override get stencilRef () {
    return this.glMaterialState.stencilRef;
  }
  override set stencilRef (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setStencilRef(value);
  }

  override get stencilFunc () {
    return this.glMaterialState.stencilFunc;
  }
  override set stencilFunc (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setStencilFunc(value);
  }

  override get stencilOpFail () {
    return this.glMaterialState.stencilOpFail;
  }
  override set stencilOpFail (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setStencilOpFail(value);
  }

  override get stencilOpZFail () {
    return this.glMaterialState.stencilOpZFail;
  }
  override set stencilOpZFail (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setStencilOpZFail(value);
  }

  override get stencilOpZPass () {
    return this.glMaterialState.stencilOpZPass;
  }
  override set stencilOpZPass (value: UndefinedAble<[number, number]>) {
    value && this.glMaterialState.setStencilOpZPass(value);
  }

  override get culling () {
    return this.glMaterialState.culling;
  }
  override set culling (value: UndefinedAble<boolean>) {
    value !== undefined && this.glMaterialState.setCulling(value);
  }

  override get frontFace () {
    return this.glMaterialState.frontFace;
  }
  override set frontFace (value: UndefinedAble<number>) {
    value !== undefined && this.glMaterialState.setFrontFace(value);
  }

  override get cullFace () {
    return this.glMaterialState.cullFace;
  }
  override set cullFace (value: UndefinedAble<number>) {
    value !== undefined && this.glMaterialState.setCullFace(value);
  }

  override enableMacro (keyword: string, value?: boolean | number): void {
    if (!this.isMacroEnabled(keyword) || this.macros[keyword] !== value) {
      this.macros[keyword] = value ?? true;
      this.macrosDirtyFlag = true;
    }
  }

  override disableMacro (keyword: string): void {
    if (this.isMacroEnabled(keyword)) {
      delete this.macros[keyword];
      this.macrosDirtyFlag = true;
    }
  }

  override isMacroEnabled (keyword: string): boolean {
    return this.macros[keyword] !== undefined;
  }

  // TODO 待废弃 兼容 model/spine 插件 改造后可移除
  createMaterialStates (states: MaterialStates): void {
    this.sampleAlphaToCoverage = !!(states.sampleAlphaToCoverage);
    this.depthTest = states.depthTest;
    this.depthMask = states.depthMask;
    this.depthRange = states.depthRange;
    this.depthFunc = states.depthFunc;
    this.colorMask = states.colorMask;
    this.polygonOffset = states.polygonOffset;
    this.polygonOffsetFill = states.polygonOffsetFill;
    this.blending = states.blending;
    this.blendFunction = states.blendFunction;
    this.stencilTest = states.stencilTest;
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  /**shader和texture的GPU资源初始化。 */
  override initialize (): void {
    if (this.initialized) {
      return;
    }
    const glEngine = this.engine as GLEngine;

    glEngine.addMaterial(this);
    if (!this.shaderVariant || this.shaderVariant.shader !== this.shader || this.macrosDirtyFlag) {
      this.shaderVariant = this.shader.createVariant(this.macros) as GLShaderVariant;
      this.macrosDirtyFlag = false;
    }
    this.shaderVariant.initialize(glEngine);
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

  setupStates (pipelineContext: GLPipelineContext) {
    this.glMaterialState.apply(pipelineContext);
  }

  override use (renderer: Renderer, globalUniforms?: GlobalUniforms) {
    const engine = renderer.engine as GLEngine;
    const pipelineContext = engine.getGLPipelineContext();

    if (!this.shaderVariant.program) {
      this.engine?.renderErrors.add(new Error('Shader program is not initialized.'));

      return;
    }
    this.shaderVariant.program.bind();
    this.setupStates(pipelineContext);
    let name: string;

    if (globalUniforms) {
      // 加入全局 uniform 名称
      for (name of globalUniforms.uniforms) {
        this.checkUniform(name);
      }
      for (name of globalUniforms.samplers) {
        if (!this.samplers.includes(name)) {
          this.samplers.push(name);
          this.uniformDirtyFlag = true;
        }
      }
    }

    // 更新 cached uniform location
    if (this.uniformDirtyFlag) {
      this.shaderVariant.fillShaderInformation(this.uniforms, this.samplers);
      this.uniformDirtyFlag = false;
    }

    if (globalUniforms) {
      // 设置全局 uniform
      for (name in globalUniforms.floats) {
        this.shaderVariant.setFloat(name, globalUniforms.floats[name]);
      }
      for (name in globalUniforms.ints) {
        this.shaderVariant.setInt(name, globalUniforms.ints[name]);
      }
      for (name in globalUniforms.matrices) {
        this.shaderVariant.setMatrix(name, globalUniforms.matrices[name]);
      }
    }

    // 检查贴图数据是否初始化。
    for (name in this.textures) {
      if (!(this.textures[name] as GLTexture).textureBuffer) {
        this.textures[name].initialize();
      }
    }
    for (name in this.floats) {
      this.shaderVariant.setFloat(name, this.floats[name]);
    }
    for (name in this.ints) {
      this.shaderVariant.setInt(name, this.ints[name]);
    }
    for (name in this.floatArrays) {
      this.shaderVariant.setFloats(name, this.floatArrays[name]);
    }
    for (name in this.textures) {
      this.shaderVariant.setTexture(name, this.textures[name]);
    }
    for (name in this.vector2s) {
      this.shaderVariant.setVector2(name, this.vector2s[name]);
    }
    for (name in this.vector3s) {
      this.shaderVariant.setVector3(name, this.vector3s[name]);
    }
    for (name in this.vector4s) {
      this.shaderVariant.setVector4(name, this.vector4s[name]);
    }
    for (name in this.colors) {
      this.shaderVariant.setColor(name, this.colors[name]);
    }
    for (name in this.quaternions) {
      this.shaderVariant.setQuaternion(name, this.quaternions[name]);
    }
    for (name in this.matrices) {
      this.shaderVariant.setMatrix(name, this.matrices[name]);
    }
    for (name in this.matrice3s) {
      this.shaderVariant.setMatrix3(name, this.matrice3s[name]);
    }
    for (name in this.vector4Arrays) {
      this.shaderVariant.setVector4Array(name, this.vector4Arrays[name]);
    }
    for (name in this.matrixArrays) {
      this.shaderVariant.setMatrixArray(name, this.matrixArrays[name]);
    }
  }

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
      this.uniformDirtyFlag = true;
    }
    this.textures[name] = texture;
  }

  hasUniform (name: string): boolean {
    return this.uniforms.includes(name) || this.samplers.includes(name);
  }

  clone (props?: MaterialProps): Material {
    const newProps = props ? props : this.props;
    const engine = this.engine;

    assertExist(engine);
    const clonedMaterial = new GLMaterial(engine, newProps);

    // TODO: 更换 Object.assign，低端设备兼容问题
    clonedMaterial.glMaterialState = Object.assign(new GLMaterialState(), clonedMaterial.glMaterialState);
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
    clonedMaterial.uniformDirtyFlag = true;

    return clonedMaterial;
  }

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
      blending: false,
      zTest: false,
      zWrite: false,
      ...data,
    };

    this.blending = propertiesData.blending;
    this.depthTest = propertiesData.zTest;
    this.depthMask = propertiesData.zWrite;

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

      // TODO 纹理通过 id 加入场景数据
      this.setTexture(name, textureProperties.texture as Texture);
      const offset = textureProperties.offset;
      const scale = textureProperties.scale;

      if (offset && scale) {
        this.setVector4(name + '_ST', new Vector4(scale.x, scale.y, offset.x, offset.y));
      }
    }

    if (data.shader) {
      this.shader = data.shader as unknown as Shader;
      this.shaderSource = this.shader.shaderData;
    }
    this.stringTags = data.stringTags ?? {};
    this.initialized = false;
  }

  /**
   * @since 2.0.0
   * @param sceneData
   * @returns
   */
  override toData (): spec.MaterialData {
    // @ts-expect-error
    const materialData: spec.MaterialData = this.taggedProperties;

    if (this.shader) {
      // @ts-expect-error
      materialData.shader = this.shader;
    }
    materialData.floats = {};
    materialData.ints = {};
    materialData.vector4s = {};
    materialData.dataType = spec.DataType.Material;
    if (this.blending) {
      materialData.blending = this.blending;
    }
    if (this.depthTest) {
      materialData.zTest = this.depthTest;
    }
    if (this.depthMask) {
      materialData.zWrite = this.depthMask;
    }

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

    return materialData;
  }

  override cloneUniforms (sourceMaterial: Material): void {
    const material = sourceMaterial as GLMaterial;
    let name: string;

    for (name in material.floats) {
      this.setFloat(name, material.floats[name]);
    }
    for (name in material.ints) {
      this.setInt(name, material.ints[name]);
    }
    for (name in material.floatArrays) {
      this.setFloats(name, material.floatArrays[name]);
    }
    for (name in material.textures) {
      this.setTexture(name, material.textures[name]);
    }
    for (name in material.vector2s) {
      this.setVector2(name, material.vector2s[name]);
    }
    for (name in material.vector3s) {
      this.setVector3(name, material.vector3s[name]);
    }
    for (name in material.vector4s) {
      this.setVector4(name, material.vector4s[name]);
    }
    for (name in material.colors) {
      this.setColor(name, material.colors[name]);
    }
    for (name in material.quaternions) {
      this.setQuaternion(name, material.quaternions[name]);
    }
    for (name in material.matrices) {
      this.setMatrix(name, material.matrices[name]);
    }
    for (name in material.vector4Arrays) {
      const vec4Array: Vector4[] = [];

      for (let i = 0; i < material.vector4Arrays[name].length; i += 4) {
        vec4Array.push(new Vector4(
          material.vector4Arrays[name][i],
          material.vector4Arrays[name][i + 1],
          material.vector4Arrays[name][i + 2],
          material.vector4Arrays[name][i + 3],
        ));
      }
      this.setVector4Array(name, vec4Array);
    }
    for (name in material.matrixArrays) {
      const mat4Array: Matrix4[] = [];

      for (let i = 0; i < material.matrixArrays[name].length; i += 16) {
        const matrix = Matrix4.fromIdentity();

        for (let j = 0; j < 16; j++) {
          matrix.elements[j] = (material.matrixArrays[name][i + j]);
        }
        mat4Array.push(matrix);
      }
      this.setMatrixArray(name, mat4Array);
    }
  }

  private checkUniform (uniformName: string): void {
    if (!this.uniforms.includes(uniformName)) {
      this.uniforms.push(uniformName);
      this.uniformDirtyFlag = true;
    }
  }

  dispose (options?: MaterialDestroyOptions) {
    if (this.destroyed) {
      return;
    }
    this.shaderVariant?.dispose();
    if (options?.textures !== DestroyOptions.keep) {
      Object.keys(this.textures).forEach(key => {
        const texture = this.textures[key];

        // TODO 纹理释放需要引用计数
        if (texture !== this.engine.emptyTexture) {
          texture.dispose();
        }
      });
    }

    // @ts-expect-error
    this.shaderSource = null;
    // @ts-expect-error
    this.uniformSemantics = {};
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
    this.initialize = throwDestroyedError as unknown as () => GLMaterial;
    this.destroyed = true;

    if (this.engine !== undefined) {
      this.engine.removeMaterial(this);
    }
  }
}
