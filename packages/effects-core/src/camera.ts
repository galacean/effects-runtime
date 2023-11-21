import type { vec3 } from '@galacean/effects-specification';
import * as spec from '@galacean/effects-specification';
import { copy } from 'typedoc/dist/lib/utils';
import type { mat4 } from './math';
import {
  mat4create,
  mat4fromRotationTranslationScale,
  mat4invert,
  mat4multiply,
  mat4perspective,
  quatFromRotation, vec3MulMat4,
} from './math';
import { deepClone } from './utils';
import { Transform } from './transform';

/**
 *
 */
export interface CameraOptions {
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

const tmpScale: spec.vec3 = [1, 1, 1];

/**
 * 合成的相机对象，采用透视投影
 */
export class Camera {
  private options: CameraOptions;
  private viewMatrix: mat4 = mat4create();
  private projectionMatrix: mat4 = mat4create();
  private viewProjectionMatrix: mat4 = mat4create();
  private inverseViewMatrix: mat4 = mat4create();
  private inverseProjectionMatrix: mat4 | null;
  private inverseViewProjectionMatrix: mat4 | null;
  private dirty = true;

  /**
   *
   * @param name - 相机名称
   * @param options
   */
  constructor (public name: string, options: Partial<CameraOptions> = {}) {
    const {
      near = 0.1,
      far = 20,
      fov = 60,
      aspect = 1,
      clipMode = spec.CameraClipMode.portrait,
      position = [0, 0, 8],
      rotation = [0, 0, 0],
    } = options;

    this.options = { near, far, fov, aspect, clipMode, position, rotation };
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
  set position (value: spec.vec3) {
    value.map((val, index) => {
      if (this.options.position[index] !== val) {
        this.options.position[index] = val;
        this.dirty = true;
      }
    });
  }
  get position () {
    return [...this.options.position];
  }

  /**
   * 设置相机的旋转角度
   * @param value
   */
  set rotation (value: spec.vec3) {
    value.map((val, index) => {
      if (this.options.rotation[index] !== val) {
        this.options.rotation[index] = val;
        this.dirty = true;
        this.options.quat = undefined;
      }
    });
  }
  get rotation () {
    return [...this.options.rotation];
  }

  /**
   * 获取相机的视图变换矩阵
   * @return
   */
  getViewMatrix (): mat4 {
    this.updateMatrix();

    return deepClone(this.viewMatrix);
  }

  /**
   * 获取视图变换的逆矩阵
   */
  getInverseViewMatrix () {
    this.updateMatrix();

    return deepClone(this.inverseViewMatrix);
  }

  /**
   * 获取相机的投影矩阵
   * @return
   */
  getProjectionMatrix (): mat4 {
    this.updateMatrix();

    return deepClone(this.projectionMatrix);
  }

  /**
   * 获取相机投影矩阵的逆矩阵
   * @return
   */
  getInverseProjectionMatrix (): mat4 {
    this.updateMatrix();

    return deepClone(this.inverseProjectionMatrix);
  }

  /**
   * 获取相机的 VP 矩阵
   * @return
   */
  getViewProjectionMatrix (): mat4 {
    this.updateMatrix();

    return deepClone(this.viewProjectionMatrix);
  }

  /**
   * 获取相机 VP 矩阵的逆矩阵
   * @return
   */
  getInverseViewProjectionMatrix (): mat4 {
    this.updateMatrix();
    if (!this.inverseViewProjectionMatrix) {
      this.inverseViewProjectionMatrix = mat4invert([], this.viewProjectionMatrix);
    }

    return deepClone(this.inverseViewProjectionMatrix);
  }

  /**
   * 根据相机的视图投影矩阵对指定模型矩阵做变换
   * @param out - 结果矩阵
   * @param model - 模型变换矩阵
   */
  getModelViewProjection (out: mat4 | number[], model: mat4) {
    return mat4multiply(out, this.viewProjectionMatrix, model);
  }

  /**
   * 获取归一化坐标和 3D 世界坐标的换算比例
   * @param z - 当前的位置 z
   */
  getInverseVPRatio (z: number): vec3 {
    const pos: vec3 = [0, 0, 0];
    const nz = vec3MulMat4(pos, [0, 0, z], this.getViewProjectionMatrix())[2];

    vec3MulMat4(pos, [1, 1, nz], this.getInverseViewProjectionMatrix());

    return pos;
  }

  /**
   * 设置相机的旋转四元数
   * @param value - 旋转四元数
   */
  setQuat (value: spec.vec4) {
    if (this.options.quat === undefined) {
      this.options.quat = value;
      this.dirty = true;
    } else {
      const quat = this.options.quat;

      value.map((val, index) => {
        if (quat[index] !== val) {
          quat[index] = val;
          this.dirty = true;
        }
      });
    }
    if (this.dirty) {
      this.setRotationByQuat(value);
    }
  }

  /**
   * 获取相机旋转对应的四元数
   * @returns
   */
  getQuat (): spec.vec4 {
    let quat = this.options.quat;

    if (quat === undefined) {
      quat = [0, 0, 0, 1];
      const { rotation } = this.options;

      if (rotation) {
        quatFromRotation(quat, rotation[0], rotation[1], rotation[2]);
      }
      this.options.quat = quat;
    }

    return quat;
  }

  /**
   * 获取相机内部的 options
   * @returns 相机 options
   */
  getOptions (): CameraOptions {
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

      mat4perspective(this.projectionMatrix, fov, aspect, near, far, clipMode === spec.CameraClipMode.portrait);
      mat4fromRotationTranslationScale(this.inverseViewMatrix, this.getQuat(), position, tmpScale);
      mat4invert(this.viewMatrix, this.inverseViewMatrix);
      mat4multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);

      this.inverseViewProjectionMatrix = null;
      this.dirty = false;
    }
  }

  private setRotationByQuat (quat: spec.vec4) {
    this.options.rotation = Transform.getRotation([] as unknown as spec.vec3, quat);
  }
}
