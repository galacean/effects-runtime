import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Euler } from '@galacean/effects-math/es/core/euler';
import { DEG2RAD } from '@galacean/effects-math/es/core/utils';
import * as spec from '@galacean/effects-specification';
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
  /**
   * 画布的像素宽度
   */
  pixelWidth: number,
  /**
   * 画布的像素高度
   */
  pixelHeight: number,
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

  /**
   * @internal
   */
  transform: Transform = new Transform();
  /**
   * 画布的像素宽度
   */
  pixelWidth = 0;
  /**
   * 画布的像素高度
   */
  pixelHeight = 0;
  /**
   * 编辑器用于缩放画布
   */
  private viewportMatrix = Matrix4.fromIdentity();
  private options: CameraOptionsBase;
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
      pixelWidth = 0,
      pixelHeight = 0,
    } = options;

    const euler = new Euler(rotation[0], rotation[1], rotation[2]);
    const quat = new Quaternion().setFromEuler(euler);

    this.options = { near, far, fov, aspect, clipMode };
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;

    this.transform.setPosition(position[0], position[1], position[2]);
    this.transform.setQuaternion(quat.x, quat.y, quat.z, quat.w);
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
   * 设置相机的本地位置
   * @param value
   */
  set position (value: Vector3) {
    if (!this.transform.position.equals(value)) {
      this.transform.setPosition(value.x, value.y, value.z);
      this.dirty = true;
    }
  }
  /**
   * 获取相机的本地位置
   */
  get position () {
    return this.transform.position.clone();
  }

  /**
   * 获取相机的世界位置
   * @since 2.3.0
   */
  get worldPosition () {
    return this.transform.getWorldPosition();
  }

  /**
   * 设置相机的旋转角度
   * @param value
   */
  set rotation (value: Euler) {
    if (!this.transform.rotation.equals(value)) {
      this.transform.setRotation(value.x, value.y, value.z);
      this.dirty = true;
    }
  }
  get rotation () {
    return this.transform.rotation.clone();
  }

  /**
   * 设置相机变换
   * @since 2.3.0
   * @param transform
   */
  setTransform (transform: Transform) {
    this.transform.parentTransform = transform.parentTransform;
    this.transform.cloneFromMatrix(transform.getMatrix());
    this.dirty = true;
  }

  setViewportMatrix (matrix: Matrix4) {
    this.viewportMatrix = matrix.clone();
    this.dirty = true;
  }

  getViewportMatrix () {
    return this.viewportMatrix;
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
   * 获取归一化坐标和 3D 世界坐标的换算比例，使用 ViewProjection 矩阵
   * @param z - 当前的位置 z
   */
  getInverseVPRatio (z: number) {
    const pos = new Vector3(this.position.x, this.position.y, z);
    const mat = this.getViewProjectionMatrix();
    const inverseMat = this.getInverseViewProjectionMatrix();

    if (!this.viewportMatrix.isIdentity()) {
      const viewportMatrix = this.viewportMatrix.clone();

      inverseMat.premultiply(viewportMatrix);
      mat.multiply(viewportMatrix.invert());
    }

    const { z: nz } = mat.projectPoint(pos);
    const { x: xMax, y: yMax } = inverseMat.projectPoint(new Vector3(1, 1, nz));
    const { x: xMin, y: yMin } = inverseMat.projectPoint(new Vector3(-1, -1, nz));

    return new Vector3((xMax - xMin) / 2, (yMax - yMin) / 2, 0);
  }

  /**
   * 设置相机的旋转四元数
   * @param value - 旋转四元数
   */
  setQuat (value: Quaternion) {
    if (!this.transform.getQuaternion().equals(value)) {
      this.transform.setQuaternion(value.x, value.y, value.z, value.w);
      this.dirty = true;
    }
  }

  /**
   * 获取相机旋转对应的四元数
   * @returns
   */
  getQuat (): Quaternion {
    return this.transform.quat.clone();
  }

  /**
   * 获取相机内部的 options
   * @returns 相机 options
   */
  getOptions (): CameraOptionsEx {
    return {
      ...this.options,
      position: this.position.clone(),
      rotation: this.rotation.clone(),
    };
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
  updateMatrix () {
    if (this.dirty) {
      const { fov, aspect, near, far, clipMode } = this.options;

      this.projectionMatrix.perspective(
        fov * DEG2RAD, aspect, near, far,
        clipMode === spec.CameraClipMode.portrait
      );
      this.projectionMatrix.premultiply(this.viewportMatrix);
      this.inverseViewMatrix.compose(this.position, this.getQuat(), tmpScale);
      this.inverseViewMatrix.premultiply(this.transform.getParentMatrix() ?? Matrix4.IDENTITY);
      this.viewMatrix.copyFrom(this.inverseViewMatrix).invert();
      this.viewProjectionMatrix.multiplyMatrices(this.projectionMatrix, this.viewMatrix);
      this.inverseViewProjectionMatrix = null;
      this.dirty = false;
    }
  }

  /**
   * 将世界坐标转换为屏幕像素坐标
   * @param position - 世界坐标
   * @param out - 输出的屏幕坐标，如果不传则创建新的 Vector3
   * @returns 屏幕坐标 (x, y 为像素坐标，左下角为(0,0)，右上角为(width,height)，z 为相机深度距离)
   */
  worldToScreenPoint (position: Vector3, out?: Vector3): Vector3 {
    this.updateMatrix();

    const result = out ?? new Vector3();

    // 计算世界坐标到相机的深度距离（沿相机朝向）
    const viewMatrix = this.getViewMatrix();

    // 将世界坐标转换到相机空间
    const viewSpacePos = new Vector3();

    viewMatrix.transformPoint(position, viewSpacePos);

    // 相机空间中，相机看向 -Z 方向，所以 viewSpacePos.z 对于前方物体是负数
    // depth = -viewSpacePos.z 得到正的深度值（在相机前方的距离）
    const depth = -viewSpacePos.z;

    // 应用视图投影矩阵，得到 NDC 坐标 [-1, 1]
    const vpMatrix = this.getViewProjectionMatrix();

    result.set(position.x, position.y, position.z);
    vpMatrix.projectPoint(result, result);

    // 将 NDC 坐标转换为像素坐标
    // NDC: x,y in [-1, 1], 其中 (-1,-1) 是左下角，(1,1) 是右上角
    // Screen: x,y in [0, width/height], 其中 (0,0) 是左下角
    result.x = (result.x + 1) * 0.5 * this.pixelWidth;
    result.y = (result.y + 1) * 0.5 * this.pixelHeight;
    result.z = depth;

    return result;
  }

  /**
   * 将屏幕像素坐标转换为世界坐标
   * @param position - 屏幕坐标 (x, y 为像素坐标，左下角为(0,0)，z 为相机深度距离)
   * @param out - 输出的世界坐标，如果不传则创建新的 Vector3
   * @returns 世界坐标
   */
  screenToWorldPoint (position: Vector3, out?: Vector3): Vector3 {
    this.updateMatrix();

    const result = out ?? new Vector3();

    // 将像素坐标转换为 NDC 坐标 [-1, 1]
    const ndcX = (position.x / this.pixelWidth) * 2 - 1;
    const ndcY = (position.y / this.pixelHeight) * 2 - 1;

    // 在近平面和远平面处创建两个点来确定从相机出发的射线
    const nearPoint = new Vector3(ndcX, ndcY, -1);
    const farPoint = new Vector3(ndcX, ndcY, 1);

    const invVPMatrix = this.getInverseViewProjectionMatrix();
    const nearWorld = new Vector3();
    const farWorld = new Vector3();

    invVPMatrix.projectPoint(nearPoint, nearWorld);
    invVPMatrix.projectPoint(farPoint, farWorld);

    // 计算射线方向（从近平面到远平面，即相机朝向）
    const rayDir = new Vector3();

    rayDir.set(
      farWorld.x - nearWorld.x,
      farWorld.y - nearWorld.y,
      farWorld.z - nearWorld.z
    );
    rayDir.normalize();

    // 从相机位置沿射线方向（相机朝向，即世界空间中的 -Z 方向）前进指定深度
    const cameraPos = this.position;

    // result = cameraPos + rayDir * depth
    // 由于 depth 是正值，rayDir 是朝向 -Z 的方向，所以会正确地在相机前方生成点
    result.set(
      cameraPos.x + rayDir.x * position.z,
      cameraPos.y + rayDir.y * position.z,
      cameraPos.z + rayDir.z * position.z
    );

    return result;
  }
}
