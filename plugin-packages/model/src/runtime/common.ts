import type { math } from '@galacean/effects';
import { Transform as EffectsTransform, PLAYER_OPTIONS_ENV_EDITOR, spec } from '@galacean/effects';
import {
  Quaternion,
  Euler,
  Vector3,
  Matrix4,
  EulerOrder,
} from './math';
import type { BaseTransform } from '../index';

type Euler = math.Euler;

/**
 * Model 插件中的对象类型
 */
export enum PObjectType {
  none = 0,
  mesh,
  texture,
  material,
  light,
  camera,
  skybox,
  skin,
  morph,
  skeleton,
  animation,
  animationManager,
  reference,
}

/**
 * 灯光类型
 */
export enum PLightType {
  directional = 0,
  point,
  spot,
  ambient,
}

/**
 * 纹理类型
 */
export enum PTextureType {
  none = 0,
  t2d,
  t3d,
  cube,
}

/**
 * 材质类型
 */
export enum PMaterialType {
  none = 0,
  unlit,
  pbr,
  //phong,
  normalVis,
  simpleFilter,
  shadowBase,
  shadowFilter,
  //
  skyboxFilter,
}

/**
 * 混合模式
 */
export enum PBlendMode {
  opaque = 0,
  masked,
  translucent,
  additive,
}

/**
 * 面片朝向模式
 */
export enum PFaceSideMode {
  both = 0,
  front,
  back,
}

export enum PShadowType {
  none = 0,
  standard,
  variance,
  expVariance,
}

/**
 * 插件变换类
 */
export class PTransform {
  private translation = new Vector3(0, 0, 0);
  private rotation = new Quaternion(0, 0, 0, 1);
  private scale = new Vector3(1, 1, 1);

  /**
   * 从矩阵设置数据
   * @param matrix - 4阶矩阵
   * @returns
   */
  fromMatrix4 (matrix: Matrix4) {
    this.setMatrix(matrix);

    return this;
  }

  /**
   * 从 GE 变换设置数据
   * @param trans - GE 变换对象或数据
   * @returns
   */
  fromEffectsTransform (trans: EffectsTransform | BaseTransform) {
    if (trans instanceof EffectsTransform) {
      this.setMatrix(trans.getWorldMatrix());
    } else {
      const effectsTrans = new EffectsTransform({
        ...trans,
        valid: true,
      });

      effectsTrans.setValid(true);

      this.setMatrix(effectsTrans.getWorldMatrix());
    }

    return this;
  }

  /**
   * 转成 GE 变换对象
   * @param transform - GE 变换对象
   * @returns
   */
  toEffectsTransform (transform: EffectsTransform) {
    const mat = this.getMatrix();

    transform.cloneFromMatrix(mat);

    return transform;
  }

  /**
   * 通过 GE 变换参数设置
   * @param trans - GE 变换参数
   * @returns
   */
  fromBaseTransform (trans: BaseTransform) {
    if (trans.position) {
      this.setTranslation(trans.position);
    } else {
      this.translation.set(0, 0, 0);
    }

    if (trans.rotation) {
      this.setRotation(trans.rotation);
    } else {
      this.rotation.set(0, 0, 0, 1);
    }

    if (trans.scale) {
      this.setScale(trans.scale);
    } else {
      this.scale.set(1, 1, 1);
    }

    return this;
  }

  /**
   * 获取平移
   * @returns
   */
  getTranslation (): Vector3 {
    return this.translation;
  }

  /**
   * 设置平移
   * @param val - 平移
   */
  setTranslation (val: Vector3 | spec.vec3) {
    if (val instanceof Vector3) {
      this.translation.set(val.x, val.y, val.z);
    } else {
      this.translation.set(val[0], val[1], val[2]);
    }
  }

  /**
   * 获取位置
   * @returns
   */
  getPosition (): Vector3 {
    return this.translation;
  }

  /**
   * 设置位置
   * @param val - 位置
   */
  setPosition (val: Vector3 | spec.vec3) {
    if (val instanceof Vector3) {
      this.translation.set(val.x, val.y, val.z);
    } else {
      this.translation.set(val[0], val[1], val[2]);
    }
  }

  /**
   * 获取旋转
   * @returns
   */
  getRotation (): Quaternion {
    return this.rotation;
  }

  /**
   * 设置旋转
   * @param val - 旋转，可能是四元数或欧拉角
   */
  setRotation (val: Quaternion | Euler | Vector3 | spec.vec4 | spec.vec3) {
    if (val instanceof Quaternion) {
      this.rotation.set(val.x, val.y, val.z, val.w);
    } else if (val instanceof Euler) {
      this.rotation.setFromEuler(val);
    } else if (val instanceof Vector3) {
      this.rotation.setFromEuler(new Euler(val.x, val.y, val.z, EulerOrder.ZYX));
    } else if (val.length === 4) {
      this.rotation.set(val[0], val[1], val[2], val[3]);
    } else {
      this.rotation.setFromEuler(new Euler(val[0], val[1], val[2], EulerOrder.ZYX));
    }
  }

  /**
   * 获取缩放
   * @returns
   */
  getScale (): Vector3 {
    return this.scale;
  }

  /**
   * 设置缩放
   * @param val - 缩放
   */
  setScale (val: Vector3 | spec.vec3) {
    if (val instanceof Vector3) {
      this.scale.set(val.x, val.y, val.z);
    } else {
      this.scale.set(val[0], val[1], val[2]);
    }
  }

  /**
   * 获取矩阵
   * @returns
   */
  getMatrix (): Matrix4 {
    return new Matrix4().compose(this.getTranslation(), this.getRotation(), this.getScale());
  }

  /**
   * 设置矩阵
   * @param mat - 4阶矩阵
   */
  setMatrix (mat: Matrix4 | spec.mat4) {
    if (mat instanceof Matrix4) {
      const res = mat.getTransform();

      this.setTranslation(res.translation);
      this.setRotation(res.rotation);
      this.setScale(res.scale);
    } else {
      const res = Matrix4.fromArray(mat).getTransform();

      this.setTranslation(res.translation);
      this.setRotation(res.rotation);
      this.setScale(res.scale);
    }
  }
}

/**
 * 坐标系类
 */
export class PCoordinate {
  /**
   * 原点
   */
  origin: Vector3;
  /**
   * X 轴
   */
  xAxis: Vector3;
  /**
   * Y 轴
   */
  yAxis: Vector3;
  /**
   * Z 轴
   */
  zAxis: Vector3;

  constructor () {
    this.origin = new Vector3(0, 0, 0);
    this.xAxis = new Vector3(1, 0, 0);
    this.yAxis = new Vector3(0, 1, 0);
    this.zAxis = new Vector3(0, 0, 1);
  }

  /**
   * 从插件变换创建坐标系
   * @param trans - 变换
   * @param invert - 是否旋转取反
   * @returns 坐标系对象
   */
  fromPTransform (trans: PTransform, invert = false) {
    this.origin.copyFrom(trans.getPosition());
    const rotationMatrix = trans.getRotation().toMatrix4(new Matrix4());

    if (invert) {
      rotationMatrix.invert();
    }
    this.fromRotationMatrix(rotationMatrix);

    return this;
  }

  /**
   * 从旋转矩阵创建坐标系
   * @param matrix - 矩阵
   */
  fromRotationMatrix (matrix: Matrix4) {
    const me = matrix.elements;

    this.xAxis.set(me[0], me[1], me[2]);
    this.yAxis.set(me[4], me[5], me[6]);
    this.zAxis.set(me[8], me[9], me[10]);
  }
}

/**
 * 全局状态
 */
export class PGlobalState {
  /**
   * 是否 WebGL2
   */
  isWebGL2: boolean;
  /**
   * 是否共享 Shader
   */
  shaderShared: boolean;
  /**
   * 运行时环境，编辑器模式或设备模式
   */
  runtimeEnv: string;
  /**
   * 兼容模式，glTF 模式或 Tiny3d 模式
   */
  compatibleMode: string;
  /**
   * 是否显示包围盒
   */
  visBoundingBox: boolean;
  /**
   * 渲染输出结果模式，可以换中间渲染数据
   */
  renderMode3D: spec.RenderMode3D;
  /**
   * UV结果输出时，棋盘格的大小控制，范围(0, 1)
   */
  renderMode3DUVGridSize: number;

  // singleton related code
  private static instance: PGlobalState;

  /**
   * 获取单例
   * @returns
   */
  static getInstance (): PGlobalState {
    // Do you need arguments? Make it a regular static method instead.
    return this.instance || (this.instance = new this());
  }

  private constructor () {
    this.isWebGL2 = false;
    this.shaderShared = true;
    this.runtimeEnv = PLAYER_OPTIONS_ENV_EDITOR;
    this.compatibleMode = 'gltf';
    this.visBoundingBox = false;
    this.renderMode3D = spec.RenderMode3D.none;
    this.renderMode3DUVGridSize = 1 / 16;
  }

  /**
   * 重置数据
   */
  reset () {
    this.isWebGL2 = false;
    this.shaderShared = true;
    this.runtimeEnv = PLAYER_OPTIONS_ENV_EDITOR;
    this.compatibleMode = 'gltf';
    this.visBoundingBox = false;
    this.renderMode3D = spec.RenderMode3D.none;
    this.renderMode3DUVGridSize = 1 / 16;
  }

  /**
   * 是否可视化渲染中间结果
   */
  hasRenderMode3D () {
    return this.renderMode3D !== spec.RenderMode3D.none;
  }

  /**
   * 是否编辑器模式
   */
  get isEditorEnv () {
    return this.runtimeEnv === PLAYER_OPTIONS_ENV_EDITOR;
  }

  /**
   * 是否设备模式
   */
  get isDeviceEnv () {
    return !this.isEditorEnv;
  }

  /**
   * 是否 Tiny3d 模式
   */
  get isTiny3dMode () {
    return this.compatibleMode === 'tiny3d';
  }

  /**
   * 是否 glTF 模式
   */
  get isGLTFMode () {
    return !this.isTiny3dMode;
  }
}

