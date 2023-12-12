import type {
  MaterialDestroyOptions,
  MaterialProps,
  MaterialStates,
  UndefinedAble,
  Texture,
  Engine,
  GlobalUniforms,
} from '@galacean/effects-core';
import { DestroyOptions, Material, assertExist, throwDestroyedError, math } from '@galacean/effects-core';
import { GLMaterialState } from './gl-material-state';
import type { GLPipelineContext } from './gl-pipeline-context';
import type { GLShader } from './gl-shader';
import type { GLTexture } from './gl-texture';
import type { GLEngine } from './gl-engine';
import type { GLRenderer } from './gl-renderer';

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;
type Matrix3 = math.Matrix3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

const { Vector4, Matrix4 } = math;

export class GLMaterial extends Material {
  shader: GLShader;

  // material存放的uniform数据。
  floats: Record<string, number> = {};
  ints: Record<string, number> = {};
  vector2s: Record<string, Vector2> = {};
  vector3s: Record<string, Vector3> = {};
  vector4s: Record<string, Vector4> = {};
  quaternions: Record<string, Quaternion> = {};
  matrices: Record<string, Matrix4> = {};
  matrice3s: Record<string, Matrix3> = {};
  textures: Record<string, Texture> = {};
  floatArrays: Record<string, number[]> = {};
  vector4Arrays: Record<string, number[]> = {};
  matrixArrays: Record<string, number[]> = {};

  samplers: string[] = [];  // material存放的sampler名称。
  uniforms: string[] = [];  // material存放的uniform名称（不包括sampler）。

  uniformDirtyFlag = true;
  glMaterialState = new GLMaterialState();

  private engine?: Engine;

  constructor (engine: Engine, props: MaterialProps) {
    super(props);

    this.engine = engine;
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

  enableKeyword (keyword: string): void {
    throw new Error('Method not implemented.');
  }
  disableKeyword (keyword: string): void {
    throw new Error('Method not implemented.');
  }
  isKeywordEnabled (keyword: string): boolean {
    throw new Error('Method not implemented.');
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
    if (!this.shader) {
      const pipelineContext = glEngine.getGLPipelineContext();

      this.shader = pipelineContext.shaderLibrary.createShader(this.shaderSource);
    }
    this.shader.initialize(glEngine);
    for (const texture of Object.values(this.textures)) {
      texture.initialize();
    }
    this.initialized = true;
  }

  setupStates (pipelineContext: GLPipelineContext) {
    this.glMaterialState.apply(pipelineContext);
  }

  public override use (renderer: GLRenderer, globalUniforms?: GlobalUniforms) {
    const engine = renderer.engine as GLEngine;
    const pipelineContext = engine.getGLPipelineContext();

    this.shader.program.bind();
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
      this.shader.fillShaderInformation(this.uniforms, this.samplers);
      this.uniformDirtyFlag = false;
    }

    if (globalUniforms) {
      // 设置全局 uniform
      for (name in globalUniforms.floats) {
        this.shader.setFloat(name, globalUniforms.floats[name]);
      }
      for (name in globalUniforms.ints) {
        this.shader.setInt(name, globalUniforms.ints[name]);
      }
      for (name in globalUniforms.matrices) {
        this.shader.setMatrix(name, globalUniforms.matrices[name]);
      }
    }

    // 检查贴图数据是否初始化。
    for (name in this.textures) {
      if (!(this.textures[name] as GLTexture).textureBuffer) {
        this.textures[name].initialize();
      }
    }
    for (name in this.floats) {
      this.shader.setFloat(name, this.floats[name]);
    }
    for (name in this.ints) {
      this.shader.setInt(name, this.ints[name]);
    }
    for (name in this.floatArrays) {
      this.shader.setFloats(name, this.floatArrays[name]);
    }
    for (name in this.textures) {
      this.shader.setTexture(name, this.textures[name]);
    }
    for (name in this.vector2s) {
      this.shader.setVector2(name, this.vector2s[name]);
    }
    for (name in this.vector3s) {
      this.shader.setVector3(name, this.vector3s[name]);
    }
    for (name in this.vector4s) {
      this.shader.setVector4(name, this.vector4s[name]);
    }
    for (name in this.quaternions) {
      this.shader.setQuaternion(name, this.quaternions[name]);
    }
    for (name in this.matrices) {
      this.shader.setMatrix(name, this.matrices[name]);
    }
    for (name in this.matrice3s) {
      this.shader.setMatrix3(name, this.matrice3s[name]);
    }
    for (name in this.vector4Arrays) {
      this.shader.setVector4Array(name, this.vector4Arrays[name]);
    }
    for (name in this.matrixArrays) {
      this.shader.setMatrixArray(name, this.matrixArrays[name]);
    }
  }

  public getFloat (name: string): number | null {
    return this.floats[name];
  }
  public setFloat (name: string, value: number) {
    this.checkUniform(name);
    this.floats[name] = value;
  }

  public getInt (name: string): number | null {
    return this.ints[name];
  }
  public setInt (name: string, value: number) {
    this.checkUniform(name);
    this.ints[name] = value;
  }

  public getFloats (name: string): number[] | null {
    return this.floatArrays[name];
  }
  public setFloats (name: string, value: number[]) {
    this.checkUniform(name);
    this.floatArrays[name] = value;
  }

  public getVector2 (name: string): Vector2 | null {
    return this.vector2s[name];
  }
  public setVector2 (name: string, value: Vector2): void {
    this.checkUniform(name);
    this.vector2s[name] = value;
  }

  public getVector3 (name: string): Vector3 | null {
    return this.vector3s[name];
  }
  public setVector3 (name: string, value: Vector3): void {
    this.checkUniform(name);
    this.vector3s[name] = value;
  }

  public getVector4 (name: string): Vector4 | null {
    return this.vector4s[name];
  }
  public setVector4 (name: string, value: Vector4): void {
    this.checkUniform(name);
    this.vector4s[name] = value;
  }

  public getQuaternion (name: string): Quaternion | null {
    return this.quaternions[name];
  }
  public setQuaternion (name: string, value: Quaternion): void {
    this.checkUniform(name);
    this.quaternions[name] = value;
  }

  public getMatrix (name: string): Matrix4 | null {
    return this.matrices[name];
  }
  public setMatrix (name: string, value: Matrix4): void {
    this.checkUniform(name);
    this.matrices[name] = value;
  }
  public setMatrix3 (name: string, value: Matrix3): void {
    this.checkUniform(name);
    this.matrice3s[name] = value;
  }

  public getVector4Array (name: string): number[] {
    return this.vector4Arrays[name];
  }
  public setVector4Array (name: string, array: Vector4[]): void {
    this.checkUniform(name);
    this.vector4Arrays[name] = [];
    for (const v of array) {
      this.vector4Arrays[name].push(v.x, v.y, v.z, v.w);
    }
  }

  public getMatrixArray (name: string): number[] | null {
    return this.matrixArrays[name];
  }
  public setMatrixArray (name: string, array: Matrix4[]): void {
    this.checkUniform(name);
    this.matrixArrays[name] = [];
    for (const m of array) {
      for (let i = 0; i < 16; i++) {
        this.matrixArrays[name].push(m.elements[i]);
      }
    }
  }
  public setMatrixNumberArray (name: string, array: number[]): void {
    this.checkUniform(name);
    this.matrixArrays[name] = array;
  }

  public getTexture (name: string): Texture | null {
    return this.textures[name];
  }
  public setTexture (name: string, texture: Texture) {
    if (!this.samplers.includes(name)) {
      this.samplers.push(name);
      this.uniformDirtyFlag = true;
    }
    this.textures[name] = texture;
  }

  public hasUniform (name: string): boolean {
    return this.uniforms.includes(name) || this.samplers.includes(name);
  }

  public clone (props?: MaterialProps): Material {
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
    this.shader?.dispose();
    if (options?.textures !== DestroyOptions.keep) {
      for (const texture of Object.values(this.textures)) {
        texture.dispose();
      }
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
      this.engine = undefined;
    }
  }
}
