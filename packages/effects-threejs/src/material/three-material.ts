import type { MaterialProps, Texture, UniformValue, MaterialDestroyOptions, UndefinedAble, Engine, math } from '@galacean/effects-core';
import { Material, maxSpriteMeshItemCount, spec } from '@galacean/effects-core';
import * as THREE from 'three';
import type { ThreeTexture } from '../three-texture';
import { CONSTANT_MAP_BLEND, CONSTANT_MAP_DEPTH, CONSTANT_MAP_STENCIL_FUNC, CONSTANT_MAP_STENCIL_OP, TEXTURE_UNIFORM_MAP } from './three-material-util';

type Matrix4 = math.Matrix4;
type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;
type Matrix3 = math.Matrix3;
type Quaternion = math.Quaternion;

/**
 * THREE 抽象材质类
 */
export class ThreeMaterial extends Material {
  /**
   * 储存纹理类型的 uniform 值
   */
  textures: Record<string, Texture> = {};
  /**
   * THREE 原始着色器材质对象
   */
  material: THREE.RawShaderMaterial = new THREE.RawShaderMaterial();
  /**
   * 储存 uniform 变量名及对应的 THREE uniform 对象
   */
  uniforms: Record<string, THREE.Uniform> = {};

  /**
   * 构造函数
   *
   * @param props - 材质属性
   */
  constructor (engine: Engine, props: MaterialProps) {
    super(props);
    const shader = props.shader;
    const { level } = engine.gpuCapability;

    for (let i = 0; i < maxSpriteMeshItemCount; i++) {
      this.uniforms[`uSampler${i}`] = new THREE.Uniform(null);
    }
    this.uniforms['uEditorTransform'] = new THREE.Uniform([1, 1, 0, 0]);
    this.uniforms['effects_ObjectToWorld'] = new THREE.Uniform(new THREE.Matrix4().identity());

    this.uniforms['effects_MatrixInvV'] = new THREE.Uniform([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 8, 1]);
    this.uniforms['effects_MatrixVP'] = new THREE.Uniform([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -8, 1]);
    this.uniforms['effects_MatrixV'] = new THREE.Uniform([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 8, 1]);

    this.material = new THREE.RawShaderMaterial({
      vertexShader: shader.vertex,
      fragmentShader: shader.fragment,
      alphaToCoverage: false,
      depthFunc: THREE.LessDepth,
      polygonOffsetFactor: THREE.ZeroFactor,
      polygonOffsetUnits: THREE.ZeroFactor,
      polygonOffset: false,
      // 创建时定义，后续更新才生效
      uniforms: this.uniforms,
    });

    if (level === 1) {
      this.material.glslVersion = THREE.GLSL1;
    } else {
      this.material.glslVersion = THREE.GLSL3;
    }

    // this.material.needsUpdate = true;

  }

  /**
   * 设置 uniform 变量值的回调函数
   *
   * @param name - uniform 变量名
   * @param value - uniform 变量值
   */
  onSetUniformValue (name: string, value: UniformValue) {
    let texture;

    if (TEXTURE_UNIFORM_MAP.includes(name)) {
      texture = (value as ThreeTexture).texture;
    }

    if (this.material.uniforms[name]) {
      this.material.uniforms[name].value = texture ? texture : value;
    } else {
      this.material.uniforms[name] = new THREE.Uniform(texture ? texture : value);
    }
  }

  /**
   * 移除 uniform 变量值的回调函数
   *
   * @param name - uniform 变量名
   */
  onRemoveUniformValue (name: string) {
    if (this.material.uniforms[name]) {
      this.material.uniforms[name].value = null;

    }
  }

  /**
   * 获取混合模式
   */
  override get blending () {
    return this.material.blending !== THREE.NoBlending;
  }
  override set blending (blending: UndefinedAble<boolean>) {
    this.material.blending = blending ? THREE.CustomBlending : THREE.NoBlending;
  }

  /**
   * 获取混合函数
   */
  override get blendFunction () {
    const {
      blendSrc, blendDst, blendSrcAlpha, blendDstAlpha,
    } = this.material;

    return [blendSrc, blendDst, blendSrcAlpha || blendSrc, blendDstAlpha || blendDst];
  }
  override set blendFunction (func: UndefinedAble<[blendSrc: number, blendDst: number, blendSrcAlpha: number, blendDstAlpha: number]>) {
    if (func) {
      const [blendSrc, blendDst, blendSrcAlpha, blendDstAlpha] = func;

      this.material.blendSrc = CONSTANT_MAP_BLEND[blendSrc];
      this.material.blendDst = CONSTANT_MAP_BLEND[blendDst];
      this.material.blendSrcAlpha = CONSTANT_MAP_BLEND[blendSrcAlpha];
      this.material.blendDstAlpha = CONSTANT_MAP_BLEND[blendDstAlpha];
    }
  }

  /**
   * 获取混合方程式
   */
  override get blendEquation () {
    const {
      blendEquation,
      blendEquationAlpha,
    } = this.material;

    return [blendEquation, blendEquationAlpha || blendEquation];
  }
  override set blendEquation (equation: UndefinedAble<[rgb: number, alpha: number]>) {
    if (equation) {
      const [rgb, alpha] = equation;

      this.material.blendEquation = rgb;
      this.material.blendEquationAlpha = alpha;
    }
  }

  /**
   * 获取深度测试结果
   */
  override get depthTest () {
    return this.material.depthTest;
  }
  override set depthTest (value: UndefinedAble<boolean>) {
    this.material.depthTest = !!(value);
  }

  /**
   * 获取深度缓冲区结果
   */
  override get depthMask () {
    return this.material.depthWrite;
  }
  override set depthMask (value: UndefinedAble<boolean>) {
    this.material.depthWrite = !!(value);
  }

  /**
   * 获取深度函数
   */
  override get depthFunc () {
    return this.material.depthFunc;
  }
  override set depthFunc (value: UndefinedAble<number>) {
    if (value !== undefined) {
      this.material.depthFunc = CONSTANT_MAP_DEPTH[value];
    }
  }

  /**
   * 获取多边形偏移开关
   */
  override get polygonOffsetFill () {
    return this.material.polygonOffset;
  }
  override set polygonOffsetFill (value: UndefinedAble<boolean>) {
    this.material.polygonOffset = !!(value);
  }

  /**
   * 获取多边形偏移
   */
  override get polygonOffset () {
    return [this.material.polygonOffsetFactor, this.material.polygonOffsetUnits];
  }
  override set polygonOffset (value: UndefinedAble<[number, number]>) {
    if (value) {
      const [factor, units] = value;

      this.material.polygonOffsetFactor = factor;
      this.material.polygonOffsetUnits = units;
    }
  }

  /**
   * 获取 alpha 抖动
   */
  override get sampleAlphaToCoverage () {
    return this.material.alphaToCoverage;
  }
  override set sampleAlphaToCoverage (value: UndefinedAble<boolean>) {
    this.material.alphaToCoverage = !!(value);
  }

  /**
   * 获取模板测试开关
   */
  override get stencilTest () {
    return this.material.stencilWrite;
  }
  override set stencilTest (value: UndefinedAble<boolean>) {
    this.material.stencilWrite = !!(value);
  }

  /**
   * 获取模板缓冲区
   */
  override get stencilMask () {
    return [this.material.stencilWriteMask, this.material.stencilWriteMask];
  }
  override set stencilMask (value: UndefinedAble<[number, number]>) {
    if (value) {
      this.material.stencilWriteMask = value[0];
    }
  }

  /**
   * 获取模板测试参考值
   */
  override get stencilRef () {
    return [this.material.stencilRef, this.material.stencilRef];
  }
  override set stencilRef (value: UndefinedAble<[number, number]>) {
    if (value) {
      this.material.stencilRef = value[0];
    }
  }

  /**
   * 获取模版函数
   */
  override get stencilFunc () {
    return [this.material.stencilFunc, this.material.stencilFunc];
  }
  override set stencilFunc (value: UndefinedAble<[number, number]>) {
    if (value) {
      this.material.stencilFunc = CONSTANT_MAP_STENCIL_FUNC[value[0]];
    }
  }

  /**
   * 获取模板测试失败后参数
   */
  override get stencilOpFail () {
    return [this.material.stencilFail, this.material.stencilZFail];
  }
  override set stencilOpFail (value: UndefinedAble<[number, number]>) {
    if (value) {
      this.material.stencilFail = CONSTANT_MAP_STENCIL_OP[value[0]];
    }
  }

  /**
   * 获取模版测试通过深度测试失败后参数
   */
  override get stencilOpZFail () {
    return [this.material.stencilZFail, this.material.stencilZFail];
  }
  override set stencilOpZFail (value: UndefinedAble<[number, number]>) {
    if (value) {
      this.material.stencilZFail = CONSTANT_MAP_STENCIL_OP[value[0]];
    }
  }

  /**
   * 获取模版测试通过并设置深度值参数
   */
  override get stencilOpZPass () {
    return [this.material.stencilZPass, this.material.stencilZPass];
  }
  override set stencilOpZPass (value: UndefinedAble<[number, number]>) {
    if (value) {
      this.material.stencilZPass = CONSTANT_MAP_STENCIL_OP[value[0]];
    }
  }

  /**
   * 获取剔除开关
   */
  override get culling () {
    return this.material.side !== THREE.DoubleSide;
  }
  override set culling (value: UndefinedAble<boolean>) {
    this.material.side = value ? THREE.FrontSide : THREE.DoubleSide;
  }

  /**
   * 获取剔除面
   */
  override get cullFace () {
    return this.material.side;
  }
  override set cullFace (value: UndefinedAble<number>) {
    if (value === spec.SideMode.FRONT) {
      this.material.side = THREE.FrontSide;
    } else if (value === spec.SideMode.BACK) {
      this.material.side = THREE.BackSide;
    }
  }

  getTexture (name: string): Texture | null {
    return this.textures[name];
  }
  setTexture (name: string, texture: Texture): void {
    this.setUniform(name, (texture as ThreeTexture).texture);
    this.textures[name] = texture;
  }

  getVector4Array (name: string): number[] {
    return this.uniforms[name].value as number[];
  }
  setVector4Array (name: string, array: Vector4[]): void {
    let value: number[] = [];

    for (const v of array) {
      value = value.concat(v.toArray());
    }

    this.setUniform(name, value);
  }

  getMatrixArray (name: string): number[] | null {
    return this.uniforms[name].value;
  }
  setMatrixArray (name: string, array: Matrix4[]): void {
    let value: number[] = [];

    for (const v of array) {
      value = value.concat(v.elements);
    }
    this.setUniform(name, value);
  }
  setMatrixNumberArray (name: string, array: number[]): void {
    this.setUniform(name, array);
  }

  getMatrix (name: string): Matrix4 | null {
    return this.uniforms[name].value;
  }
  setMatrix (name: string, value: Matrix4): void {
    this.setUniform(name, value);
  }
  setMatrix3 (name: string, value: Matrix3): void {
    this.setUniform(name, value);
  }

  getVector2 (name: string): Vector2 | null {
    return this.uniforms[name].value;
  }
  setVector2 (name: string, value: Vector2): void {
    this.setUniform(name, value);
  }

  getVector3 (name: string): Vector3 {
    return this.uniforms[name].value as Vector3;
  }
  setVector3 (name: string, value: Vector3): void {
    this.setUniform(name, value);
  }

  getVector4 (name: string): Vector4 | null {
    return this.uniforms[name].value;
  }
  setVector4 (name: string, value: Vector4): void {
    this.setUniform(name, value);
  }

  getQuaternion (name: string): Quaternion | null {
    return this.uniforms[name].value;
  }
  setQuaternion (name: string, value: Quaternion): void {
    this.setUniform(name, value);
  }

  getFloat (name: string): number | null {
    return this.uniforms[name].value as number | null;
  }
  setFloat (name: string, value: number): void {
    this.setUniform(name, value);
  }

  getFloats (name: string): number[] | null {
    return this.uniforms[name].value as number[] | null;
  }
  setFloats (name: string, value: number[]): void {
    this.setUniform(name, value);
  }

  getInt (name: string): number | null {
    return this.uniforms[name].value as number | null;
  }
  setInt (name: string, value: number): void {
    this.setUniform(name, value);
  }

  hasUniform (name: string): boolean {
    return !!this.uniforms[name];
  }

  private setUniform (name: string, value: THREE.Texture | number | number[] | Matrix4 | Matrix3 | Quaternion | Vector2 | Vector3 | Vector4 | Vector4[]) {
    const uniform = new THREE.Uniform(value);

    this.uniforms[name] = this.material.uniforms[name] = uniform;
  }

  // 下列三个方法暂时不需要实现
  enableKeyword (keyword: string): void {
    throw new Error('Method not implemented.');
  }
  disableKeyword (keyword: string): void {
    throw new Error('Method not implemented.');
  }
  isKeywordEnabled (keyword: string): boolean {
    throw new Error('Method not implemented.');
  }

  clone (props?: MaterialProps): Material {
    //FIXME: 暂时不实现
    throw new Error('Method not implemented.');
  }

  override cloneUniforms (sourceMaterial: Material): void {
    //FIXME: 暂时不实现
    throw new Error('Method not implemented.');
  }

  dispose (destroyOptions?: MaterialDestroyOptions): void {
    if (!this.destroyed) {
      return;
    }
    this.material.dispose();
    this.destroyed = true;
  }
}
