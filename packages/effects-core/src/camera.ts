import * as spec from '@galacean/effects-specification';
import { Matrix4, Vector3, Euler, Quaternion, DEG2RAD } from '@galacean/effects-math/es/core/index';
import { Transform } from './transform';

interface CameraOptionsBase {
  /**
   * 相机近平面
   */
  near: number,
  /**
   * 相机远平面
   */
  far: number,
  /**
   * 视锥体垂直视野角度
   */
  fov: number,
  /**
   * 视锥体的长宽比
   */
  aspect: number,
  /**
   * 相机的裁剪模式
   */
  clipMode: spec.CameraClipMode,
}

/**
 *
 */
export interface CameraOptions extends CameraOptionsBase {
  /**
   * 相机的位置
   */
  position: spec.vec3,
  /**
   * 相机的旋转，欧拉角
   */
  rotation: spec.vec3,
  /**
   * 相机的旋转，四元数
   */
  quat?: spec.vec4,
}

export interface CameraOptionsEx extends CameraOptionsBase {
  /**
   * 相机的位置
   */
  position: Vector3,
  /**
   * 相机的旋转，欧拉角
   */
  rotation: Euler,
  /**
   * 相机的旋转，四元数
   */
  quat?: Quaternion,
}

const tmpScale = new Vector3(1, 1, 1);

/**
 * 合成的相机对象，采用透视投影
 */
export class Camera {
  private options: CameraOptionsEx;
  private viewMatrix = Matrix4.fromIdentity();
  private projectionMatrix = Matrix4.fromIdentity();
  private viewProjectionMatrix = Matrix4.fromIdentity();
  private inverseViewMatrix = Matrix4.fromIdentity();
  private inverseProjectionMatrix: Matrix4 | null;
  private inverseViewProjectionMatrix: Matrix4 | null;
  private dirty = true;

  /**
   *
   * @param name - 相机名称
   * @param options
   */
  constructor (
    public name: string,
    options: Partial<CameraOptions> = {},
  ) {
    const {
      near = 0.1,
      far = 20,
      fov = 60,
      aspect = 1,
      clipMode = spec.CameraClipMode.portrait,
      position = [0, 0, 8],
      rotation = [0, 0, 0],
    } = options;

    this.options = {
      near, far, fov, aspect, clipMode,
      position: Vector3.fromArray(position),
      rotation: Euler.fromArray(rotation),
    };
    this.dirty = true;
    this.updateMatrix();
  }

  /**
   * 设置相机近平面
   * @param near
   */
  set near (near: number) {
    if (this.options.near !== near) {
      this.options.near = near;
      this.dirty = true;
    }
  }
  get near (): number {
    return this.options.near;
  }

  /**
   * 设置相机远平面
   * @param far
   */
  set far (far: number) {
    if (this.options.far !== far) {
      this.options.far = far;
      this.dirty = true;
    }
  }
  get far (): number {
    return this.options.far;
  }

  /**
   * 设置相机视锥体垂直视野角度
   * @param fov
   */
  set fov (fov: number) {
    if (this.options.fov !== fov) {
      this.options.fov = fov;
      this.dirty = true;
    }
  }
  get fov () {
    return this.options.fov;
  }

  /**
   * 设置相机视锥体的长宽比
   * @param aspect
   */
  set aspect (aspect: number) {
    if (this.options.aspect !== aspect) {
      this.options.aspect = aspect;
      this.dirty = true;
    }
  }
  get aspect () {
    return this.options.aspect;
  }

  /**
   * 相机的裁剪模式
   * @param clipMode
   */
  set clipMode (clipMode: spec.CameraClipMode | undefined) {
    if (clipMode !== undefined && this.options.clipMode !== clipMode) {
      this.options.clipMode = clipMode;
      this.dirty = true;
    }

  }
  get clipMode () {
    return this.options.clipMode;
  }

  /**
   * 设置相机的位置
   * @param value
   */
  set position (value: Vector3) {
    if (!this.options.position.equals(value)) {
      this.options.position.copyFrom(value);
      this.dirty = true;
    }
  }
  get position () {
    return this.options.position.clone();
  }

  /**
   * 设置相机的旋转角度
   * @param value
   */
  set rotation (value: Euler) {
    if (!this.options.rotation.equals(value)) {
      this.options.rotation.copyFrom(value);
      this.dirty = true;
      this.options.quat = undefined;
    }
  }
  get rotation () {
    return this.options.rotation.clone();
  }

  /**
   * 获取相机的视图变换矩阵
   * @return
   */
  getViewMatrix (): Matrix4 {
    this.updateMatrix();

    return this.viewMatrix.clone();
  }

  /**
   * 获取视图变换的逆矩阵
   */
  getInverseViewMatrix (): Matrix4 {
    this.updateMatrix();

    return this.inverseViewMatrix.clone();
  }

  /**
   * 获取相机的投影矩阵
   * @return
   */
  getProjectionMatrix (): Matrix4 {
    this.updateMatrix();

    return this.projectionMatrix.clone();
  }

  /**
   * 获取相机投影矩阵的逆矩阵
   * @return
   */
  getInverseProjectionMatrix (): Matrix4 {
    this.updateMatrix();

    return this.inverseProjectionMatrix?.clone() as Matrix4;
  }

  /**
   * 获取相机的 VP 矩阵
   * @return
   */
  getViewProjectionMatrix (): Matrix4 {
    this.updateMatrix();

    return this.viewProjectionMatrix.clone();
  }

  /**
   * 获取相机 VP 矩阵的逆矩阵
   * @return
   */
  getInverseViewProjectionMatrix (): Matrix4 {
    this.updateMatrix();
    if (!this.inverseViewProjectionMatrix) {
      this.inverseViewProjectionMatrix = this.viewProjectionMatrix.clone();
      this.inverseViewProjectionMatrix.invert();
    }

    return this.inverseViewProjectionMatrix.clone();
  }

  /**
   * 根据相机的视图投影矩阵对指定模型矩阵做变换
   * @param out - 结果矩阵
   * @param model - 模型变换矩阵
   */
  getModelViewProjection (out: Matrix4, model: Matrix4) {
    return out.multiplyMatrices(this.viewProjectionMatrix, model);
  }

  /**
   * 获取归一化坐标和 3D 世界坐标的换算比例
   * @param z - 当前的位置 z
   */
  getInverseVPRatio (z: number) {
    const pos = new Vector3(0, 0, z);
    const mat = this.getViewProjectionMatrix();
    const { z: nz } = pos.applyMatrix(mat);

    return new Vector3(1, 1, nz).applyMatrix(mat);
  }

  /**
   * 设置相机的旋转四元数
   * @param value - 旋转四元数
   */
  setQuat (value: Quaternion) {
    if (this.options.quat === undefined) {
      this.options.quat = value.clone();
      this.dirty = true;
    } else {
      const quat = this.options.quat;

      if (!this.options.quat.equals(value)) {
        this.options.quat.copyFrom(value);
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.setRotationByQuat(value);
    }
  }

  /**
   * 获取相机旋转对应的四元数
   * @returns
   */
  getQuat (): Quaternion {
    let quat = this.options.quat;

    if (quat === undefined) {
      quat = new Quaternion();
      const { rotation } = this.options;

      if (rotation) {
        quat.setFromEuler(rotation);
      }

      this.options.quat = quat;
    }

    return quat;
  }

  /**
   * 获取相机内部的 options
   * @returns 相机 options
   */
  getOptions (): CameraOptionsEx {
    return this.options;
  }

  /**
   * 复制指定相机元素的属性到当前相机
   * @param camera
   */
  copy (camera: Camera) {
    const {
      near,
      far,
      fov,
      clipMode,
      aspect,
      position,
      rotation,
    } = camera;

    this.near = near;
    this.far = far;
    this.fov = fov;
    this.clipMode = clipMode;
    this.aspect = aspect;
    this.position = position;
    this.rotation = rotation;
    this.updateMatrix();
  }

  /**
   * 更新相机相关的矩阵，获取矩阵前会自动调用
   */
  public updateMatrix () {
    if (this.dirty) {
      const { fov, aspect, near, far, clipMode, position } = this.options;

      this.projectionMatrix.perspective(
        fov * DEG2RAD, aspect, near, far,
        clipMode === spec.CameraClipMode.portrait
      );
      this.inverseViewMatrix.compose(position, this.getQuat(), tmpScale);
      this.viewMatrix.copyFrom(this.inverseViewMatrix).invert();
      this.viewProjectionMatrix.multiplyMatrices(this.projectionMatrix, this.viewMatrix);

      this.inverseViewProjectionMatrix = null;
      this.dirty = false;
    }
  }

  private setRotationByQuat (quat: Quaternion) {
    Transform.getRotation(quat, this.options.rotation);
  }
}
