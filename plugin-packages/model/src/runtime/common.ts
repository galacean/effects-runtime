import { Transform as EffectsTransform, PLAYER_OPTIONS_ENV_EDITOR, spec } from '@galacean/effects';
import {
  Quaternion,
  Euler,
  Vector3,
  Matrix4,
  EulerOrder,
} from './math';
import type { BaseTransform } from '../index';

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

export enum PLightType {
  directional = 0,
  point,
  spot,
  ambient,
}

export enum PTextureType {
  none = 0,
  t2d,
  t3d,
  cube,
}

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

export enum PBlendMode {
  opaque = 0,
  masked,
  translucent,
  additive,
}

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

export class PTransform {
  private translation = new Vector3(0, 0, 0);
  private rotation = new Quaternion(0, 0, 0, 1);
  private scale = new Vector3(1, 1, 1);

  fromMatrix4 (matrix: Matrix4) {
    this.setMatrix(matrix);

    return this;
  }

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

  toEffectsTransform (transform: EffectsTransform) {
    const mat = this.getMatrix();

    transform.cloneFromMatrix(mat);

    return transform;
  }

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

  getTranslation (): Vector3 {
    return this.translation;
  }

  setTranslation (val: Vector3 | spec.vec3) {
    if (val instanceof Vector3) {
      this.translation.set(val.x, val.y, val.z);
    } else {
      this.translation.set(val[0], val[1], val[2]);
    }
  }

  getPosition (): Vector3 {
    return this.translation;
  }

  setPosition (val: Vector3 | spec.vec3) {
    if (val instanceof Vector3) {
      this.translation.set(val.x, val.y, val.z);
    } else {
      this.translation.set(val[0], val[1], val[2]);
    }
  }

  getRotation (): Quaternion {
    return this.rotation;
  }

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

  getScale (): Vector3 {
    return this.scale;
  }

  setScale (val: Vector3 | spec.vec3) {
    if (val instanceof Vector3) {
      this.scale.set(val.x, val.y, val.z);
    } else {
      this.scale.set(val[0], val[1], val[2]);
    }
  }

  getMatrix (): Matrix4 {
    return new Matrix4().compose(this.getTranslation(), this.getRotation(), this.getScale());
  }

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

export class PCoordinate {
  origin: Vector3;
  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;

  constructor () {
    this.origin = new Vector3(0, 0, 0);
    this.xAxis = new Vector3(1, 0, 0);
    this.yAxis = new Vector3(0, 1, 0);
    this.zAxis = new Vector3(0, 0, 1);
  }

  fromPTransform (trans: PTransform, invert = false) {
    this.origin.copyFrom(trans.getPosition());
    const rotationMatrix = trans.getRotation().toMatrix4(new Matrix4());

    if (invert) {
      rotationMatrix.invert();
    }
    this.fromRotationMatrix(rotationMatrix);

    return this;
  }

  fromRotationMatrix (matrix: Matrix4) {
    const me = matrix.elements;

    this.xAxis.set(me[0], me[1], me[2]);
    this.yAxis.set(me[4], me[5], me[6]);
    this.zAxis.set(me[8], me[9], me[10]);
  }
}

export class PGlobalState {
  isWebGL2: boolean;
  shaderShared: boolean;
  runtimeEnv: string;
  compatibleMode: string;
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

  get isEditorEnv () {
    return this.runtimeEnv === PLAYER_OPTIONS_ENV_EDITOR;
  }

  get isDeviceEnv () {
    return !this.isEditorEnv;
  }

  get isTiny3dMode () {
    return this.compatibleMode === 'tiny3d';
  }

  get isOasisMode () {
    return this.compatibleMode === 'oasis';
  }

  get isGLTFMode () {
    return !this.isTiny3dMode && !this.isOasisMode;
  }
}

